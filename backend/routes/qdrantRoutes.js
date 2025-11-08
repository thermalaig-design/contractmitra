// ==================== QDRANT ROUTES ====================
const express = require('express');
const router = express.Router();
const { qdrant, supabase } = require('../config/database');
const { getCollectionName, ensureQdrantInitialized } = require('../utils/helpers');
const { generateEmbedding, splitIntoQuadrants } = require('../utils/vectorUtils');
const { extractTextFromImageWithOCR, extractTextFromScannedPdfWithOCR, visionInitialized } = require('../utils/ocrUtils');
const fetch = require('node-fetch');
const { ensureCollection } = require('../services/qdrantService');

// Create collection
router.post('/create-collection', async (req, res) => {
  try {
    const { projectId, projectName } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    const collectionName = getCollectionName(projectId);
    if (!qdrant) return res.status(500).json({ success: false, error: 'Qdrant client not initialized' });
    await ensureCollection(collectionName, projectId, projectName);

    res.json({
      success: true,
      message: `Collection ready: ${collectionName}`,
      collectionName,
      projectId,
      projectName
    });
  } catch (error) {
    console.error('❌ Collection creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save to Qdrant
router.post('/save-to-qdrant', async (req, res) => {
  try {
    const {
      documentId,
      documentName,
      content,
      projectId,
      projectName,
      documentType,
      documentUrl,
      isImage = false
    } = req.body;

    console.log('📝 Save to Qdrant:', {
      documentId,
      documentName,
      projectId,
      documentType,
      isImage,
      hasContent: !!content,
      contentLength: content?.length || 0
    });

    // Validation
    if (!documentId || !documentName) {
      return res.status(400).json({
        success: false,
        error: 'documentId and documentName required'
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID required'
      });
    }

    // Get collection
    const collectionName = getCollectionName(projectId);
    if (!collectionName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID'
      });
    }

    if (!qdrant) return res.status(500).json({ success: false, error: 'Qdrant client not initialized' });
    console.log('📦 Collection:', collectionName);
    await ensureCollection(collectionName, projectId, projectName);

    // Prepare content
    let embeddingText = documentName;
    let contentForStorage = '';
    let fullContent = '';

    // For images
   if (isImage && documentUrl) {
  console.log('🖼️ Processing image...');
  console.log('   Image URL:', documentUrl);
  
  try {
    // Download image
    const resp = await fetch(documentUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch image (HTTP ${resp.status})`);
    }
    const imgBuffer = await resp.buffer();

    // Run OCR on image buffer
    const descriptionPromise = extractTextFromImageWithOCR(imgBuffer, 'image');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Image processing timeout')), 30000)
    );

    const imageText = await Promise.race([descriptionPromise, timeoutPromise]);

    const cleaned = (imageText || '').toString().trim();
    if (cleaned) {
      embeddingText = `${documentName} ${cleaned}`;
      contentForStorage = cleaned.substring(0, 500);
      fullContent = cleaned.substring(0, 400000);
      console.log('✅ Image OCR text:', cleaned.substring(0, 100));
    } else {
      console.log('⚠️ Image OCR returned empty text');
      const fallback = `${documentName} - Image uploaded on ${new Date().toISOString()}. No text found.`;
      embeddingText = fallback;
      contentForStorage = fallback;
      fullContent = fallback;
    }

  } catch (imageError) {
    console.error('❌ Image processing failed:', imageError.message);
    console.error('   Error details:', imageError);
    
    // Enhanced fallback with more details
    const errorType = imageError.message.includes('timeout') ? 'timeout' : 
                     imageError.message.includes('fetch') ? 'network error' : 
                     imageError.message.includes('billing') ? 'billing issue' :
                     imageError.message.includes('quota') ? 'quota exceeded' :
                     'processing error';
    
    const fallbackText = `${documentName} - Image uploaded on ${new Date().toISOString()}. OCR ${errorType}: ${imageError.message}`;
    
    embeddingText = fallbackText;
    contentForStorage = fallbackText;
    fullContent = fallbackText;
    
    console.log('⚠️ Using fallback text:', fallbackText.substring(0, 100));
    
    // Log helpful debug information
    console.log('💡 Debug Info:');
    console.log('   - Image URL accessible:', documentUrl ? 'Yes' : 'No');
    console.log('   - Vision API initialized:', visionInitialized ? 'Yes' : 'No');
    console.log('   - Error type:', errorType);
  }
}

    // For PDF documents with URL and no provided content: extract directly (no image conversion)
    else if (!isImage && (!content || content.trim().length === 0) && documentType && documentType.toLowerCase() === 'pdf' && documentUrl) {
      console.log('📄 Processing PDF via Document AI (direct) ...');
      try {
        const resp = await fetch(documentUrl);
        if (!resp.ok) throw new Error(`Failed to fetch PDF: HTTP ${resp.status}`);
        const pdfBuffer = await resp.buffer();

        const text = await extractTextFromScannedPdfWithOCR(pdfBuffer, 100);
        const cleanedContent = (text || '')
          .replace(/[\x00-\x1F\x7F]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        console.log(`   Extracted via Document AI: ${cleanedContent.length} chars`);

        embeddingText = `${documentName} ${cleanedContent}`;
        contentForStorage = cleanedContent.substring(0, 500);
        fullContent = cleanedContent.substring(0, 400000);
      } catch (pdfErr) {
        console.error('❌ PDF direct extraction failed:', pdfErr.message);
        const fallback = `${documentName} - PDF uploaded on ${new Date().toISOString()}. OCR error: ${pdfErr.message}`;
        embeddingText = fallback;
        contentForStorage = fallback;
        fullContent = fallback;
      }
    }
    // For documents with provided content
    else if (content) {
      console.log('📄 Processing document content...');

      let cleanedContent = (content || '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // If content looks like placeholder/failure text, re-extract directly from PDF
      const looksLikePlaceholder = /no text could be extracted|scanned pdf detected|ocr processing failed|pdf parsing failed/i.test(cleanedContent);
      if (!isImage && documentType && documentType.toLowerCase() === 'pdf' && documentUrl && looksLikePlaceholder) {
        console.log('🔁 Placeholder content detected. Re-extracting directly from PDF via Document AI...');
        try {
          const resp = await fetch(documentUrl);
          if (!resp.ok) throw new Error(`Failed to fetch PDF: HTTP ${resp.status}`);
          const pdfBuffer = await resp.buffer();
          const directText = await extractTextFromScannedPdfWithOCR(pdfBuffer, 100);
          const directClean = (directText || '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (directClean.length > 0) {
            cleanedContent = directClean;
            console.log('✅ Re-extraction succeeded:', cleanedContent.length, 'chars');
          } else {
            console.log('⚠️ Re-extraction returned empty text, keeping original content');
          }
        } catch (reErr) {
          console.warn('⚠️ Re-extraction failed:', reErr.message);
        }
      }

      console.log(`   Cleaned: ${cleanedContent.length} chars`);

      embeddingText = `${documentName} ${cleanedContent}`;
      contentForStorage = cleanedContent.substring(0, 500);
      fullContent = cleanedContent.substring(0, 400000);

      // Ensure we don't store placeholder text
      if (contentForStorage.includes('-- 1 of 1 --')) {
        console.log('⚠️ Detected placeholder text in content preview, replacing with actual content');
        contentForStorage = cleanedContent.substring(0, 500).replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim() || 'Extracted document content';
      }
      
      // Log more details about the content
      if (cleanedContent.length > 0) {
        console.log(`   Preview: ${cleanedContent.substring(0, Math.min(100, cleanedContent.length)).replace(/\n/g, ' ')}...`);
      } else {
        console.log(`   Preview: (empty content)`);
      }
      console.log(`   Full: ${fullContent.length} chars`);
    } else {
      console.warn('⚠️ No content provided');
    }

    console.log('🔄 Generating embedding...');
    const embedding = await generateEmbedding(embeddingText);
    console.log('✅ Embedding:', embedding.length, 'dimensions');

    // Split into quadrants
    const quadrants = splitIntoQuadrants(fullContent);

    // Prepare payload
    const payload = {
      document_id: documentId,
      document_name: documentName,
      document_type: documentType || 'UNKNOWN',
      project_id: projectId,
      project_name: projectName || 'Unknown Project',
      content_preview: contentForStorage,
      full_content: fullContent,
      content_length: fullContent.length,
      quadrant_1: quadrants[0] || '',
      quadrant_2: quadrants[1] || '',
      quadrant_3: quadrants[2] || '',
      quadrant_4: quadrants[3] || '',
      is_image: isImage,
      document_url: documentUrl || null,
      created_at: new Date().toISOString()
    };

    console.log('💾 Saving to Qdrant...');
    // Save to Qdrant
    await qdrant.upsert(collectionName, {
      wait: true,
      points: [{
        id: documentId,
        vector: embedding,
        payload: payload
      }]
    });

    console.log('✅ Saved to Qdrant');

    // Verify (request only payload; avoid vector to reduce server load)
    try {
      const verify = await qdrant.retrieve(collectionName, { 
        ids: [documentId], 
        with_payload: true, 
        with_vector: false 
      });
      if (verify && verify.length > 0) {
        console.log('✅ Verified in Qdrant');
        console.log('   Content length:', verify[0].payload?.content_length || 0);
      }
    } catch (verifyErr) {
      console.warn('⚠️ Verification failed:', verifyErr.message || verifyErr);
    }

    res.json({
      success: true,
      message: `${isImage ? 'Image' : 'Document'} saved successfully`,
      documentId,
      collectionName,
      projectName,
      isImage,
      vectorSize: embedding.length,
      contentLength: fullContent.length,
      quadrantsStored: quadrants.filter(q => q.length > 0).length
    });

  } catch (error) {
    console.error('❌ Save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search documents
router.post('/search-documents', async (req, res) => {
  try {
    const { query, projectId, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query required'
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID required'
      });
    }

    const collectionName = getCollectionName(projectId);
    console.log('🔍 Searching:', collectionName);
    
    if (!ensureQdrantInitialized(res)) return;
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      return res.json({
        success: true,
        results: [],
        message: 'No documents yet',
        collectionName
      });
    }

    // Generate embedding
    const queryEmbedding = await generateEmbedding(query);

    // Search
    const searchResults = await qdrant.search(collectionName, {
      vector: queryEmbedding,
      limit: parseInt(limit),
      with_payload: true
    });

    // Format results
    const results = searchResults.map(result => ({
      id: result.id,
      score: result.score,
      documentName: result.payload?.document_name,
      documentType: result.payload?.document_type,
      contentPreview: result.payload?.content_preview,
      fullContent: result.payload?.full_content,
      projectName: result.payload?.project_name,
      documentUrl: result.payload?.document_url,
      isImage: result.payload?.is_image
    }));

    res.json({
      success: true,
      results,
      count: results.length,
      query,
      collectionName
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete from Qdrant
router.delete('/delete-from-qdrant/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID required'
      });
    }

    const collectionName = getCollectionName(projectId);
    
    if (!ensureQdrantInitialized(res)) return;

    await qdrant.delete(collectionName, {
      wait: true,
      points: [documentId]
    });

    res.json({
      success: true,
      message: 'Document deleted from Qdrant'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete collection
router.delete('/delete-collection/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID required'
      });
    }

    const collectionName = getCollectionName(projectId);

    if (!ensureQdrantInitialized(res)) return;

    await qdrant.deleteCollection(collectionName);

    res.json({
      success: true,
      message: `Collection deleted: ${collectionName}`
    });

  } catch (error) {
    console.error('Collection delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify collection
router.post('/verify-collection', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    const collectionName = getCollectionName(projectId);

    if (!ensureQdrantInitialized(res)) return;
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      return res.json({
        success: true,
        exists: false,
        documentCount: 0,
        collectionName: collectionName,
        message: 'Collection does not exist yet'
      });
    }

    const collectionInfo = await qdrant.getCollection(collectionName);

    res.json({
      success: true,
      exists: true,
      documentCount: collectionInfo.points_count || 0,
      collectionName: collectionName,
      vectorSize: collectionInfo.config?.params?.vectors?.size
    });

  } catch (error) {
    console.error('Verify collection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check collection
router.post('/check-collection', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    const collectionName = getCollectionName(projectId);

    if (!ensureQdrantInitialized(res)) return;
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      return res.json({
        success: true,
        collectionName: collectionName,
        exists: false,
        documentsCount: 0,
        message: 'Collection does not exist yet'
      });
    }

    const collectionInfo = await qdrant.getCollection(collectionName);

    res.json({
      success: true,
      collectionName: collectionName,
      exists: true,
      documentsCount: collectionInfo.points_count || 0,
      vectorSize: collectionInfo.config?.params?.vectors?.size
    });

  } catch (error) {
    console.error('Check collection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug Qdrant
router.get('/debug-qdrant/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const collectionName = `project_${projectId}`;
    
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);
    
    if (!exists) {
      return res.json({ error: 'Collection not found' });
    }
    
    // Get all documents
    const result = await qdrant.scroll(collectionName, {
      limit: 10,
      with_payload: true,
      with_vector: false
    });
    
    res.json({
      collection: collectionName,
      documents: result.points.map(p => ({
        id: p.id,
        name: p.payload?.document_name,
        hasFullContent: !!p.payload?.full_content,
        contentLength: p.payload?.full_content?.length || 0,
        preview: p.payload?.full_content?.substring(0, 200) || p.payload?.content_preview?.substring(0, 200)
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// List collections
router.get('/collections', async (req, res) => {
  try {
    if (!ensureQdrantInitialized(res)) return;
    const collections = await qdrant.getCollections();

    const collectionsInfo = await Promise.all(
      collections.collections.map(async (c) => {
        try {
          const info = await qdrant.getCollection(c.name);

          let projectInfo = null;
          if (c.name.startsWith('project_')) {
            const projectSlug = c.name.replace('project_', '');
            projectInfo = {
              slug: projectSlug,
              displayName: projectSlug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            };
          }

          return {
            name: c.name,
            pointsCount: info.points_count,
            vectorSize: info.config?.params?.vectors?.size,
            projectInfo: projectInfo
          };
        } catch (err) {
          return {
            name: c.name,
            error: err.message
          };
        }
      })
    );

    res.json({
      success: true,
      collections: collectionsInfo
    });

  } catch (error) {
    console.error('List collections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== HELPER FUNCTION: EXTRACT DATES FROM TEXT ====================
function extractDatesFromText(text = '') {
  const patterns = [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g, // DD/MM/YYYY or DD-MM-YYYY
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g // YYYY-MM-DD
  ];

  const found = new Map();

  patterns.forEach((pat) => {
    const matches = text.matchAll(pat);
    for (const match of matches) {
      const raw = match[0];
      try {
        let parsed = new Date(raw);
        
        // Fallback parsing for DD/MM/YYYY format
        if (isNaN(parsed.getTime())) {
          const parts = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (parts) {
            const dd = parts[1].padStart(2, '0');
            const mm = parts[2].padStart(2, '0');
            const yyyy = parts[3];
            parsed = new Date(`${yyyy}-${mm}-${dd}`);
          }
        }
        
        if (!isNaN(parsed.getTime())) {
          const year = parsed.getFullYear();
          // Only valid dates between 1900-2100
          if (year >= 1900 && year <= 2100) {
            const key = Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
            if (!found.has(key)) {
              found.set(key, {
                originalText: raw,
                date: parsed.toISOString(),
                timestamp: parsed.getTime()
              });
            }
          }
        }
      } catch (e) {
        // ignore invalid dates
      }
    }
  });

  return Array.from(found.values()).sort((a, b) => a.timestamp - b.timestamp);
}


// ==================== GET QDRANT DOCUMENTS ENDPOINT ====================
router.post('/get-qdrant-documents', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    console.log('📄 Fetching Qdrant documents for project:', projectId);

    if (!qdrant) {
      return res.json({
        success: false,
        error: 'Qdrant not initialized',
        documents: []
      });
    }

    const collectionName = getCollectionName(projectId);

    // Check if collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      console.log('⚠️ Collection does not exist:', collectionName);
      return res.json({
        success: true,
        documents: [],
        message: 'No documents indexed yet'
      });
    }

    // Get all documents from collection using scroll
    console.log('🔍 Scrolling through collection:', collectionName);
    
    const result = await qdrant.scroll(collectionName, {
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    if (!result.points || result.points.length === 0) {
      console.log('⚠️ No documents found in collection');
      return res.json({
        success: true,
        documents: [],
        message: 'Collection exists but no documents indexed'
      });
    }

    console.log(`✅ Found ${result.points.length} documents in Qdrant`);

    // Extract document data
    const documents = result.points.map(point => {
      const payload = point.payload || {};
      
      return {
        id: point.id,
        document_name: payload.document_name || 'Unknown',
        document_type: payload.document_type || 'unknown',
        full_content: payload.full_content || '',
        content_preview: payload.content_preview || '',
        content_length: payload.content_length || 0,
        is_image: payload.is_image || false,
        uploaded_at: payload.uploaded_at || null
      };
    });

    // Log document details
    console.log('📊 Documents retrieved:');
    documents.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.document_name} (${doc.document_type}) - ${doc.content_length} chars`);
    });

    res.json({
      success: true,
      documents: documents,
      count: documents.length,
      collectionName: collectionName
    });

  } catch (error) {
    console.error('❌ Error fetching Qdrant documents:', error);
    res.json({
      success: false,
      error: error.message || 'Failed to fetch documents',
      documents: []
    });
  }
});

// ==================== GET PROJECT DATES ENDPOINT ====================
router.post('/get-project-dates', async (req, res) => {
  console.log('📅 [DATE EXTRACTION] Starting...');
  
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      console.log('❌ No projectId provided');
      return res.status(400).json({ 
        success: false, 
        error: 'projectId required' 
      });
    }

    console.log('📋 Project ID:', projectId);
    const collectionName = getCollectionName(projectId);
    console.log('📦 Collection name:', collectionName);

    const allDates = [];

    // ========== 1) GET METADATA DATES FROM SUPABASE ==========
    console.log('🔍 Step 1: Fetching from Supabase...');
    
    if (!supabase) {
      console.log('⚠️ Supabase not available');
    } else {
      try {
        const { data: documents, error: supaError } = await supabase
          .from('documents')
          .select('id, document_name, created_at, updated_at, uploaded_at')
          .eq('project_id', projectId);

        if (supaError) {
          console.log('⚠️ Supabase error:', supaError.message);
        } else if (Array.isArray(documents) && documents.length > 0) {
          console.log(`✅ Found ${documents.length} documents in Supabase`);
          
          documents.forEach(doc => {
            ['created_at', 'updated_at', 'uploaded_at'].forEach(field => {
              if (doc[field]) {
                const dt = new Date(doc[field]);
                if (!isNaN(dt.getTime())) {
                  allDates.push({
                    documentId: doc.id,
                    documentName: doc.document_name,
                    date: dt.toISOString(),
                    originalText: dt.toLocaleDateString('en-US'),
                    context: `Document ${field.replace(/_/g, ' ')}`,
                    source: 'supabase',
                    timestamp: dt.getTime()
                  });
                }
              }
            });
          });
          console.log(`✅ Added ${allDates.length} metadata dates`);
        } else {
          console.log('ℹ️ No documents in Supabase');
        }
      } catch (err) {
        console.error('❌ Supabase query failed:', err.message);
      }
    }

    // ========== 2) GET TEXT-DERIVED DATES FROM QDRANT ==========
    console.log('🔍 Step 2: Fetching from Qdrant...');
    
    if (!qdrant) {
      console.log('⚠️ Qdrant not initialized - returning Supabase dates only');
      return res.json({ 
        success: true, 
        dates: allDates.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
        warning: 'Qdrant not available - showing metadata dates only'
      });
    }

    try {
      // Check if collection exists
      const collections = await qdrant.getCollections();
      const exists = collections.collections.some(c => c.name === collectionName);

      if (!exists) {
        console.log('⚠️ Collection does not exist');
        return res.json({ 
          success: true, 
          dates: allDates.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
          warning: 'Collection not found - showing metadata dates only'
        });
      }

      console.log('✅ Collection exists, scanning documents...');
      
      // Scroll through documents
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let docCount = 0;
      
      while (hasMore) {
        const result = await qdrant.scroll(collectionName, {
          limit,
          offset,
          with_payload: true,
          with_vector: false
        });

        const points = result.points || [];
        console.log(`📄 Batch ${Math.floor(offset/limit) + 1}: Retrieved ${points.length} documents`);
        
        if (points.length === 0) break;

        for (const point of points) {
          docCount++;
          const payload = point.payload || {};
          const documentId = point.id;
          const documentName = payload.document_name || payload.documentName || `Document ${docCount}`;

          // Collect all text fields
          const textFields = [
            payload.full_content,
            payload.content_preview,
            payload.quadrant_1,
            payload.quadrant_2,
            payload.quadrant_3,
            payload.quadrant_4
          ].filter(Boolean);

          const combinedText = textFields.join(' ');

          if (combinedText && combinedText.length > 20) {
            console.log(`   📄 ${docCount}. ${documentName} (${combinedText.length} chars)`);
            
            const extractedDates = extractDatesFromText(combinedText);
            
            if (extractedDates.length > 0) {
              console.log(`      ✅ Found ${extractedDates.length} dates!`);
              
              extractedDates.forEach(dateInfo => {
                const index = combinedText.indexOf(dateInfo.originalText);
                let context = 'Extracted from document content';
                
                if (index !== -1) {
                  const start = Math.max(0, index - 50);
                  const end = Math.min(combinedText.length, index + dateInfo.originalText.length + 50);
                  context = combinedText.substring(start, end).trim();
                }

                allDates.push({
                  documentId,
                  documentName,
                  originalText: dateInfo.originalText,
                  date: dateInfo.date,
                  context: context,
                  source: 'qdrant',
                  timestamp: dateInfo.timestamp
                });
              });
            } else {
              console.log(`      ℹ️ No dates found`);
            }
          }
        }

        if (points.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      console.log(`✅ Scanned ${docCount} documents total`);

    } catch (qdrantErr) {
      console.error('❌ Qdrant error:', qdrantErr.message);
    }

    // ========== 3) DEDUPLICATE AND SORT ==========
    console.log('🔄 Deduplicating dates...');
    
    const seen = new Set();
    const uniqueDates = allDates.filter(item => {
      const key = `${item.documentId || 'unknown'}::${item.timestamp}::${item.originalText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueDates.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    console.log(`✅ FINAL RESULT: ${uniqueDates.length} unique dates found`);
    console.log('   📊 Sources:', {
      supabase: uniqueDates.filter(d => d.source === 'supabase').length,
      qdrant: uniqueDates.filter(d => d.source === 'qdrant').length
    });

    // Log first few dates for debugging
    if (uniqueDates.length > 0) {
      console.log('   📅 Sample dates:');
      uniqueDates.slice(0, 3).forEach((d, i) => {
        console.log(`      ${i+1}. ${d.originalText} (${d.documentName})`);
      });
    }

    return res.json({ 
      success: true, 
      dates: uniqueDates,
      totalFound: uniqueDates.length,
      sources: {
        supabase: uniqueDates.filter(d => d.source === 'supabase').length,
        qdrant: uniqueDates.filter(d => d.source === 'qdrant').length
      }
    });

  } catch (err) {
    console.error('❌ [DATE EXTRACTION] Fatal error:', err);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'Internal server error',
      details: err.stack
    });
  }
});

module.exports = router;