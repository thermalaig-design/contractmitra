// ==================== CHAT SERVICE ====================
const { qdrant, openai } = require('../config/database');
const { getCollectionName } = require('../utils/helpers');
const { generateEmbedding } = require('../utils/vectorUtils');

/**
 * Search relevant documents for a query
 */
async function searchRelevantDocuments(query, projectId, limit = 50) { // Increase limit for much broader access
  try {
    const collectionName = getCollectionName(projectId);
    
    if (!qdrant) {
      console.log('⚠️ Qdrant not initialized; skipping document context search');
      return { documents: [], count: 0, collectionExists: false };
    }

    // Check if collection exists
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);

    if (!collectionExists) {
      console.log('⚠️ Collection does not exist yet');
      return { documents: [], count: 0, collectionExists: false };
    }

    // Get collection info
    const collectionInfo = await qdrant.getCollection(collectionName);
    const documentsSearched = collectionInfo.points_count || 0;
    
    console.log(`🔍 Searching ${documentsSearched} documents in collection: ${collectionName}`);

    if (documentsSearched === 0) {
      console.log('⚠️ Collection exists but has no documents');
      return { documents: [], count: 0, collectionExists: true };
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Enhanced search with better parameters
    const searchResult = await qdrant.search(collectionName, {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
      // score_threshold: 0.3 // Only get reasonably relevant results
    });

    const relevantDocuments = searchResult || [];
    console.log(`✅ Found ${relevantDocuments.length} relevant documents`);

    // Log relevance scores
    relevantDocuments.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.payload?.document_name} - Score: ${(doc.score * 100).toFixed(1)}%`);
    });

    return { 
      documents: relevantDocuments, 
      count: documentsSearched, 
      collectionExists: true 
    };

  } catch (error) {
    console.error('⚠️ Document search error:', error.message);
    return { documents: [], count: 0, collectionExists: false };
  }
}

/**
 * Build comprehensive document context (ORIGINAL FORMAT)
 */
function buildDocumentContext(relevantDocuments) {
  if (!relevantDocuments || relevantDocuments.length === 0) {
    return '';
  }

  let documentContext = '\n\n📚 RELEVANT DOCUMENTS FROM YOUR PROJECT:\n';
  
  relevantDocuments.forEach((doc, index) => {
    const payload = doc.payload || {};
    
    // Check for missing content
    if (!payload.full_content && !payload.content_preview) {
      console.error(`⚠️ Document ${payload.document_name} has no content!`);
      console.log('Payload keys:', Object.keys(payload));
    }
    
    documentContext += `\n--- Document ${index + 1} of ${relevantDocuments.length}: ${payload.document_name || 'Document'} ---\n`;
    
    // Use full_content if available, fallback to content_preview
    const content = payload.full_content || payload.content_preview || '';
    if (content) {
      // Limit content to avoid token limits
      const maxContentLength = 4000; // used to be 2000
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
 * Build system prompt (ORIGINAL LEGAL ASSISTANT PROMPT)
 */
function buildSystemPrompt(projectData, documentContext, documentsSearched, collectionExists) {
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

You assist users by:
- Reviewing contract clauses (legal + technical)
- Comparing options, vendors, or specs side-by-side
- Drafting or simplifying legal documents
- Explaining risks and steps in simple language
- Advising contractors, engineers, consultants, and vendors

===============================
I. CORE ABILITIES (LEGAL + TECHNICAL)

| LEGAL CAPABILITIES                        | TECHNICAL CAPABILITIES                           |
|------------------------------------------|--------------------------------------------------|
| Contract clause analysis                 | BOQ/SoR structure interpretation                 |
| Arbitration, penalty, and termination    | Rate comparison vs CPWD SoR                      |
| Drafting (MOU, LOA, notices, clauses)    | Work scope verification, item audit              |
| Limitation period & enforceability       | Delay analysis, milestone tracking               |
| Dispute risk identification              | Work certification, payment trigger clauses      |

===============================
II. LANGUAGE & STYLE
- Use formal legal English in documents
- Use plain, easy English in explanations
- Break down legal + technical terms clearly
- Prefer tables, bullet points, and stepwise instructions

===============================
III. RESPONSE STRUCTURE

1. 📌 PLAIN SUMMARY  
> Give a 2–3 line layman-friendly explanation.

2. 📄 LEGAL + TECHNICAL EXPLANATION  
- Mention relevant clauses or acts  
- Explain real-world meaning and enforceability  
- Keep it concise and accessible  

3. 📊 CLAUSE / OPTION COMPARISON TABLE (if needed)

| **Clause A**              | **Clause B**              |
|--------------------------|---------------------------|
| Termination on 7 days    | Termination on breach     |
| Risk to vendor           | Balanced                  |
| No cure period           | Includes 15-day notice    |

4. 🧱 MATERIAL / SPEC COMPARISON TABLE (when comparing technical specs, vendor rates, etc.)

| **Feature**              | **Vendor A**     | **Vendor B**     | **Vendor C**     |
|--------------------------|------------------|------------------|------------------|
| Model                    | MonoSpace        | Rexia IN         | Gen2 Stream      |
| Capacity                 | 1768 kg / 26 pax | 1600 kg / 21 pax | 1768 kg / 26 pax |
| Speed                    | 1.75 m/s         | 1.75 m/s         | 1.75 m/s         |
| Price (INR)              | ₹12.5 Lakh       | ₹11.8 Lakh       | ₹13.2 Lakh       |
| Remarks                  | SoR compliant    | Needs clarification | Star rate item |

📌 Always use this format for vendor/material/spec/rate comparisons.

5. 📤 FORMAT OPTIONS
- Use **HTML table** if frontend supports rendering
- Use **Markdown table** if viewing in plain chat
- Use **JSON array** if needed for frontend rendering (e.g., React table)

6. 🧭 ACTION PLAN (Stepwise)
- Step 1: Identify applicable GCC or CPWD clause
- Step 2: Compare with standard format
- Step 3: Draft reply or request clarification

7. 🧠 TERM SIMPLIFICATION
- LD = Penalty for delay under Sec. 74, Contract Act
- Force Majeure = Delay due to uncontrollable event
- Arbitration = Private, binding dispute resolution

===============================
IV. INTERACTION LOGIC
- Rephrase user's question to confirm
- Ask clarifying questions if incomplete
- Warn user of deadlines (Limitation Act)
- If clause/document is missing, ask for it explicitly
- Never speculate; request context or text as needed

===============================
V. SMART RESPONSE MODES

| MODE              | Trigger Examples                             | Function                                         |
|-------------------|-----------------------------------------------|--------------------------------------------------|
| Drafting Mode     | "Draft a notice", "Prepare clause"            | Writes legal or contract-ready drafts           |
| Review Mode       | "Check this clause", "Is this risky?"         | Reviews content for legality & practicality     |
| Comparison Mode   | "Compare vendors", "Which is better?"         | Creates side-by-side comparison tables          |
| Advisory Mode     | "What can I do?", "Next steps?"               | Suggests step-by-step legal/technical actions   |
| Tender Mode       | "Review BOQ", "Compare quoted rates"          | Checks rate deviation, SoR compliance, remarks  |
| Limitation Mode   | "Is it time-barred?"                          | Applies Limitation Act deadlines with dates     |

===============================
VI. OUTPUT FORMATTING OPTIONS (RENDERING FRIENDLY)

If comparison or tabular data is involved:
- Default to **Markdown table** unless specified
- Respond in **HTML table** if rendering is needed for frontend
- Output as **JSON object** if requested for frontend or API integration

Example JSON structure:
[
  {
    "Feature": "Capacity",
    "KONE": "1768 kg / 26 pax",
    "Fujitec": "1600 kg / 21 pax"
  },
  {
    "Feature": "Speed",
    "KONE": "1.75 m/s",
    "Fujitec": "1.75 m/s"
  }
]

===============================
VII. GUIDING PRINCIPLES

- 🎯 Be accurate and reliable
- 🔍 Be user-friendly and simplified
- 🛡️ Be safe: avoid assumptions or legal guesses
- 🧠 Be educational: define terms, cite law
- 📈 Be structured: prefer tables, steps, and clarity
- 📢 Be proactive: suggest next steps or draft templates

`;

  // Add project context if available
  if (projectId && projectName) {
    systemPrompt += `\n\n**CURRENT PROJECT CONTEXT:**`;
    systemPrompt += `\n- Project: ${projectName}`;
    systemPrompt += `\n- Documents Available in Database: ${documentCount}`;
    systemPrompt += `\n- Documents Indexed in Vector Store: ${documentsSearched}`;
    systemPrompt += `\n- Collection Status: ${collectionExists ? 'Active' : 'Not Created'}`;
    if (department) systemPrompt += `\n- Department: ${department}`;
    if (division) systemPrompt += `\n- Division: ${division}`;
    if (status) systemPrompt += `\n- Status: ${status}`;
  }

  // Add document context if available
  if (documentContext) {
    systemPrompt += `\n\n**IMPORTANT:** The following documents from the project are highly relevant to this query. You MUST reference and cite them in your response:`;
    systemPrompt += documentContext;
    systemPrompt += `\n\n**Remember:** Base your analysis on the actual document content provided above. Quote specific sections and reference document names when making points.`;
  } else if (projectId && documentsSearched === 0 && documentCount > 0) {
    systemPrompt += `\n\n**NOTE:** This project has ${documentCount} document(s) uploaded but they are not yet indexed in the vector database. Providing general legal guidance without document-specific context.`;
  } else if (projectId && documentsSearched > 0 && relevantDocumentsCount === 0) {
    systemPrompt += `\n\n**NOTE:** Searched through ${documentsSearched} indexed documents but none were relevant to this specific query. Providing general legal guidance.`;
  }

  return systemPrompt;
}

/**
 * Generate AI chat response (ORIGINAL IMPLEMENTATION)
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

    console.log('💬 Processing chat message:', message.substring(0, 200));

    let relevantDocuments = [];
    let collectionName = null;
    let documentsSearched = 0;
    let collectionExists = false;

    // Search Qdrant if projectId is provided
    if (projectId) {
      collectionName = getCollectionName(projectId);
      const searchResult = await searchRelevantDocuments(message, projectId, 50); // Fetch up to 50 docs
      
      relevantDocuments = searchResult.documents;
      documentsSearched = searchResult.count;
      collectionExists = searchResult.collectionExists;
    }

    // Build comprehensive document context
    const documentContext = buildDocumentContext(relevantDocuments);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
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

    // Build messages array for OpenAI
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add recent conversation history (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    console.log('🤖 Generating AI response...');
    console.log(`   System prompt length: ${systemPrompt.length} characters`);
    console.log(`   Documents in context: ${relevantDocuments.length}`);
    console.log(`   Collection exists: ${collectionExists}`);

    // Generate AI response
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Initial completion without explicit max_tokens to allow maximum model output
    let completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7
    });

    let aiResponse = completion.choices?.[0]?.message?.content || '';
    let finishReason = completion.choices?.[0]?.finish_reason || null;

    console.log('✅ AI response generated');
    console.log(`   Response length: ${aiResponse.length} characters`);
    console.log(`   Finish reason: ${finishReason || 'unknown'}`);

    // If model truncated due to length, auto-continue to fetch the rest
    // Safety cap to avoid infinite loops
    let continueAttempts = 0;
    const MAX_CONTINUE_ATTEMPTS = 6;

    while (finishReason === 'length' && continueAttempts < MAX_CONTINUE_ATTEMPTS) {
      continueAttempts += 1;
      console.log(`↩️ Continuing generation (attempt ${continueAttempts})...`);

      // Add assistant's last chunk and a user "CONTINUE" cue to prompt continuation
      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: aiResponse.slice(-4000) },
        { role: 'user', content: 'CONTINUE' }
      ];

      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: continuationMessages,
        temperature: 0.7
      });

      const nextChunk = completion.choices?.[0]?.message?.content || '';
      finishReason = completion.choices?.[0]?.finish_reason || null;

      aiResponse += (nextChunk ? `\n${nextChunk}` : '');
      console.log(`   Appended ${nextChunk.length} chars, total: ${aiResponse.length}. Finish: ${finishReason}`);
    }

    // Split very long responses into safe chunks for transport/display
    function splitIntoChunks(text, maxLen = 12000) {
      if (!text || text.length <= maxLen) return [text || ''];
      const parts = [];
      let start = 0;
      while (start < text.length) {
        let end = Math.min(start + maxLen, text.length);
        // Try to break at a newline near the boundary for cleaner splits
        if (end < text.length) {
          const lastNewline = text.lastIndexOf('\n', end - 1);
          if (lastNewline > start + Math.floor(maxLen * 0.6)) {
            end = lastNewline + 1;
          }
        }
        parts.push(text.slice(start, end));
        start = end;
      }
      return parts;
    }

    const messageParts = splitIntoChunks(aiResponse);
    const isChunked = messageParts.length > 1;

    // Return response with metadata
    return {
      success: true,
      message: aiResponse, // full concatenated message
      messageParts,        // chunked parts for UI that needs pagination/incremental render
      isChunked,
      totalParts: messageParts.length,
      documentsUsed: relevantDocuments.length,
      documentsSearched: documentsSearched,
      documentsInProject: documentCount,
      collectionExists: collectionExists,
      projectContext: projectName || null,
      department: department || null,
      division: division || null,
      status: status || null,
      collectionName: collectionName,
      relevantDocuments: relevantDocuments.map(d => ({
        name: d.payload?.document_name || 'Document',
        score: d.score,
        type: d.payload?.document_type || 'UNKNOWN',
        contentLength: d.payload?.content_length || 0,
        hasContent: !!(d.payload?.full_content || d.payload?.content_preview)
      }))
    };

  } catch (error) {
    console.error('❌ Chat generation error:', error.message);
    throw error;
  }
}

module.exports = {
  searchRelevantDocuments,
  buildDocumentContext,
  buildSystemPrompt,
  generateChatResponse
};
