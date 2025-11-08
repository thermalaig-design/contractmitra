// ==================== DOCUMENT ROUTES - PDF-PARSE WITH OCR FOR SCANNED PDFS ====================
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// FIXED: Import extraction utilities with the correct path
// Updated from '../utils/textExtraction' to './textExtraction'
const {
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromExcel,
  extractTextFromImage,
  visionInitialized
} = require('../utils/textExtraction');

// Add import for GCS-based OCR (now modified to save images locally)
const { extractTextFromScannedPdfWithGCS, convertPdfToImages } = require('../utils/ocrUtils');

// ==================== HELPER FUNCTION: FETCH WITH TIMEOUT ====================
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ==================== HELPER: CHECK VISION API STATUS ====================
// ADDED: Function to verify Vision API status and log detailed info
function checkVisionApiStatus() {
  // Check if the Google API JSON file exists
  const apiKeyPath = path.join(__dirname, '../config/googleApi.json');
  const apiKeyExists = fs.existsSync(apiKeyPath);
  
  console.log(`\n📋 ========== VISION API STATUS ==========`);
  console.log(`API Key File: ${apiKeyExists ? '✅ Found' : '❌ Not found'} at ${apiKeyPath}`);
  console.log(`Vision Initialized: ${visionInitialized ? '✅ Yes' : '❌ No'}`);
  console.log(`Current Directory: ${__dirname}`);
  
  if (apiKeyExists) {
    try {
      // Check if the file is valid JSON
      const apiKeyContent = fs.readFileSync(apiKeyPath, 'utf8');
      const apiKeyJson = JSON.parse(apiKeyContent);
      console.log(`API Key Valid: ✅ Yes`);
      console.log(`Project ID: ${apiKeyJson.project_id || 'Not found'}`);
      console.log(`Client Email: ${apiKeyJson.client_email || 'Not found'}`);
    } catch (error) {
      console.log(`API Key Valid: ❌ No - ${error.message}`);
    }
  }
  
  console.log(`==========================================\n`);
  
  return {
    apiKeyExists,
    visionInitialized,
    directory: __dirname
  };
}

// ==================== MAIN ENDPOINT: EXTRACT DOCUMENT TEXT ====================
router.post('/extract-document-text', async (req, res) => {
  try {
    const { documentUrl, documentType } = req.body;
    
    console.log(`\n📃 ========== EXTRACTION REQUEST ==========`);
    console.log(`Type: ${documentType}`);
    console.log(`URL: ${documentUrl?.substring(0, 60)}...`);

    // ADDED: Check Vision API status at the start of each request
    checkVisionApiStatus();

    // Validate input
    if (!documentUrl || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Document URL and type are required',
        text: ''
      });
    }

    // Download document
    console.log('🔄 Downloading document...');
    let response;
    try {
      response = await fetchWithTimeout(documentUrl, {}, 30000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      return res.status(400).json({
        success: false,
        error: `Failed to fetch: ${fetchError.message}`,
        text: ''
      });
    }

    // Try different methods to get the buffer
    console.log('🔄 Getting buffer from response...');
    let buffer;
    try {
      // Method 1: response.buffer()
      buffer = await response.buffer();
      console.log(`✅ Downloaded (method 1): ${buffer.length} bytes`);
    } catch (bufferError) {
      console.warn('⚠️ response.buffer() failed:', bufferError.message);
      try {
        // Method 2: arrayBuffer then convert to Buffer
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log(`✅ Downloaded (method 2): ${buffer.length} bytes`);
      } catch (arrayError) {
        console.error('❌ Both buffer methods failed:', arrayError.message);
        return res.status(400).json({
          success: false,
          error: `Failed to get buffer: ${arrayError.message}`,
          text: ''
        });
      }
    }
    
    console.log(`   Buffer type: ${typeof buffer}`);
    console.log(`   Is Buffer: ${Buffer.isBuffer(buffer)}`);

    let extractedText = '';
    let extractionMethod = 'standard';
    let usedOCR = false;

    try {
      // ==================== PDF HANDLING ====================
      if (documentType.toLowerCase() === 'pdf') {
        console.log('\n📋 PDF Processing Strategy:');
        console.log('   1. Using pdf-parse primarily');
        console.log('   2. OCR fallback for scanned PDFs only');
        
        // Use pdf-parse for PDFs with OCR fallback for scanned PDFs
        console.log('✅ PROCESSING PDF WITH PDF-PARSE (OCR fallback for scanned PDFs)');
        console.log('   📖 PDF processing with pdf-parse');
        console.log('   ⚡ Fast extraction for readable PDFs');
        console.log('   📷 OCR fallback for scanned PDFs');
        
        try {
          console.log('   🔄 Calling extractTextFromPdf with buffer size:', buffer.length);
          extractedText = await extractTextFromPdf(buffer);
          extractionMethod = 'pdf-parse';
          
          // Check if OCR was used (indicated by text content)
          if (extractedText && extractedText.includes('OCR')) {
            usedOCR = true;
            extractionMethod = 'pdf-parse-ocr';
          }
          
          console.log('   🔤 extractTextFromPdf returned text length:', extractedText.length);
          if (extractedText && extractedText.trim().length > 0) {
            // Remove any placeholder text that might have been added
            const cleanExtractedText = extractedText.trim().replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
            console.log(`   ✅ Successfully extracted ${cleanExtractedText.length} characters`);
            // Log more details about the extracted text
            console.log(`   📃 Text preview: "${cleanExtractedText.substring(0, Math.min(100, cleanExtractedText.length)).replace(/\n/g, ' ')}"...`);
            extractedText = cleanExtractedText;
            
            // ADDED: Better logging for scanned PDF detection
            if (usedOCR || extractionMethod === 'pdf-parse-ocr' || extractionMethod === 'direct-ocr') {
              console.log('   📷 OCR was used for text extraction');
            } else {
              console.log('   📖 Standard text extraction was used');
            }
          } else {
            console.warn('   ⚠️ pdf-parse returned empty text');
            
            // ADDED: If pdf-parse failed, try OCR directly as a last resort
            if (visionInitialized) {
              console.log('   📷 Attempting direct OCR as fallback...');
              try {
                extractedText = await extractTextFromScannedPdfWithOCR(buffer);
                usedOCR = true;
                extractionMethod = 'direct-ocr';
                
                if (extractedText && extractedText.trim().length > 0) {
                  console.log(`   ✅ Direct OCR successful: ${extractedText.length} characters`);
                  // Clean the OCR text
                  const cleanOcrText = extractedText.trim().replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
                  console.log(`   📃 OCR text preview: "${cleanOcrText.substring(0, Math.min(100, cleanOcrText.length)).replace(/\n/g, ' ')}"...`);
                  extractedText = cleanOcrText;
                } else {
                  console.warn('   ⚠️ Direct OCR returned empty text');
                  extractedText = 'PDF processed but no text could be extracted. This PDF may be a scanned image or password-protected.';
                }
              } catch (ocrError) {
                console.error('   ❌ Direct OCR failed:', ocrError.message);
                console.error('   ❌ Direct OCR failed details:', ocrError);
                
                // Provide a more specific error message
                let ocrErrorMessage = 'Scanned PDF detected but OCR processing failed.';
                
                if (ocrError.message.includes('billing')) {
                  ocrErrorMessage = 'Scanned PDF detected but OCR failed due to billing issues.';
                } else if (ocrError.message.includes('Bad image data')) {
                  ocrErrorMessage = 'Scanned PDF detected but OCR failed due to incompatible PDF format. The document may be password protected or corrupted.';
                }
                  
                extractedText = `PDF processed but no text could be extracted. ${ocrErrorMessage} This PDF may be a scanned image or password-protected.`;
              }
            } else {
              extractedText = 'PDF processed but no text could be extracted. This PDF may be a scanned image or password-protected.';
            }
          }
        } catch (parseError) {
          console.error('❌ PDF parsing error:', parseError.message);
          extractedText = `PDF parsing failed: ${parseError.message}`;
          extractionMethod = 'pdf-parse-failed';
        }
      }
      
      // ==================== DOCX HANDLING ====================
      else if (documentType.toLowerCase() === 'docx' || documentType.toLowerCase() === 'doc') {
        try {
          console.log('📝 Extracting DOCX...');
          extractedText = await extractTextFromDocx(buffer);
          extractionMethod = 'mammoth';
          
          if (extractedText && extractedText.trim().length > 0) {
            console.log(`   ✅ DOCX extracted: ${extractedText.length} characters`);
          } else {
            console.warn('   ⚠️ DOCX file appears empty');
            extractedText = 'DOCX file appears to be empty.';
          }
        } catch (err) {
          console.error('❌ DOCX extraction error:', err.message);
          extractedText = `DOCX error: ${err.message}`;
        }
      }
      
      // ==================== EXCEL HANDLING ====================
      else if (documentType.toLowerCase() === 'xlsx' || documentType.toLowerCase() === 'xls') {
        try {
          console.log('📊 Extracting Excel...');
          // FIXED: Handle the updated return value from extractTextFromExcel
          const excelResult = extractTextFromExcel(buffer);
          extractedText = excelResult.text;
          const sheetCount = excelResult.sheetCount;
          extractionMethod = 'xlsx';
          
          if (extractedText && extractedText.trim().length > 0) {
            // FIXED: Use the sheet count from the result
            console.log(`   ✅ Excel extracted: ${extractedText.length} characters from ${sheetCount} sheets`);
          } else {
            console.warn('   ⚠️ Excel file appears empty');
            extractedText = 'Excel file appears to be empty.';
          }
        } catch (err) {
          console.error('❌ Excel extraction error:', err.message);
          extractedText = `Excel error: ${err.message}`;
        }
      }
      
      // ==================== TEXT FILE HANDLING ====================
      else if (documentType.toLowerCase() === 'txt') {
        try {
          console.log('📃 Extracting text file...');
          extractedText = buffer.toString('utf-8');
          extractionMethod = 'text';
          
          if (extractedText && extractedText.trim().length > 0) {
            console.log(`   ✅ Text file extracted: ${extractedText.length} characters`);
          } else {
            console.warn('   ⚠️ Text file appears empty');
            extractedText = 'Text file appears to be empty.';
          }
        } catch (err) {
          console.error('❌ Text extraction error:', err.message);
          extractedText = `Text error: ${err.message}`;
        }
      }
      
      // ==================== IMAGE HANDLING WITH OCR ====================
      else if (documentType.toLowerCase() === 'png' || documentType.toLowerCase() === 'jpg' || documentType.toLowerCase() === 'jpeg' || documentType.toLowerCase() === 'tiff' || documentType.toLowerCase() === 'bmp') {
        if (!visionInitialized) {
          console.warn('⚠️ Google Vision API not initialized, using fallback text extraction');
          // Fallback: Try basic text extraction or use document name
          extractedText = `Image file: ${documentName} uploaded on ${new Date().toISOString()}. OCR service not available.`;
          extractionMethod = 'image-fallback';
        } else {
          try {
            console.log(`📷 Extracting text from ${documentType.toUpperCase()} image with OCR...`);
            extractedText = await extractTextFromImage(buffer, documentType);
            extractionMethod = 'ocr-image';
            usedOCR = true;
            
            if (extractedText && extractedText.trim().length > 0) {
              // Check if there's a billing error in the response
              if (extractedText.includes('billing')) {
                console.warn('⚠️ Google Cloud billing not enabled for OCR');
                extractionMethod = 'ocr-billing-error';
              }
              console.log(`   ✅ OCR extracted: ${extractedText.length} characters`);
            } else {
              console.warn('   ⚠️ OCR found no text in image');
              extractedText = `Image processed but no text could be extracted from ${documentName}.`;
            }
          } catch (err) {
            console.error('❌ Image OCR extraction error:', err.message);
            // Check for specific billing errors
            if (err.message.includes('PERMISSION_DENIED') && err.message.includes('billing')) {
              // Fallback when billing is not enabled
              extractedText = `Image file: ${documentName} processed. OCR service requires billing to be enabled on Google Cloud project.`;
              extractionMethod = 'ocr-billing-error';
            } else {
              // Fallback when OCR fails
              extractedText = `Image file: ${documentName} processed with OCR error: ${err.message}`;
              extractionMethod = 'ocr-error';
            }
          }
        }
      }
      
      // ==================== UNSUPPORTED FILE TYPE ====================
      else {
        console.warn(`⚠️ Unsupported file type: ${documentType}`);
        extractedText = `Unsupported file type: ${documentType}. Please upload PDF, DOCX, XLSX, TXT, or image files (PNG, JPG, JPEG, TIFF, BMP).`;
        extractionMethod = 'unsupported';
      }

      // ==================== FINAL LOGGING ====================
      console.log(`\n✅ EXTRACTION COMPLETE`);
      console.log(`   Method: ${extractionMethod}`);
      console.log(`   Characters: ${extractedText?.length || 0}`);
      console.log(`   Used OCR: ${usedOCR}`);
      
      if (usedOCR) {
        console.log(`   🎉 Used OCR for text extraction!`);
      } else if (extractionMethod === 'pdf-parse') {
        console.log(`   🎉 Used pdf-parse - Fast and free processing!`);
      }
      
      console.log(`   Preview: ${extractedText?.substring(0, 100)?.replace(/\n/g, ' ')}...`);
      console.log(`========================================\n`);

      // Fallback for empty text
      if (!extractedText || extractedText.trim().length === 0) {
        extractedText = `${documentType.toUpperCase()} uploaded ${new Date().toISOString()}. No text extracted.`;
      }

      // Send successful response
      res.json({
        success: true,
        text: extractedText,
        textLength: extractedText.length,
        extractionMethod,
        usedOCR
      });
      
    } catch (extractionError) {
      console.error('❌ Extraction error:', extractionError.message);
      if (extractionError.stack) {
        console.error('   Stack:', extractionError.stack);
      }
      
      // Send error response with fallback text
      res.json({
        success: true,
        text: `Processing error: ${extractionError.message}`,
        textLength: 100,
        extractionMethod: 'error-fallback',
        error: extractionError.message,
        usedOCR: false
      });
    }
  } catch (error) {
    console.error('❌ Route error:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    
    // Send error response
    res.status(500).json({
      success: false,
      text: `Failed: ${error.message}`,
      textLength: 0,
      error: error.message,
      usedOCR: false
    });
  }
});

// ==================== GCS-BASED OCR ENDPOINT (MODIFIED TO SAVE IMAGES LOCALLY) ====================
router.post('/extract-document-text-gcs', async (req, res) => {
  try {
    const { documentUrl, documentType, documentName } = req.body;
    
    console.log(`\n☁️ ========== LOCAL OCR EXTRACTION REQUEST (NO GCS) ==========`);
    console.log(`Type: ${documentType}`);
    console.log(`Name: ${documentName}`);
    console.log(`URL: ${documentUrl?.substring(0, 60)}...`);

    // Validate input
    if (!documentUrl || !documentType || !documentName) {
      return res.status(400).json({
        success: false,
        error: 'Document URL, type, and name are required',
        text: ''
      });
    }

    // Only process PDFs with this method
    if (documentType.toLowerCase() !== 'pdf') {
      return res.status(400).json({
        success: false,
        error: 'Local OCR is only available for PDF documents',
        text: ''
      });
    }

    // Download document
    console.log('🔄 Downloading document...');
    let response;
    try {
      response = await fetchWithTimeout(documentUrl, {}, 30000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      return res.status(400).json({
        success: false,
        error: `Failed to fetch: ${fetchError.message}`,
        text: ''
      });
    }

    // Get buffer
    console.log('🔄 Getting buffer from response...');
    let buffer;
    try {
      buffer = await response.buffer();
      console.log(`✅ Downloaded: ${buffer.length} bytes`);
    } catch (bufferError) {
      console.error('❌ Buffer error:', bufferError.message);
      return res.status(400).json({
        success: false,
        error: `Failed to get buffer: ${bufferError.message}`,
        text: ''
      });
    }

    let extractedText = '';
    let extractionMethod = 'local-ocr';
    let usedOCR = true;
    let savedImages = [];

    try {
      console.log('📸 Processing PDF with LOCAL OCR (images saved locally)...');
      const result = await extractTextFromScannedPdfWithGCS(buffer, documentName);
      
      // The result now contains both text and image paths
      extractedText = result.text;
      savedImages = result.images || [];
      
      if (extractedText && extractedText.trim().length > 0) {
        console.log(`✅ Local OCR successful: ${extractedText.length} characters`);
      } else {
        console.warn('⚠️ Local OCR returned empty text');
        extractedText = 'PDF processed with local OCR but no text could be extracted.';
      }
    } catch (ocrError) {
      console.error('❌ Local OCR error:', ocrError.message);
      extractedText = `Local OCR failed: ${ocrError.message}`;
      extractionMethod = 'local-ocr-failed';
      usedOCR = false;
    }

    console.log(`\n✅ LOCAL OCR EXTRACTION COMPLETE`);
    console.log(`   Method: ${extractionMethod}`);
    console.log(`   Characters: ${extractedText?.length || 0}`);
    console.log(`   Used OCR: ${usedOCR}`);
    console.log(`   Saved Images: ${savedImages.length}`);
    console.log(`   Preview: ${extractedText?.substring(0, 100)?.replace(/\n/g, ' ')}...`);
    console.log(`========================================\n`);

    // Send response with both text and image paths
    res.json({
      success: true,
      text: extractedText,
      textLength: extractedText.length,
      extractionMethod,
      usedOCR,
      images: savedImages // Include the saved image paths
    });
    
  } catch (error) {
    console.error('❌ Local OCR Route error:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    
    res.status(500).json({
      success: false,
      text: `Failed: ${error.message}`,
      textLength: 0,
      error: error.message,
      usedOCR: false
    });
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================
router.get('/health', (req, res) => {
  // ADDED: Check Vision API status for the health endpoint
  const apiStatus = checkVisionApiStatus();
  
  res.json({
    status: 'ok',
    service: 'document-extraction',
    timestamp: new Date().toISOString(),
    methods: {
      'pdf-parse': 'For PDF files (with OCR fallback for scanned PDFs)',
      'mammoth': 'For DOCX files',
      'xlsx': 'For Excel files',
      'text': 'For TXT files',
      'ocr-image': 'For image files (PNG, JPG, JPEG, TIFF, BMP)'
    },
    ocrStatus: visionInitialized ? 'available' : 'unavailable',
    apiKeyFile: apiStatus.apiKeyExists ? 'found' : 'missing',
    notes: [
      'Readable PDFs processed with pdf-parse for fast extraction',
      'Scanned PDFs automatically detected and processed with OCR',
      'Image files processed with Google Vision OCR',
      'OCR only used when necessary to minimize costs',
      'Enhanced scanned PDF detection with quadrant analysis'
    ]
  });
});

module.exports = router;