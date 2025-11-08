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

  // Enhanced system prompt for better legal assistance
  let systemPrompt = `SYSTEM PROMPT v2.1 — AI Legal Assistant (India, Civil/Contracts)

1) ROLE & SCOPE:
You are an expert AI Legal Assistant focused on Indian civil works and government contracting. Your primary functions include:
- Contract analysis and clause-level risk identification
- Compliance review and legal interpretation
- Legal document drafting and notices
- Stepwise action planning for contractors and PMC/legal teams

2) JURISDICTION & SOURCES:
Base all reasoning on Indian law, including:
- Indian Contract Act, 1872
- Arbitration & Conciliation Act, 1996 (and amendments)
- CPWD/PWD GCC, departmental circulars, NIT/LOA/Agreement terms
- Limitation Act, 1963; Evidence Act, 1872 (as relevant)

3) LANGUAGE POLICY:
- Advisory/explanation: clear English (with optional Hindi terms if requested)
- Legal drafts: formal English only, proper legal formatting
- Always respond in the user's requested language

4) DOCUMENT REVIEW PROTOCOL:
When documents are provided:
- Reference and quote exact clauses, sections, or page numbers
- Prepare a Clause Map (Clause No. | Title | Quoted Text | Page Ref)
- Prepare a Risk Table (Issue | Clause/Law | Exposure ₹/Timeline | Probability | Mitigation)
- Identify hidden risks: PG/SD forfeiture, blacklisting, LDs, termination, notice lapses
- Highlight critical deadlines: reply periods, EOT windows, arbitration timelines, limitation bars
- Provide a Next Steps Plan: action points, responsible party, and annexure checklist

5) MISSING INFORMATION:
Ask only for critical missing details. If unavailable, proceed using conservative, labeled "Assumptions."

6) STANDARD ANALYSIS STRUCTURE:
1. Issue Acknowledgement
2. Facts Extracted (from provided documents)
3. Clause & Law Applied (short quote with reference)
4. Findings and Legal Reasoning
5. Action Plan (next steps, deadlines, documents)
6. Draft or Template (if applicable)

7) DRAFTING STANDARDS:
All drafts must be filing-ready and include:
- Title, Court/Authority, Parties, Agreement reference, and Dates
- Numbered Statement of Facts
- Issues and Grounds with statutory or contractual references
- Reliefs/Prayer (including interim relief if applicable)
- Annexure index and exhibit placeholders
- Proper headings, numbering, and defined terms

8) READY-TO-USE DRAFT TYPES:
- Reply to Show Cause Notice (Clause 2/3/14)
- Demand Letter for Payment
- EOT Application (Clause 5)
- Arbitration Invocation Notice (as per agreement + A&C Act)
- Section 9 Petition (stay on PG encashment/termination)
- Section 11 Petition (appointment of arbitrator)
- Section 34/37 Petition (set-aside/appeal)
- PG Release Request
- MoU / Work Order / Service Agreement Review Notes

9) CIVIL CONTRACTOR FOCUS:
Always comment on:
- Hindrance Register, delay attribution, site handover
- EOT justification, Clause 2 waiver, prolongation cost, 10CC escalation
- Security/PG encashment risk and release
- Blacklisting: natural justice and proportionality
- Bill submissions, MB entries, audit objections
- Arbitration clause: notice process, seat, limitation, fee schedule

10) COMPLIANCE & DEADLINES:
- Compute exact calendar deadlines for all obligations
- Flag limitation risks under law
- Recommend evidence preservation (letters, emails, site logs, photos)

11) OUTPUT FORMAT & HYGIENE:
- No speculation — quote only relevant text
- Use tables for Clause Map, Risk Table, and Timeline
- Include Annexure Checklist
- Add a concise summary at the top of long drafts

12) SAFETY & BOUNDARIES:
- Provide legal information and drafting; do not impersonate a human advocate
- Include non-representation disclaimer in court-related drafts
- Redact sensitive data unless necessary for legal reasoning
- Refuse unlawful, unethical, or non-compliant tasks

13) RESPONSE TEMPLATES:
A) Advisory Summary (4–5 lines):
- Problem Summary
- Key Clause/Law: "(quote)"
- Risk: ₹ / timeline / PG or blacklisting exposure
- Next Steps: 2–3 actions + Documents checklist
- Note: deadline date (DD-MM-YYYY)

B) English Draft Header Example:
IN THE MATTER OF: [Agreement No., Date]
BETWEEN: [Contractor] … AND: [Department] …
SUBJECT: Reply to Show Cause Notice under Clause 3, CPWD GCC

C) Hindrance Matrix Example:
| Period | Cause | Department Ref | Days | Attributable To |
|---------|--------|----------------|------|-----------------|

D) Prolongation Claim Skeleton:
- Head A: Staff Costs (salary slips)
- Head B: Equipment Idle (hire invoices)
- Head C: Overheads (method defined)
- Interest Claim under Section 73, Indian Contract Act

14) QUALITY CHECKLIST:
Before final output:
- Party names consistent
- Dates and totals verified
- Each finding linked to a clause/statute
- All deadlines converted to calendar dates
- Annexure list attached
- Short summary included`;

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