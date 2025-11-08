// Modified ocrUtils.js with optimized PDF splitting for 50 pages
// ==================== OCR WITH GOOGLE DOCUMENT AI FOR SCANNED PDFS ====================
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

// Initialize Google Document AI client
let documentAIClient = null;
let documentAIInitialized = false;

// Initialize Google Vision client (for images only)
let visionClient = null;
let visionInitialized = false;

// Your Google Cloud project details
// IMPORTANT: Prefer env vars to avoid hardcoding project/processor
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || 'contract-mitra';
const LOCATION = process.env.GOOGLE_LOCATION || 'us'; // e.g. 'us', 'eu'
const PROCESSOR_ID = process.env.GOOGLE_PROCESSOR_ID || '1214f47edb74d837';

// Maximum pages per chunk for Document AI (15 pages per chunk to avoid limit)
const MAX_PAGES_PER_CHUNK = 15;

try {
  const possiblePaths = [
    path.join(__dirname, 'googleApi.json'),
    path.join(__dirname, '../config/googleApi.json'),
    path.join(__dirname, '../googleApi.json'),
    path.join(__dirname, '../../config/googleApi.json')
  ];
  
  let keyPath = null;
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      keyPath = tryPath;
      break;
    }
  }
  
  if (keyPath) {
    console.log('[OCR] 🔑 Google API key found at:', keyPath);
    
    // Initialize Document AI client for PDFs
    try {
      // Use regional endpoint based on LOCATION; e.g. 'us-documentai.googleapis.com'
      const apiEndpoint = `${LOCATION}-documentai.googleapis.com`;
      documentAIClient = new DocumentProcessorServiceClient({
        keyFilename: keyPath,
        apiEndpoint
      });
      documentAIInitialized = true;
      console.log('[OCR] ✅ Google Document AI initialized (endpoint:', apiEndpoint, ')');
    } catch (docAiError) {
      console.error('[OCR] ⚠️ Document AI init failed:', docAiError.message);
      documentAIInitialized = false;
    }
    
    // Initialize Vision client for images
    try {
      visionClient = new ImageAnnotatorClient({ 
        keyFilename: keyPath 
      });
    visionInitialized = true;
    console.log('[OCR] ✅ Google Vision initialized');
    } catch (visionError) {
      console.error('[OCR] ⚠️ Vision init failed:', visionError.message);
      visionInitialized = false;
    }
  } else {
    console.error('[OCR] ❌ Google API key not found');
  }
} catch (error) {
  console.error('[OCR] ❌ Init failed:', error.message);
}

// ==================== CHECK DEPENDENCIES ====================
let pdfjsLib = null;
let Canvas = null;
let sharp = null;

// Initialize dependencies synchronously
try {
  pdfjsLib = require('pdfjs-dist/build/pdf.mjs');
  console.log('[OCR] ✅ pdfjs-dist available');
} catch (e) {
  try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    console.log('[OCR] ✅ pdfjs-dist available (legacy)');
  } catch (e2) {
    try {
      pdfjsLib = require('pdfjs-dist');
      console.log('[OCR] ✅ pdfjs-dist available (main)');
    } catch (e3) {
      console.error('[OCR] ❌ pdfjs-dist missing');
    }
  }
}

try {
  Canvas = require('canvas');
  console.log('[OCR] ✅ canvas available');
} catch (e) {
  console.error('[OCR] ❌ canvas missing');
}

try {
  sharp = require('sharp');
  console.log('[OCR] ✅ sharp available');
} catch (e) {
  console.log('[OCR] ⚠️ sharp not available (optional)');
}

// ==================== CHECK IF PDF IS SCANNED ====================
function isPdfScanned(extractedText, pdfBuffer) {
  console.log('[SCAN-CHECK] 🔍 Checking if PDF is scanned...');
  
  // If no text extracted, definitely scanned
  if (!extractedText || extractedText.trim().length === 0) {
    console.log('[SCAN-CHECK]    ❌ No text found - SCANNED');
    return true;
  }
  
  // Calculate text density (chars per KB)
  const bufferSizeKB = pdfBuffer.length / 1024;
  const textDensity = extractedText.length / bufferSizeKB;
  
  console.log('[SCAN-CHECK]    Text length:', extractedText.length);
  console.log('[SCAN-CHECK]    PDF size:', bufferSizeKB.toFixed(2), 'KB');
  console.log('[SCAN-CHECK]    Density:', textDensity.toFixed(2), 'chars/KB');
  
  // If density is very low, it's likely scanned
  // Typical readable PDFs have 200+ chars/KB
  const isScanned = textDensity < 50;
  
  console.log('[SCAN-CHECK]    Result:', isScanned ? 'SCANNED 📷' : 'READABLE 📖');
  return isScanned;
}

// ==================== EXTRACT TEXT FROM SCANNED PDF WITH DOCUMENT AI ====================
async function extractTextFromScannedPdfWithDocumentAI(buffer, maxPages = 100) {
  console.log('[DOC-AI] 🚀 ========== STARTING DOCUMENT AI OCR ==========');
  console.log('[DOC-AI]    Size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('[DOC-AI]    Max pages:', maxPages);
  
  if (!documentAIInitialized) {
    throw new Error('Google Document AI not initialized. Please check your API credentials.');
  }
  
  // Quick client-side validations with helpful hints
  const sizeMB = buffer.length / 1024 / 1024;
  if (sizeMB > 20) {
    console.warn('[DOC-AI] ⚠️ PDF larger than 20MB. Online processing may fail. Consider reducing size or using batch (GCS) processing.');
  }
  
  const overallStart = Date.now();
  
  try {
    // Build the processor name (must match the region where the processor was created)
    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
    
    console.log('[DOC-AI] 📄 Processing document with Document AI...');
    console.log('[DOC-AI]    Processor:', name);
    
    // Convert buffer to base64
    const encodedContent = buffer.toString('base64');
    
    // Prepare the request
    const request = {
      name,
      rawDocument: {
        content: encodedContent,
        mimeType: 'application/pdf',
      },
    };
    
    console.log('[DOC-AI] 🔤 Sending request to Document AI...');
    const startTime = Date.now();
    
    // Process the document
    const [result] = await documentAIClient.processDocument(request);
    const document = result.document;
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('[DOC-AI] ✅ Document AI processing completed in', processingTime, 'seconds');
    
    // Extract text from the document
    let extractedText = '';
    
    if (document.text) {
      extractedText = document.text;
      console.log('[DOC-AI] ✅ Extracted text length:', extractedText.length, 'characters');
    } else {
      console.warn('[DOC-AI] ⚠️ No text found in document');
      throw new Error('No text could be extracted from the PDF');
    }
    
    // Log page information if available
    if (document.pages && document.pages.length > 0) {
      console.log('[DOC-AI] 📄 Total pages processed:', document.pages.length);
      
      // Log confidence scores
      const confidenceScores = document.pages.map(page => {
        if (page.blocks && page.blocks.length > 0) {
          const avgConfidence = page.blocks.reduce((sum, block) => 
            sum + (block.layout?.confidence || 0), 0) / page.blocks.length;
          return (avgConfidence * 100).toFixed(1);
        }
        return 'N/A';
      });
      
      console.log('[DOC-AI] 📊 Confidence scores by page:', confidenceScores.join('%, ') + '%');
    }
    
    const totalTime = ((Date.now() - overallStart) / 1000).toFixed(2);
    
    console.log('[DOC-AI] ✅ ========== DOCUMENT AI COMPLETE ==========');
    console.log('[DOC-AI]    Total time:', totalTime, 'seconds');
    console.log('[DOC-AI]    Characters extracted:', extractedText.length);
    
    // Preview
    if (extractedText.length > 200) {
      console.log('[DOC-AI]    Preview:', extractedText.substring(0, 200).replace(/\n/g, ' ') + '...');
    } else {
      console.log('[DOC-AI]    Preview:', extractedText);
    }
    
    return extractedText.trim();
    
  } catch (error) {
    console.error('[DOC-AI] ❌ ========== FAILED ==========');
    console.error('[DOC-AI] ❌ Error:', error.message);
    
    // Add region/processor guidance for common user mistakes
    if (error.message.includes('The request was sent to the wrong regional endpoint') ||
        error.message.toLowerCase().includes('regional') || error.message.includes('api endpoint')) {
      console.error('[DOC-AI] ❌ Hint: LOCATION must match processor region (and client apiEndpoint).');
    }
    
    // Provide helpful error messages
    if (error.message.includes('PERMISSION_DENIED')) {
      throw new Error('Permission denied. Please enable Document AI API and check your service account permissions.');
    } else if (error.message.includes('NOT_FOUND')) {
      throw new Error('Processor not found. Verify GOOGLE_PROJECT_ID, GOOGLE_LOCATION, GOOGLE_PROCESSOR_ID, and endpoint region.');
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      throw new Error('Document AI quota exceeded. Please check your billing and quota limits.');
    } else {
      throw new Error(`Document AI processing failed: ${error.message}`);
    }
  }
}

// ==================== SPLIT PDF INTO CHUNKS FOR DOCUMENT AI ====================
// Optimized for handling up to 50 pages or more
async function splitAndProcessLargePdf(buffer, maxPagesPerChunk = MAX_PAGES_PER_CHUNK) {
  console.log('[SPLIT-PDF] 🔪 Splitting large PDF for Document AI processing...');
  
  try {
    // Load the PDF using pdf-lib
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`[SPLIT-PDF] 📄 Total pages: ${totalPages}`);
    
    if (totalPages <= maxPagesPerChunk) {
      // No need to split, just process normally
      console.log('[SPLIT-PDF] ✅ PDF is small enough, processing directly');
      return await extractTextFromScannedPdfWithDocumentAI(buffer, totalPages);
    }
    
    // Calculate number of chunks needed
    const numChunks = Math.ceil(totalPages / maxPagesPerChunk);
    console.log(`[SPLIT-PDF] 📚 Splitting into ${numChunks} chunks of ${maxPagesPerChunk} pages`);
    
    let allText = '';
    
    // Process each chunk
    for (let i = 0; i < numChunks; i++) {
      const startPage = i * maxPagesPerChunk;
      const endPage = Math.min((i + 1) * maxPagesPerChunk, totalPages);
      
      console.log(`[SPLIT-PDF] 🔄 Processing chunk ${i+1}/${numChunks} (pages ${startPage+1}-${endPage})`);
      
      // Create a new PDF with just these pages
      const chunkPdf = await PDFDocument.create();
      
      // Copy pages from the original document
      const pagesToCopy = [];
      for (let j = startPage; j < endPage; j++) {
        pagesToCopy.push(j);
      }
      
      const copiedPages = await chunkPdf.copyPages(pdfDoc, pagesToCopy);
      
      // Add copied pages to the new document
      copiedPages.forEach(page => chunkPdf.addPage(page));
      
      // Save the chunk to a buffer
      const chunkBuffer = Buffer.from(await chunkPdf.save());
      
      // Process this chunk with Document AI
      console.log(`[SPLIT-PDF] 🧠 OCR processing chunk ${i+1}...`);
      try {
        const chunkText = await extractTextFromScannedPdfWithDocumentAI(chunkBuffer, maxPagesPerChunk);
        
        // Add to combined result with page markers
        allText += `\n\n-- PAGES ${startPage+1} TO ${endPage} --\n\n${chunkText}`;
        
        console.log(`[SPLIT-PDF] ✅ Chunk ${i+1} processed successfully: ${chunkText.length} characters`);
      } catch (chunkError) {
        console.error(`[SPLIT-PDF] ⚠️ Error processing chunk ${i+1}:`, chunkError.message);
        allText += `\n\n-- PAGES ${startPage+1} TO ${endPage} --\n\n[ERROR: ${chunkError.message}]`;
      }
      
      // Small delay between chunks to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('[SPLIT-PDF] ✅ Finished processing all chunks');
    console.log('[SPLIT-PDF]    Total characters:', allText.length);
    return allText.trim();
    
  } catch (error) {
    console.error('[SPLIT-PDF] ❌ Error splitting PDF:', error.message);
    throw error;
  }
}

// ==================== FALLBACK: EXTRACT TEXT FROM SCANNED PDF WITH VISION API ====================
async function extractTextFromScannedPdfWithVision(buffer, maxPages = 100) {
  console.log('[OCR-VISION] 🚀 ========== STARTING VISION API OCR ==========');
  console.log('[OCR-VISION]    Size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
  
  if (!visionInitialized) {
    throw new Error('Google Vision API not initialized');
  }
  
  const overallStart = Date.now();
  
  try {
    // Convert PDF to images
    console.log('[OCR-VISION] 🖼️ Converting PDF to images...');
    const conversionStart = Date.now();
    const images = await convertPdfToImages(buffer, maxPages);
    const conversionTime = ((Date.now() - conversionStart) / 1000).toFixed(2);
    
    console.log('[OCR-VISION]    Conversion completed in', conversionTime, 'seconds');
    console.log('[OCR-VISION]    Generated', images.length, 'images');
    
    if (images.length === 0) {
      throw new Error('No images could be generated from PDF');
    }
    
    // Filter out failed images
    const validImages = images.filter(img => img.buffer !== null);
    if (validImages.length === 0) {
      throw new Error('No valid images generated from PDF');
    }
    
    console.log('[OCR-VISION] 📸 Processing', validImages.length, 'images with Vision API...');
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Process each image
    for (const img of validImages) {
      try {
        const result = await ocrSingleImage(img.buffer, img.pageNum);
        
        if (result.success && result.text.length > 0) {
          results.push(result.text);
          successCount++;
          console.log(`[OCR-VISION]    ✅ Page ${img.pageNum}: ${result.text.length} chars`);
        } else {
          failCount++;
          console.warn(`[OCR-VISION]    ⚠️ Page ${img.pageNum}: No text found`);
        }
      } catch (pageError) {
        console.error(`[OCR-VISION]    ❌ Page ${img.pageNum}:`, pageError.message);
        failCount++;
      }
    }
    
    if (successCount === 0) {
      throw new Error('Vision API failed for all pages. No text could be extracted.');
    }
    
    const fullText = results.join('\n\n--- Page Break ---\n\n');
    const totalTime = ((Date.now() - overallStart) / 1000).toFixed(2);
    
    console.log('[OCR-VISION] ✅ ========== VISION API COMPLETE ==========');
    console.log('[OCR-VISION]    Total time:', totalTime, 'seconds');
    console.log('[OCR-VISION]    Characters:', fullText.length);
    console.log('[OCR-VISION]    Success rate:', ((successCount/validImages.length)*100).toFixed(0) + '%');
    
    return fullText;
    
  } catch (error) {
    console.error('[OCR-VISION] ❌ ========== FAILED ==========');
    console.error('[OCR-VISION] ❌ Error:', error.message);
    throw error;
  }
}

// ==================== SINGLE IMAGE OCR WITH VISION API ====================
async function ocrSingleImage(buffer, pageNum) {
  try {
    const base64 = buffer.toString('base64');
    const [result] = await visionClient.textDetection({
      image: { content: base64 }
    });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    let text = '';
    if (result.fullTextAnnotation?.text) {
      text = result.fullTextAnnotation.text.trim();
    } else if (result.textAnnotations?.[0]?.description) {
      text = result.textAnnotations[0].description.trim();
    }
    
    return {
      success: text.length > 0,
      text: text || '',
      pageNum
    };
    
  } catch (error) {
    console.error(`[OCR-VISION]       ❌ OCR failed for page ${pageNum}:`, error.message);
    return {
      success: false,
      text: '',
      pageNum,
      error: error.message
    };
  }
}

// ==================== PDF TO IMAGES ====================
async function convertPdfToImages(pdfBuffer, maxPages = 100) {
  console.log('[PDF2IMG] 📄 Converting PDF to images...');
  
  if (!pdfjsLib || !Canvas) {
    throw new Error('pdfjs-dist or canvas not available');
  }
  
  try {
    const getDocumentFunction = pdfjsLib.getDocument || 
                               pdfjsLib.default?.getDocument || 
                               pdfjsLib;
    
    const loadingTask = getDocumentFunction({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true
    });
    
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const numPages = Math.min(totalPages, maxPages);
    
    console.log('[PDF2IMG]    Total pages:', totalPages);
    console.log('[PDF2IMG]    Processing:', numPages);
    
    const images = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const scale = 2.0; // 300 DPI for better OCR
        const viewport = page.getViewport({ scale });
        
        const canvas = Canvas.createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, viewport.width, viewport.height);
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        const pngBuffer = canvas.toBuffer('image/png');
        
        images.push({ pageNum, buffer: pngBuffer });
        console.log(`[PDF2IMG]       ✅ Page ${pageNum}`);
        
      } catch (pageError) {
        console.error(`[PDF2IMG]       ❌ Page ${pageNum}:`, pageError.message);
        images.push({ pageNum, buffer: null, error: pageError.message });
      }
    }
    
    return images;
    
  } catch (error) {
    console.error('[PDF2IMG] ❌ Conversion failed:', error.message);
    throw error;
  }
}

// ==================== IMAGE OCR WITH VISION API ====================
async function extractTextFromImageWithOCR(buffer, mimeType) {
  if (!visionInitialized) {
    throw new Error('Google Vision not initialized');
  }
  
  try {
    console.log(`[OCR] 📷 Processing ${mimeType}...`);
    
    const base64 = buffer.toString('base64');
    const [result] = await visionClient.textDetection({
      image: { content: base64 }
    });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    let text = '';
    if (result.fullTextAnnotation?.text) {
      text = result.fullTextAnnotation.text.trim();
    } else if (result.textAnnotations?.[0]?.description) {
      text = result.textAnnotations[0].description.trim();
    }
    
    console.log('[OCR]    ✅', text.length, 'chars');
    return text || 'No text found in image';
    
  } catch (error) {
    console.error('[OCR] ❌', error.message);
    throw error;
  }
}

// ==================== MAIN FUNCTION: EXTRACT TEXT FROM SCANNED PDF ====================
// Enhanced to automatically handle PDFs up to 50 pages by splitting into chunks
async function extractTextFromScannedPdfWithOCR(buffer, maxPages = 100) {
  console.log('[OCR] 🎯 Starting OCR for scanned PDF...');
  
  // Determine if we should try to split the PDF based on the page count
  let pageCount = 0;
  try {
    // Try to get the page count from the PDF
    const pdfDoc = await PDFDocument.load(buffer);
    pageCount = pdfDoc.getPageCount();
    console.log(`[OCR] 📄 PDF has ${pageCount} pages`);
    
    // If PDF has more than MAX_PAGES_PER_CHUNK pages, use the splitting method with Document AI
    if (pageCount > MAX_PAGES_PER_CHUNK && documentAIInitialized) {
      console.log(`[OCR] 📏 PDF is larger than ${MAX_PAGES_PER_CHUNK} pages, using PDF splitting technique for up to 50 pages`);
      try {
        return await splitAndProcessLargePdf(buffer, MAX_PAGES_PER_CHUNK);
      } catch (splitError) {
        console.error('[OCR] ⚠️ PDF splitting failed:', splitError.message);
        console.log('[OCR] 🔄 Falling back to standard methods...');
      }
    }
  } catch (pageCountError) {
    console.warn('[OCR] ⚠️ Could not determine page count:', pageCountError.message);
  }
  
  // Continue with standard processing if not using split method
  // Try Document AI first (better for PDFs) if it's properly initialized
  if (documentAIInitialized) {
    try {
      console.log('[OCR] 📄 Using Google Document AI (recommended for PDFs)...');
      return await extractTextFromScannedPdfWithDocumentAI(buffer, maxPages);
    } catch (docAiError) {
      console.error('[OCR] ⚠️ Document AI failed:', docAiError.message);
      // Always try Vision API as fallback, even if Document AI fails due to permissions
      console.log('[OCR] 📄 Falling back to Vision API...');
    }
  }
  
  // Fallback to Vision API
  if (visionInitialized) {
    console.log('[OCR] 📷 Using Google Vision API (fallback)...');
    return await extractTextFromScannedPdfWithVision(buffer, maxPages);
  }
  
  throw new Error('Neither Document AI nor Vision API are initialized');
}

// ==================== EXPORTS ====================
module.exports = {
  isPdfScanned,
  extractTextFromScannedPdfWithOCR, // Main function - tries Document AI then Vision
  extractTextFromScannedPdfWithDocumentAI, // Document AI only
  extractTextFromScannedPdfWithVision, // Vision API only
  extractTextFromImageWithOCR,
  convertPdfToImages,
  splitAndProcessLargePdf, // PDF splitting for large documents
  visionInitialized,
  documentAIInitialized,
  MAX_PAGES_PER_CHUNK // Export the chunk size constant
};