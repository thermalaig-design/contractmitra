// ==================== TEXT EXTRACTION UTILITIES (WITH FULL OCR SUPPORT) ====================
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const fetch = require('node-fetch');

// Import OCR utilities
const { extractTextFromImageWithOCRCombined, visionInitialized } = require('./ocrUtils');

// ==================== PDF PARSE SETUP ====================
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('[textExtraction] pdf-parse loaded:', pdfParse ? '✅' : '❌');
} catch (error) {
  console.error('[textExtraction] ❌ Failed to load pdf-parse:', error.message);
  pdfParse = null;
}

// ==================== PDF EXTRACTION WITH FULL OCR ====================
async function extractTextFromPdf(buffer) {
  if (!pdfParse) {
    throw new Error('pdf-parse not available');
  }
  
  try {
    console.log('[textExtraction] 📖 Extracting text from PDF...');
    console.log('[textExtraction]    Buffer size:', buffer.length, 'bytes');
    
    // Check if buffer is valid
    if (!buffer || buffer.length === 0) {
      console.log('[textExtraction]    ⚠️ Empty buffer provided');
      return '';
    }
    
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    
    // Try to parse PDF with pdf-parse
    const pdfParser = new pdfParse(uint8Array);
    await pdfParser.load(uint8Array);
    const textResult = await pdfParser.getText();
    
    // Extract text properly
    let text = '';
    if (typeof textResult === 'string') {
      text = textResult.trim();
    } else if (textResult && typeof textResult === 'object' && textResult.text) {
      text = textResult.text.trim();
    }
    
    console.log('[textExtraction]    Initial extracted text length:', text.length);
    
    // Check if this is a scanned PDF that needs OCR
    if (visionInitialized) {
      const isScanned = isPdfScanned(text, buffer);
      
      if (isScanned) {
        console.log('[textExtraction]    📷 Scanned PDF detected, using OCR for FULL TEXT extraction...');
        try {
          const ocrText = await extractTextFromScannedPdfWithOCR(buffer);
          
          if (ocrText && ocrText.trim().length > 0) {
            console.log('[textExtraction]    ✅ OCR successful - extracted FULL TEXT');
            console.log('[textExtraction]    OCR text length:', ocrText.length, 'characters');
            console.log('[textExtraction]    OCR text preview (first 300 chars):', ocrText.substring(0, 300).replace(/\n/g, ' '));
            // Clean up the OCR text
            const cleanOcrText = ocrText.replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
            return cleanOcrText; // Return clean OCR text
          } else {
            console.log('[textExtraction]    ⚠️ OCR returned no text');
            // Even minimal text is better than nothing
            if (text && text.trim().length > 0) {
              console.log('[textExtraction]    Returning minimal text:', text.length, 'characters');
              // Clean up the text
              const cleanText = text.replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
              return cleanText;
            }
            return 'Scanned PDF processed but no text could be extracted. The document may be password protected, corrupted, or contain only images without text.';
          }
        } catch (ocrError) {
          console.error('[textExtraction]    ❌ OCR failed:', ocrError.message);
          
          // Follow OCR Failure Handling Protocol - preserve and return the originally extracted text
          const errorMessage = ocrError.message.includes('billing') ? 
            'Scanned PDF detected but OCR failed due to billing issues. Please enable billing on Google Cloud.' :
            ocrError.message.includes('No image present') ?
            'Scanned PDF detected but OCR processing failed. Google Vision API cannot process this PDF directly. Please convert the PDF to images (JPEG/PNG) before uploading, or contact the system administrator.' :
            'Scanned PDF detected but OCR processing failed. This PDF may be password protected, corrupted, or contain only images without text. Error: ' + ocrError.message;
          
          // Even when OCR fails, return the original text if available
          if (text && text.trim().length > 0) {
            // Clean up the text
            const cleanText = text.replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
            return `${cleanText}\n\n[OCR NOTE: ${errorMessage}]`;
          }
          
          return errorMessage;
        }
      } else {
        console.log('[textExtraction]    📖 PDF appears to be readable, using extracted text');
        console.log('[textExtraction]    Text length:', text.length, 'characters');
      }
    }
    
    if (text && text.length > 0) {
      console.log('[textExtraction]    ✅ Extracted', text.length, 'characters');
      // Clean up the text
      const cleanText = text.replace(/\s*-- \d+ of \d+ --\s*/g, ' ').trim();
      return cleanText;
    } else {
      console.log('[textExtraction]    ⚠️ No text found');
      return '';
    }
    
  } catch (error) {
    console.error('[textExtraction] ❌ PDF extraction error:', error.message);
    
    if (error.message.includes('Invalid PDF')) {
      console.error('[textExtraction] ❌ Invalid or corrupted PDF file');
    } else if (error.message.includes('Password')) {
      console.error('[textExtraction] ❌ Password-protected PDF');
    }
    
    return '';
  }
}

// ==================== DOCX EXTRACTION ====================
async function extractTextFromDocx(buffer) {
  try {
    console.log('[textExtraction] 📝 Extracting DOCX...');
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value || '').trim();
    
    if (text) {
      console.log('[textExtraction]    ✅ Extracted', text.length, 'characters');
    } else {
      console.log('[textExtraction]    ⚠️ No text found');
    }
    
    return text;
  } catch (error) {
    console.error('[textExtraction] ❌ DOCX extraction error:', error.message);
    return '';
  }
}

// ==================== EXCEL EXTRACTION ====================
function extractTextFromExcel(buffer) {
  try {
    console.log('[textExtraction] 📊 Extracting Excel...');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const text = XLSX.utils.sheet_to_txt(sheet);
      return `=== Sheet: ${sheetName} ===\n${text}`;
    });
    
    const combined = sheets.join('\n\n').trim();
    if (combined) {
      console.log('[textExtraction]    ✅ Extracted', combined.length, 'characters from', workbook.SheetNames.length, 'sheets');
    } else {
      console.log('[textExtraction]    ⚠️ No text found');
    }
    
    return {
      text: combined,
      sheetCount: workbook.SheetNames.length
    };
  } catch (error) {
    console.error('[textExtraction] ❌ Excel extraction error:', error.message);
    return { text: '', sheetCount: 0 };
  }
}

// ==================== IMAGE EXTRACTION WITH FULL OCR ====================
async function extractTextFromImage(buffer, mimeType) {
  try {
    console.log(`[textExtraction] 📷 Extracting FULL TEXT from ${mimeType} image with OCR...`);
    const text = await extractTextFromImageWithOCRCombined(buffer, mimeType);
    
    if (text) {
      console.log('[textExtraction]    ✅ OCR extracted FULL TEXT:', text.length, 'characters');
      console.log('[textExtraction]    Text preview (first 500 chars):', text.substring(0, 500).replace(/\n/g, ' '));
      return text; // Return complete text
    } else {
      console.log('[textExtraction]    ⚠️ No text found in image');
      return 'No text found in image';
    }
    
  } catch (error) {
    console.error('[textExtraction] ❌ Image OCR extraction error:', error.message);
    return `Image processed with OCR error: ${error.message}`;
  }
}

// ==================== FETCH WITH TIMEOUT ====================
async function fetchWithTimeout(url, options = {}, timeout = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ==================== EXPORTS ====================
module.exports = {
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromExcel,
  extractTextFromImage,
  fetchWithTimeout,
  visionInitialized
};