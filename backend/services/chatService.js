// ==================== ENHANCED CHAT SERVICE WITH TEMPLATE SUPPORT ====================
const { qdrant, openai, supabase } = require('../config/database');
const { getCollectionName } = require('../utils/helpers');
const { generateEmbedding } = require('../utils/vectorUtils');

/**
 * Search relevant documents for a query (existing function)
 */
async function searchRelevantDocuments(query, projectId, limit = 50) {
  try {
    const collectionName = getCollectionName(projectId);
    
    if (!qdrant) {
      console.log('âš ï¸ Qdrant not initialized');
      return { documents: [], count: 0, collectionExists: false };
    }

    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);

    if (!collectionExists) {
      return { documents: [], count: 0, collectionExists: false };
    }

    const collectionInfo = await qdrant.getCollection(collectionName);
    const documentsSearched = collectionInfo.points_count || 0;
    
    if (documentsSearched === 0) {
      return { documents: [], count: 0, collectionExists: true };
    }

    const queryEmbedding = await generateEmbedding(query);
    
    const searchResult = await qdrant.search(collectionName, {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
    });

    const relevantDocuments = searchResult || [];
    
    return { 
      documents: relevantDocuments, 
      count: documentsSearched, 
      collectionExists: true 
    };

  } catch (error) {
    console.error('âš ï¸ Document search error:', error.message);
    return { documents: [], count: 0, collectionExists: false };
  }
}

/**
 * Build document context (existing function)
 */
function buildDocumentContext(relevantDocuments) {
  if (!relevantDocuments || relevantDocuments.length === 0) {
    return '';
  }

  let documentContext = '\n\nðŸ“š RELEVANT DOCUMENTS FROM YOUR PROJECT:\n';
  
  relevantDocuments.forEach((doc, index) => {
    const payload = doc.payload || {};
    
    documentContext += `\n--- Document ${index + 1} of ${relevantDocuments.length}: ${payload.document_name || 'Document'} ---\n`;
    
    const content = payload.full_content || payload.content_preview || '';
    if (content) {
      const maxContentLength = 4000;
      const truncatedContent = content.length > maxContentLength 
        ? content.substring(0, maxContentLength) + '...' 
        : content;
      documentContext += `Content:\n${truncatedContent}\n`;
    }
    
    if (payload.is_image) {
      documentContext += `(This is an image document with AI-generated description)\n`;
    }
    
    documentContext += `Type: ${payload.document_type}\n`;
    documentContext += `Relevance Score: ${(doc.score || 0).toFixed(4)}\n`;
  });
  
  documentContext += '\n--- End of Documents ---\n';
  
  return documentContext;
}

/**
 * NEW: Detect if user is requesting legal document generation
 */
function detectDocumentGenerationIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const triggers = {
    section_11: [
      'section 11',
      'section-11',
      'sec 11',
      'arbitration petition',
      'generate section 11',
      'create section 11',
      'draft section 11',
      'à¤¬à¤¨à¤¾à¤“ section 11',
      'section 11 à¤¬à¤¨à¤¾à¤“'
    ],
    // Add more templates as needed
    nda: ['nda', 'non-disclosure', 'confidentiality agreement'],
    contract: ['contract draft', 'draft contract']
  };
  
  for (const [templateType, keywords] of Object.entries(triggers)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return { 
        isGenerationRequest: true, 
        templateType,
        templateName: templateType === 'section_11' ? 'Section 11 Arbitration Petition' : null
      };
    }
  }
  
  return { isGenerationRequest: false };
}

/**
 * NEW: Get template part from Supabase
 */
async function getTemplatePart(templateName, partNumber) {
  try {
    // Get template ID first
    const { data: template, error: templateError } = await supabase
      .from('legal_templates')
      .select('id')
      .eq('template_name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found');
    }

    // Get specific part
    const { data: part, error: partError } = await supabase
      .from('template_parts')
      .select('*')
      .eq('template_id', template.id)
      .eq('part_number', partNumber)
      .single();

    if (partError || !part) {
      throw new Error(`Part ${partNumber} not found`);
    }

    return part;
  } catch (error) {
    console.error('Error fetching template part:', error);
    throw error;
  }
}

/**
 * NEW: Extract fields from documents based on template requirements
 */
async function extractTemplateFields(documents, extractionFields) {
  try {
    // Build a prompt to extract specific fields from documents
    const extractionPrompt = `
You are a data extraction specialist. Extract the following fields from the provided documents:

FIELDS TO EXTRACT:
${extractionFields.map(field => `- ${field}`).join('\n')}

DOCUMENTS:
${documents.map((doc, i) => `
Document ${i + 1}: ${doc.payload?.document_name}
Content: ${doc.payload?.full_content || doc.payload?.content_preview || 'No content'}
`).join('\n\n')}

INSTRUCTIONS:
1. Extract exact values where possible
2. For dates, use format DD.MM.YYYY
3. For amounts, include â‚¹ symbol
4. If a field is not found, mark as "NOT_FOUND"
5. Return as JSON object with field names as keys

RESPOND ONLY WITH JSON:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const extractedData = JSON.parse(completion.choices[0].message.content);
    console.log('âœ… Extracted template fields:', Object.keys(extractedData).length);
    
    return extractedData;
  } catch (error) {
    console.error('Error extracting template fields:', error);
    return {};
  }
}

// ==================== FIXED: generateDocumentPart ==================== 
async function generateDocumentPart(templateName, partNumber, projectDocuments, conversationHistory = []) {
  try {
    console.log(`📝 Generating ${templateName} - Part ${partNumber}`);
    
    // Get template part from Supabase
    const templatePart = await getTemplatePart(templateName, partNumber);
    
    if (!templatePart) {
      throw new Error(`Template part ${partNumber} not found`);
    }

    // Extract required fields from documents
    const extractionFields = templatePart.extraction_fields || [];
    const extractedData = await extractTemplateFields(projectDocuments, extractionFields);

    // Build document context
    const documentContext = buildDocumentContext(projectDocuments);

    // ✅ FIXED: Enhanced system prompt for proper table formatting
    const systemPrompt = `
${templatePart.system_prompt}

**EXTRACTED DATA FROM DOCUMENTS:**
${JSON.stringify(extractedData, null, 2)}

**FORMATTING RULES:**
${JSON.stringify(templatePart.formatting_rules, null, 2)}

**DOCUMENT CONTEXT:**
${documentContext}

**CRITICAL TABLE FORMATTING RULES:**
1. For tables, use strict markdown format:
   | Header 1 | Header 2 | Header 3 |
   |----------|----------|----------|
   | Cell 1   | Cell 2   | Cell 3   |
   
2. Each cell must be separated by single pipe |
3. Header row must be followed by separator row with dashes
4. All rows must have equal number of columns
5. Do NOT use bold markers (**) in table headers
6. Keep table content clean and readable

**OTHER FORMATTING:**
- Use **bold** for emphasis in regular text only
- Use proper paragraphs with line breaks
- Section headings should be clear
- Use bullet points with - for lists

**CRITICAL INSTRUCTIONS:**
1. Use ONLY the extracted data and document context provided
2. Follow formatting rules EXACTLY as specified
3. Generate ONLY Part ${partNumber}: ${templatePart.part_name}
4. Do NOT generate other parts
5. Maintain legal accuracy and proper terminology
6. Use exact text from documents where specified
7. If a required field is NOT_FOUND, use placeholder: [TO BE FILLED]
8. Output clean, structured content suitable for DOCX conversion

Generate the document part now:`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation context if available
    const recentHistory = conversationHistory.slice(-4);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    // Add generation request
    messages.push({ 
      role: 'user', 
      content: `Generate Part ${partNumber}: ${templatePart.part_name} using the extracted data and documents. Use proper markdown table format for any tables.` 
    });

    // Generate with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 4000
    });

    const generatedContent = completion.choices[0]?.message?.content || '';
    
    console.log(`✅ Generated Part ${partNumber}: ${generatedContent.length} characters`);

    return {
      success: true,
      partNumber,
      partName: templatePart.part_name,
      content: generatedContent,
      extractedData,
      templatePart: {
        description: templatePart.part_description,
        formattingRules: templatePart.formatting_rules
      }
    };

  } catch (error) {
    console.error(`❌ Error generating part ${partNumber}:`, error);
    throw error;
  }
}

/**
 * ENHANCED: Main chat response generation with template support
 */
async function generateChatResponse(messageData) {
  try {
    const {
      message,
      projectId,
      projectName,
      department,
      division,
      status,
      documentCount = 0,
      conversationHistory = []
    } = messageData;

    if (!message) {
      throw new Error('Message is required');
    }

    console.log('ðŸ’¬ Processing chat message:', message.substring(0, 200));

    // âœ… NEW: Check if this is a document generation request
    const generationIntent = detectDocumentGenerationIntent(message);

    if (generationIntent.isGenerationRequest && generationIntent.templateName) {
      console.log('ðŸ“„ Document generation request detected:', generationIntent.templateName);
      
      // Search for relevant documents
      let relevantDocuments = [];
      if (projectId) {
        const searchResult = await searchRelevantDocuments(message, projectId, 50);
        relevantDocuments = searchResult.documents;
      }

      if (relevantDocuments.length === 0) {
        return {
          success: true,
          isGenerationRequest: true,
          requiresDocuments: true,
          message: `To generate a ${generationIntent.templateName}, I need access to your project documents. Please select a project or upload relevant documents such as:\n\n- Award Letter\n- Agreement/Contract\n- Determination Letter (if applicable)\n- Demand Notice\n- Arbitration Notice\n- Any other relevant correspondence\n\nOnce documents are available, I'll generate the petition part by part for your review.`,
          templateName: generationIntent.templateName
        };
      }

      // Extract current part number from message if specified
      const partMatch = message.match(/part\s*(\d+)/i);
      const partNumber = partMatch ? parseInt(partMatch[1]) : 1;

      // Generate the requested part
      const partResult = await generateDocumentPart(
        generationIntent.templateName,
        partNumber,
        relevantDocuments,
        conversationHistory
      );

      return {
        success: true,
        isGenerationRequest: true,
        templateName: generationIntent.templateName,
        currentPart: partNumber,
        partName: partResult.partName,
        message: partResult.content,
        extractedData: partResult.extractedData,
        formattingRules: partResult.templatePart.formattingRules,
        nextPartPrompt: `Please review Part ${partNumber}: ${partResult.partName}. Reply with:\n- "Approved" to proceed to Part ${partNumber + 1}\n- "Revise" with your feedback to modify this part\n- "Regenerate" to generate this part again`,
        documentsUsed: relevantDocuments.length
      };
    }

    // âœ… EXISTING: Regular chat flow (non-generation requests)
    let relevantDocuments = [];
    let collectionName = null;
    let documentsSearched = 0;
    let collectionExists = false;

    if (projectId) {
      collectionName = getCollectionName(projectId);
      const searchResult = await searchRelevantDocuments(message, projectId, 50);
      
      relevantDocuments = searchResult.documents;
      documentsSearched = searchResult.count;
      collectionExists = searchResult.collectionExists;
    }

    const documentContext = buildDocumentContext(relevantDocuments);

    // Build system prompt (using existing logic)
    const systemPrompt = buildStandardSystemPrompt(
      {
        projectId,
        projectName,
        department,
        division,
        status,
        documentCount,
        relevantDocumentsCount: relevantDocuments.length
      },
      documentContext,
      documentsSearched,
      collectionExists
    );

    const messages = [{ role: 'system', content: systemPrompt }];

    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    messages.push({ role: 'user', content: message });

    console.log('ðŸ¤– Generating AI response...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7
    });

    let aiResponse = completion.choices?.[0]?.message?.content || '';
    let finishReason = completion.choices?.[0]?.finish_reason || null;

    // Handle length truncation (existing logic)
    let continueAttempts = 0;
    const MAX_CONTINUE_ATTEMPTS = 6;

    while (finishReason === 'length' && continueAttempts < MAX_CONTINUE_ATTEMPTS) {
      continueAttempts += 1;
      console.log(`â†©ï¸ Continuing generation (attempt ${continueAttempts})...`);

      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: aiResponse.slice(-4000) },
        { role: 'user', content: 'CONTINUE' }
      ];

      const nextCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: continuationMessages,
        temperature: 0.7
      });

      const nextChunk = nextCompletion.choices?.[0]?.message?.content || '';
      finishReason = nextCompletion.choices?.[0]?.finish_reason || null;

      aiResponse += (nextChunk ? `\n${nextChunk}` : '');
    }

    return {
      success: true,
      isGenerationRequest: false,
      message: aiResponse,
      documentsUsed: relevantDocuments.length,
      documentsSearched: documentsSearched,
      documentsInProject: documentCount,
      collectionExists: collectionExists,
      projectContext: projectName || null
    };

  } catch (error) {
    console.error('âŒ Chat generation error:', error.message);
    throw error;
  }
}

/**
 * Build standard system prompt (existing logic extracted)
 */
function buildStandardSystemPrompt(projectData, documentContext, documentsSearched, collectionExists) {
  const { 
    projectId, 
    projectName, 
    department, 
    division, 
    status, 
    documentCount = 0,
    relevantDocumentsCount = 0
  } = projectData;
  
  let systemPrompt = `
You are a dual-specialized AI Assistant trained in:
- Indian civil law, contract law, and government procurement (CPWD, PWD, GCC, etc.)
- Technical evaluation of project terms, deliverables, BOQs, SoRs, and construction/service agreements

[... existing system prompt content from chatService.js ...]
`;

  if (projectId && projectName) {
    systemPrompt += `\n\n**CURRENT PROJECT CONTEXT:**`;
    systemPrompt += `\n- Project: ${projectName}`;
    systemPrompt += `\n- Documents Available: ${documentCount}`;
    systemPrompt += `\n- Documents Indexed: ${documentsSearched}`;
    if (department) systemPrompt += `\n- Department: ${department}`;
    if (division) systemPrompt += `\n- Division: ${division}`;
  }

  if (documentContext) {
    systemPrompt += `\n\n**IMPORTANT:** The following documents are relevant:`;
    systemPrompt += documentContext;
  }

  return systemPrompt;
}

// ✅ Export updated function
module.exports = {
  searchRelevantDocuments,
  buildDocumentContext,
  generateChatResponse,
  generateDocumentPart,
  detectDocumentGenerationIntent
};
