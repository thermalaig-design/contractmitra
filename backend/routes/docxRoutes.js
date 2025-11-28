// ==================== DOCX GENERATION SERVICE ====================
const docx = require('docx');
const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, HeadingLevel } = docx;
const fs = require('fs').promises;
const path = require('path');
const { supabase } = require('../config/database');

/**
 * Parse markdown-style formatting to DOCX TextRun properties
 */
function parseTextFormatting(text) {
  const runs = [];
  let currentPos = 0;
  
  // Bold pattern: **text**
  const boldPattern = /\*\*(.*?)\*\*/g;
  // Italic pattern: *text*
  const italicPattern = /\*(.*?)\*/g;
  // Underline pattern: __text__
  const underlinePattern = /__(.*?)__/g;
  
  let lastIndex = 0;
  
  // Process bold
  let match;
  const segments = [];
  
  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = boldPattern.lastIndex;
  }
  
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  
  // Convert segments to TextRun
  segments.forEach(seg => {
    if (seg.text) {
      runs.push(new TextRun({
        text: seg.text,
        bold: seg.bold,
        size: 24 // 12pt
      }));
    }
  });
  
  return runs.length > 0 ? runs : [new TextRun({ text, size: 24 })];
}

/**
 * Create paragraph with formatting
 */
function createParagraph(text, options = {}) {
  const {
    alignment = AlignmentType.JUSTIFIED,
    bold = false,
    underline = false,
    centered = false,
    heading = null,
    spacing = { before: 100, after: 100 }
  } = options;
  
  const alignmentType = centered ? AlignmentType.CENTER : alignment;
  
  return new Paragraph({
    children: parseTextFormatting(text),
    alignment: alignmentType,
    heading: heading,
    spacing: spacing
  });
}

/**
 * Create table for Index section
 */
function createIndexTable(documents) {
  const rows = [
    // Header row
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "S. NO.", bold: true })],
          width: { size: 10, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ text: "PARTICULARS", bold: true })],
          width: { size: 75, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ text: "PAGES", bold: true })],
          width: { size: 15, type: WidthType.PERCENTAGE }
        })
      ]
    })
  ];
  
  // Fixed entries (1-7)
  const fixedEntries = [
    "Court fee and PF Court fee",
    "Urgent Application",
    "Notice of Motion",
    "List of Dates and Events/Synopsis",
    "Memo of Parties",
    "Petition under section 11 of the Arbitration and Conciliation Act, 1996.",
    "Affidavit & Statement of Truth"
  ];
  
  fixedEntries.forEach((entry, index) => {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: `${index + 1}.` })] }),
        new TableCell({ children: [new Paragraph({ text: entry })] }),
        new TableCell({ children: [new Paragraph({ text: "" })] })
      ]
    }));
  });
  
  // Variable entries (documents)
  documents.forEach((doc, index) => {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: `${8 + index}.` })] }),
        new TableCell({ children: [new Paragraph({ text: doc })] }),
        new TableCell({ children: [new Paragraph({ text: "" })] })
      ]
    }));
  });
  
  // Final fixed entries
  const finalEntries = [
    "Document 7: Copy of board resolution dated .............. authorizing signatory",
    "Vakalatnama",
    "Proof of service and affidavit"
  ];
  
  finalEntries.forEach((entry, index) => {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: `${8 + documents.length + index + 1}.` })] }),
        new TableCell({ children: [new Paragraph({ text: entry })] }),
        new TableCell({ children: [new Paragraph({ text: "" })] })
      ]
    }));
  });
  
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

/**
 * Generate complete Section 11 DOCX document
 */
async function generateSection11DOCX(documentId, userId) {
  try {
    console.log('ðŸ“ Generating DOCX for document:', documentId);
    
    // Fetch generated document from Supabase
    const { data: generatedDoc, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();
    
    if (error || !generatedDoc) {
      throw new Error('Generated document not found');
    }
    
    const parts = generatedDoc.generated_content || {};
    const sections = [];
    
    // Create document sections based on generated parts
    Object.keys(parts).sort().forEach(partKey => {
      const partContent = parts[partKey];
      
      // Split content into paragraphs
      const paragraphs = partContent.split('\n').filter(p => p.trim());
      
      paragraphs.forEach(para => {
        sections.push(createParagraph(para));
      });
      
      // Add page break after each part (except last)
      sections.push(new Paragraph({ children: [], pageBreakBefore: true }));
    });
    
    // Create DOCX document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: sections
      }]
    });
    
    // Generate buffer
    const buffer = await docx.Packer.toBuffer(doc);
    
    // Save to temporary file
    const tempDir = path.join(__dirname, '../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const fileName = `Section_11_${documentId}_${Date.now()}.docx`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, buffer);
    
    console.log('âœ… DOCX generated:', fileName);
    
    // Upload to Supabase Storage (optional)
    const fileBuffer = await fs.readFile(filePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-documents')
      .upload(`${userId}/${fileName}`, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });
    
    if (uploadError) {
      console.warn('Warning: Could not upload to Supabase Storage:', uploadError);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generated-documents')
      .getPublicUrl(`${userId}/${fileName}`);
    
    const publicUrl = urlData?.publicUrl || null;
    
    // Update document record with DOCX URL
    await supabase
      .from('generated_documents')
      .update({ final_docx_url: publicUrl })
      .eq('id', documentId);
    
    // Clean up temp file
    await fs.unlink(filePath);
    
    return {
      success: true,
      fileName,
      fileUrl: publicUrl,
      filePath: publicUrl ? null : filePath // Return local path if upload failed
    };
    
  } catch (error) {
    console.error('âŒ Error generating DOCX:', error);
    throw error;
  }
}

/**
 * Generate DOCX from raw text parts (alternative method)
 */
async function generateDOCXFromParts(parts, extractedData = {}) {
  try {
    const sections = [];
    
    // Header
    sections.push(
      createParagraph("IN THE HIGH COURT OF DELHI AT NEW DELHI", {
        centered: true,
        bold: true
      })
    );
    
    sections.push(
      createParagraph("Arb. P. No. ____ / 2025", {
        centered: true
      })
    );
    
    sections.push(new Paragraph({ children: [] })); // Empty line
    
    // Process each part
    parts.forEach((part, index) => {
      // Add part title
      sections.push(
        createParagraph(part.partName.toUpperCase(), {
          centered: true,
          bold: true,
          underline: true,
          spacing: { before: 240, after: 240 }
        })
      );
      
      // Add part content
      const paragraphs = part.content.split('\n').filter(p => p.trim());
      paragraphs.forEach(para => {
        sections.push(createParagraph(para));
      });
      
      // Page break (except for last part)
      if (index < parts.length - 1) {
        sections.push(new Paragraph({ children: [], pageBreakBefore: true }));
      }
    });
    
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: sections
      }]
    });
    
    return await docx.Packer.toBuffer(doc);
    
  } catch (error) {
    console.error('Error generating DOCX from parts:', error);
    throw error;
  }
}

module.exports = {
  generateSection11DOCX,
  generateDOCXFromParts,
  createParagraph,
  createIndexTable
};
