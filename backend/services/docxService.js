// ==================== services/docxService.js (IMPROVED) ====================

// Check if docx library is available
let docx = null;
let docxAvailable = false;

try {
  docx = require('docx');
  docxAvailable = true;
  console.log('✅ DOCX library loaded');
} catch (error) {
  console.log('⚠️ DOCX library not available. Install with: npm install docx');
}

const fs = require('fs').promises;
const path = require('path');

// Check if Supabase is available
let supabase = null;
try {
  const db = require('../config/database');
  supabase = db.supabase;
} catch (error) {
  console.error('⚠️ Supabase not available for DOCX service');
}

/**
 * Generate Section 11 DOCX document
 */
async function generateSection11DOCX(documentId, userId) {
  try {
    if (!docxAvailable) {
      throw new Error('DOCX library not installed. Run: npm install docx');
    }

    if (!supabase) {
      throw new Error('Database not available');
    }

    console.log('📄 Generating DOCX for document:', documentId);
    
    // Fetch document from Supabase
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
    const {
      Document,
      Paragraph,
      TextRun,
      AlignmentType,
      Table,
      TableRow,
      TableCell,
      WidthType,
      BorderStyle,
      HeadingLevel,
      LevelFormat,
      Packer,
      PageBreak,
      UnderlineType,
      convertInchesToTwip
    } = docx;
    
    // Create sections
    const sections = [];
    
    // Header - IN THE HIGH COURT OF DELHI AT NEW DELHI
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "IN THE HIGH COURT OF DELHI AT NEW DELHI",
            bold: true,
            size: 24, // 12pt
            font: "Times New Roman"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 }
      })
    );
    
    // Arb. P. No. line
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Arb. P. No. ____ / 2025",
            size: 24,
            font: "Times New Roman"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }
      })
    );
    
    // Process each part
    const partKeys = Object.keys(parts).sort();
    
    for (let i = 0; i < partKeys.length; i++) {
      const partKey = partKeys[i];
      const partContent = parts[partKey];

      const blocks = splitContentIntoBlocks(partContent);

      const docxClasses = { 
        Paragraph, 
        TextRun, 
        AlignmentType, 
        HeadingLevel,
        UnderlineType
      };

      blocks.forEach(block => {
        if (block.type === 'table') {
          const table = createTableFromMarkdown(
            block.lines,
            { Table, TableRow, TableCell, WidthType, BorderStyle, Paragraph, TextRun, AlignmentType }
          );
          if (table) {
            sections.push(table);
            sections.push(new Paragraph({ 
              children: [], 
              spacing: { after: 240 } 
            }));
          }
          return;
        }

        const paragraphBlocks = buildParagraphsFromRawText(
          block.raw || block.text || '',
          docxClasses
        );

        if (paragraphBlocks.length > 0) {
          sections.push(...paragraphBlocks);
        }
      });

      // Add page break between parts (except after last part)
      if (i < partKeys.length - 1) {
        sections.push(
          new Paragraph({
            children: [new PageBreak()],
            spacing: { after: 0 }
          })
        );
      }
    }
    
    // Create document with proper formatting
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'numbered-list',
            levels: [{
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) }
                }
              }
            }]
          },
          {
            reference: 'bullet-list',
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) }
                }
              }
            }]
          }
        ]
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children: sections
      }]
    });
    
    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    const base64Data = buffer.toString('base64');
    
    // Save to temp directory
    const tempDir = path.join(__dirname, '../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const fileName = `Section_11_${documentId}_${Date.now()}.docx`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, buffer);
    
    console.log('✅ DOCX generated:', fileName);
    
    // Try to upload to Supabase Storage (optional)
    let publicUrl = null;
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-documents')
        .upload(`${userId}/${fileName}`, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true
        });
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('generated-documents')
          .getPublicUrl(`${userId}/${fileName}`);
        
        publicUrl = urlData?.publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Could not upload to storage:', uploadErr.message);
    }
    
    // Update document record
    if (publicUrl) {
      await supabase
        .from('generated_documents')
        .update({ final_docx_url: publicUrl })
        .eq('id', documentId);
    }
    
    return {
      success: true,
      fileName,
      fileUrl: publicUrl || null,
      localPath: filePath,
      base64Data
    };
    
  } catch (error) {
    console.error('❌ Error generating DOCX:', error);
    throw error;
  }
}

/**
 * Check if DOCX service is available
 */
function isAvailable() {
  return docxAvailable && supabase !== null;
}

module.exports = {
  generateSection11DOCX,
  isAvailable
};

/**
 * Convert markdown-style content into paragraphs/tables
 */
function splitContentIntoBlocks(content = '') {
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const raw = paragraphBuffer.join('\n');
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text) {
      blocks.push({ type: 'paragraph', raw, text });
    }
    paragraphBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      const tableLines = [];
      while (i < lines.length) {
        const tableLine = lines[i].trim();
        if (!tableLine || !tableLine.startsWith('|')) break;
        tableLines.push(tableLine);
        i++;
      }
      if (tableLines.length > 0) {
        blocks.push({ type: 'table', lines: tableLines });
      }
      continue;
    }

    paragraphBuffer.push(line);
    i++;
  }

  flushParagraph();
  return blocks;
}

/**
 * Build DOCX table from markdown rows
 */
function createTableFromMarkdown(tableLines, docxClasses) {
  if (!docxAvailable || !docxClasses) return null;

  const rowsData = tableLines
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(cells => cells.length > 0 && !cells.every(cell => /^-+$/.test(cell.replace(/:/g, ''))));

  if (rowsData.length === 0) return null;

  const {
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    Paragraph,
    TextRun,
    AlignmentType
  } = docxClasses;

  const headerCells = rowsData.shift();
  const columnWidth = Math.floor(9000 / headerCells.length); // Using DXA units

  const tableRows = [];

  // Header row
  tableRows.push(
    new TableRow({
      children: headerCells.map(cell => new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ 
              text: stripInlineMarkdown(cell), 
              bold: true,
              size: 22,
              font: "Times New Roman"
            })],
            alignment: AlignmentType.CENTER
          })
        ],
        width: { size: columnWidth, type: WidthType.DXA },
        shading: {
          fill: "D9D9D9", // Light gray background for header
          color: "auto"
        }
      }))
    })
  );

  // Data rows
  rowsData.forEach(row => {
    tableRows.push(
      new TableRow({
        children: row.map(cell => new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ 
                text: stripInlineMarkdown(cell),
                size: 22,
                font: "Times New Roman"
              })],
              alignment: AlignmentType.LEFT
            })
          ],
          width: { size: columnWidth, type: WidthType.DXA }
        }))
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
    }
  });
}

function buildParagraphsFromRawText(rawText = '', docxClasses) {
  if (!rawText || !docxClasses) return [];

  const { Paragraph, TextRun, AlignmentType, HeadingLevel, UnderlineType } = docxClasses;
  const lines = rawText.split('\n');
  const paragraphs = [];

  lines.forEach(line => {
    if (!line || !line.trim()) {
      return;
    }

    const trimmed = line.trim();
    let paragraphOptions = {
      spacing: { before: 120, after: 120, line: 360 }, // 1.5 line spacing
      alignment: AlignmentType.JUSTIFIED
    };

    let textContent = trimmed;
    let isHeading = false;
    let isCentered = false;

    // Check for headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);

    // Check if line should be centered (typically used for titles, party names, etc.)
    const centerPatterns = [
      /^IN THE MATTER OF:/i,
      /^versus$/i,
      /^\.{3,}/, // Lines with multiple dots (....Petitioner)
      /PETITIONER$/i,
      /RESPONDENT$/i
    ];
    
    isCentered = centerPatterns.some(pattern => pattern.test(trimmed));

    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      textContent = headingMatch[2];
      paragraphOptions.heading = HeadingLevel[`HEADING_${level}`] || HeadingLevel.HEADING_1;
      paragraphOptions.alignment = AlignmentType.CENTER;
      isHeading = true;
    } else if (numberedMatch) {
      textContent = numberedMatch[2];
      paragraphOptions.numbering = { reference: 'numbered-list', level: 0 };
      paragraphOptions.spacing = { before: 60, after: 60, line: 360 };
      paragraphOptions.alignment = AlignmentType.LEFT;
    } else if (bulletMatch) {
      textContent = bulletMatch[1];
      paragraphOptions.numbering = { reference: 'bullet-list', level: 0 };
      paragraphOptions.spacing = { before: 60, after: 60, line: 360 };
      paragraphOptions.alignment = AlignmentType.LEFT;
    } else if (isCentered) {
      paragraphOptions.alignment = AlignmentType.CENTER;
    }

    const inlineRuns = parseInlineMarkdownToRuns(textContent, TextRun, isHeading, UnderlineType);

    paragraphs.push(
      new Paragraph({
        children: inlineRuns,
        ...paragraphOptions
      })
    );
  });

  return paragraphs;
}

function parseInlineMarkdownToRuns(text = '', TextRun, isHeading = false, UnderlineType) {
  if (!TextRun) return [];

  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match;

  const baseSize = isHeading ? 28 : 22; // 14pt for headings, 11pt for body
  const baseOptions = {
    size: baseSize,
    font: "Times New Roman"
  };

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ 
        text: text.slice(lastIndex, match.index),
        ...baseOptions
      }));
    }

    const token = match[0];
    let runText = token;
    const runOptions = { ...baseOptions };

    if (token.startsWith('**') && token.endsWith('**')) {
      runText = token.slice(2, -2);
      runOptions.bold = true;
    } else if (token.startsWith('__') && token.endsWith('__')) {
      runText = token.slice(2, -2);
      runOptions.underline = { type: UnderlineType.SINGLE };
    } else if (token.startsWith('*') && token.endsWith('*')) {
      runText = token.slice(1, -1);
      runOptions.italics = true;
    } else if (token.startsWith('_') && token.endsWith('_')) {
      runText = token.slice(1, -1);
      runOptions.italics = true;
    } else if (token.startsWith('`') && token.endsWith('`')) {
      runText = token.slice(1, -1);
      runOptions.font = 'Courier New';
    }

    runs.push(new TextRun({ text: runText, ...runOptions }));
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ 
      text: text.slice(lastIndex),
      ...baseOptions
    }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text, ...baseOptions })];
}

function stripInlineMarkdown(text = '') {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`(.*?)`/g, '$1');
}
