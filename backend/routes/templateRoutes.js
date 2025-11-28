// ==================== routes/templateRoutes.js ====================
const express = require('express');
const router = express.Router();

// Check if Supabase is available
let supabase = null;
try {
  const db = require('../config/database');
  supabase = db.supabase;
} catch (error) {
  console.error('âš ï¸ Supabase not available for template routes');
}

// DOCX generation helpers
let docxService = null;
try {
  docxService = require('../services/docxService');
} catch (error) {
  console.error('âš ï¸ DOCX service not available:', error.message);
}

// ==================== GET ALL TEMPLATES ====================
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { data, error } = await supabase
      .from('legal_templates')
      .select('*')
      .eq('is_active', true)
      .order('template_name');

    if (error) throw error;

    res.json({ success: true, templates: data || [] });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET TEMPLATE WITH PARTS ====================
router.get('/:templateName', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { templateName } = req.params;
    
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('legal_templates')
      .select('*')
      .eq('template_name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
    }

    // Get parts
    const { data: parts, error: partsError } = await supabase
      .from('template_parts')
      .select('*')
      .eq('template_id', template.id)
      .order('sort_order');

    if (partsError) throw partsError;

    // Get variables
    const { data: variables, error: variablesError } = await supabase
      .from('template_variables')
      .select('*')
      .eq('template_id', template.id);

    if (variablesError) throw variablesError;

    res.json({ 
      success: true, 
      template,
      parts: parts || [],
      variables: variables || []
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET SPECIFIC PART ====================
router.get('/:templateName/parts/:partNumber', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { templateName, partNumber } = req.params;
    
    // Get template ID
    const { data: template, error: templateError } = await supabase
      .from('legal_templates')
      .select('id')
      .eq('template_name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
    }

    // Get part
    const { data: part, error: partError } = await supabase
      .from('template_parts')
      .select('*')
      .eq('template_id', template.id)
      .eq('part_number', parseInt(partNumber))
      .single();

    if (partError || !part) {
      return res.status(404).json({ 
        success: false, 
        error: 'Part not found' 
      });
    }

    res.json({ success: true, part });
  } catch (error) {
    console.error('Error fetching part:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CREATE GENERATION SESSION ====================
router.post('/generate/start', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { userId, projectId, templateName, documentTitle } = req.body;

    if (!userId || !templateName) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and templateName are required' 
      });
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('legal_templates')
      .select('id, template_type')
      .eq('template_name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
    }

    // Count parts
    const { count: partsCount } = await supabase
      .from('template_parts')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', template.id);

    // Create document record
    const { data: generatedDoc, error: docError } = await supabase
      .from('generated_documents')
      .insert({
        user_id: userId,
        project_id: projectId,
        template_id: template.id,
        document_title: documentTitle || `${templateName} - ${new Date().toISOString().split('T')[0]}`,
        document_type: template.template_type,
        generation_status: 'in_progress',
        current_part: 0,
        total_parts: partsCount || 0,
        generated_content: {},
        metadata: { started_at: new Date().toISOString() }
      })
      .select()
      .single();

    if (docError) throw docError;

    res.json({ 
      success: true, 
      documentId: generatedDoc.id,
      totalParts: partsCount,
      message: 'Document generation started'
    });
  } catch (error) {
    console.error('Error starting generation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SAVE PART ====================
router.post('/generate/:documentId/part', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { documentId } = req.params;
    const { userId, partNumber, partContent, extractedData, userFeedback = 'pending' } = req.body;

    if (!userId || !partNumber || !partContent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Required fields missing' 
      });
    }

    // Get current document
    const { data: doc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('generated_content')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Update content
    const updatedContent = {
      ...(doc.generated_content || {}),
      [`part_${partNumber}`]: partContent
    };

    // Update document
    const { error: updateError } = await supabase
      .from('generated_documents')
      .update({
        current_part: parseInt(partNumber),
        generated_content: updatedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Log generation
    const { error: logError } = await supabase
      .from('generation_logs')
      .insert({
        generated_doc_id: documentId,
        part_number: parseInt(partNumber),
        ai_response: partContent,
        extracted_data: extractedData,
        user_feedback: userFeedback
      });

    if (logError) console.warn('Log insert warning:', logError);

    res.json({ 
      success: true, 
      message: `Part ${partNumber} saved successfully`
    });
  } catch (error) {
    console.error('Error saving part:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== COMPLETE GENERATION ====================
router.post('/generate/:documentId/complete', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { documentId } = req.params;
    const { userId, docxUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId required' 
      });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        generation_status: 'completed',
        final_docx_url: docxUrl || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      document: data,
      message: 'Document generation completed'
    });
  } catch (error) {
    console.error('Error completing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GENERATE DOCX FILE ====================
router.post('/generate/docx', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    if (!docxService || typeof docxService.generateSection11DOCX !== 'function') {
      return res.status(503).json({
        success: false,
        error: 'DOCX generation service not available'
      });
    }

    const { documentId, userId } = req.body;

    if (!documentId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'documentId and userId are required'
      });
    }

    const result = await docxService.generateSection11DOCX(documentId, userId);

    if (result.fileUrl) {
      return res.json({
        success: true,
        fileName: result.fileName,
        fileUrl: result.fileUrl
      });
    }

    res.json({
      success: true,
      fileName: result.fileName,
      fileData: result.base64Data,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  } catch (error) {
    console.error('Error generating DOCX file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET USER'S DOCUMENTS ====================
router.get('/generated/:userId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Template service not available' 
      });
    }

    const { userId } = req.params;
    const { projectId, status } = req.query;

    let query = supabase
      .from('generated_documents')
      .select(`
        *,
        legal_templates(template_name, template_type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (status) query = query.eq('generation_status', status);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, documents: data || [] });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
