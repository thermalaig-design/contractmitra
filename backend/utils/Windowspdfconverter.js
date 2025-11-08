// ==================== WINDOWS-FRIENDLY PDF TO PNG CONVERTER ====================
// This works on Windows without system dependencies!
// Uses pdf-poppler npm package which includes Windows binaries

const fs = require('fs');
const path = require('path');
const { convert } = require('pdf-poppler');

/**
 * Convert PDF to PNG images - Windows Compatible
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @param {Object} options - Conversion options
 * @returns {Promise<Array>} Array of saved image info
 */
async function convertPdfToImages(pdfBuffer, options = {}) {
  console.log('\n[WINDOWS-PDF2IMG] 🚀 ========== STARTING CONVERSION (Windows) ==========');
  
  const {
    outputDir = path.join(__dirname, '../pdf_images'),
    dpi = 300,
    maxPages = 100
  } = options;
  
  console.log('[WINDOWS-PDF2IMG]    Buffer size:', (pdfBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('[WINDOWS-PDF2IMG]    Output dir:', outputDir);
  console.log('[WINDOWS-PDF2IMG]    DPI:', dpi);
  console.log('[WINDOWS-PDF2IMG]    Max pages:', maxPages);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    console.log('[WINDOWS-PDF2IMG]    Creating output directory...');
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const tempPdfPath = path.join(outputDir, `temp_${timestamp}.pdf`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Save buffer to temp PDF file
    console.log('[WINDOWS-PDF2IMG] 📝 Saving temp PDF file...');
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    console.log('[WINDOWS-PDF2IMG]    ✅ Temp PDF saved:', tempPdfPath);
    
    // Step 2: Configure conversion options
    const conversionOptions = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: `page_${timestamp}`,
      page: null, // Convert all pages up to maxPages
      scale: dpi / 72, // Convert DPI to scale (72 is default)
    };
    
    console.log('[WINDOWS-PDF2IMG] 🖼️  Converting PDF to PNG images...');
    console.log('[WINDOWS-PDF2IMG]    Options:', JSON.stringify(conversionOptions, null, 2));
    
    // Step 3: Convert using pdf-poppler
    await convert(tempPdfPath, conversionOptions);
    
    console.log('[WINDOWS-PDF2IMG]    ✅ Conversion completed');
    
    // Step 4: Find all generated images
    console.log('[WINDOWS-PDF2IMG] 📂 Finding generated images...');
    const files = fs.readdirSync(outputDir);
    const imageFiles = files.filter(f => 
      f.startsWith(`page_${timestamp}`) && f.endsWith('.png')
    ).sort();
    
    console.log('[WINDOWS-PDF2IMG]    Found', imageFiles.length, 'images');
    
    if (imageFiles.length === 0) {
      throw new Error('No images were generated. PDF may be corrupted or password protected.');
    }
    
    // Step 5: Limit to maxPages
    const limitedImages = imageFiles.slice(0, maxPages);
    
    // Step 6: Read all images and prepare result
    const images = [];
    for (let i = 0; i < limitedImages.length; i++) {
      const fileName = limitedImages[i];
      const filePath = path.join(outputDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`[WINDOWS-PDF2IMG]       ⚠️ File not found: ${fileName}`);
        continue;
      }
      
      const buffer = fs.readFileSync(filePath);
      
      images.push({
        pageNum: i + 1,
        buffer: buffer,
        path: filePath,
        name: fileName,
        size: buffer.length,
        url: `/pdf_images/${fileName}`
      });
      
      console.log(`[WINDOWS-PDF2IMG]       ✅ Page ${i + 1}: ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`);
    }
    
    // Step 7: Clean up temp PDF
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
      console.log('[WINDOWS-PDF2IMG]    🗑️  Temp PDF deleted');
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n[WINDOWS-PDF2IMG] ✅ ========== CONVERSION COMPLETE ==========');
    console.log(`[WINDOWS-PDF2IMG]    Total time: ${elapsed}s`);
    console.log(`[WINDOWS-PDF2IMG]    Total images: ${images.length}`);
    console.log(`[WINDOWS-PDF2IMG]    Images saved in: ${outputDir}`);
    
    return images;
    
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (e) {
        console.warn('[WINDOWS-PDF2IMG]    ⚠️ Could not delete temp file');
      }
    }
    
    console.error('\n[WINDOWS-PDF2IMG] ❌ ========== CONVERSION FAILED ==========');
    console.error('[WINDOWS-PDF2IMG] ❌ Error:', error.message);
    
    if (error.message.includes('pdf-poppler')) {
      console.error('[WINDOWS-PDF2IMG] 💡 Install: npm install pdf-poppler --save');
    }
    
    throw new Error(`PDF to image conversion failed: ${error.message}`);
  }
}

module.exports = {
  convertPdfToImages
};