// ==================== CHAT HISTORY ROUTES ====================
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// ✅ Verify keys are loaded
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables!');
    console.error('Make sure .env file exists and contains SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized with service role key');

// Create per-request client if Authorization header is provided (so RLS uses auth.uid())
function getSupabaseFromRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return supabase; // fallback to service client
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || supabaseKey, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

// ==================== GET ALL CONVERSATIONS ====================
// GET /api/chat-history/conversations
router.get('/conversations', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // ✅ FIX: Supabase client handles UUID type conversion automatically
    const { data, error } = await sb
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .neq('is_archived', true) // include false and null
      .order('is_pinned', { ascending: false })
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching conversations:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      conversations: data || [] 
    });

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== GET SINGLE CONVERSATION WITH MESSAGES ====================
// GET /api/chat-history/conversations/:id
router.get('/conversations/:id', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const conversationId = req.params.id;
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Get conversation details
    const { data: conversation, error: convError } = await sb
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError) {
      console.error('❌ Error fetching conversation:', convError);
      return res.status(500).json({ 
        success: false, 
        error: convError.message,
        details: convError.details || convError.hint
      });
    }
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    // Get messages for this conversation
    let { data: messages, error: msgError } = await sb
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('❌ Error fetching messages:', msgError);
      return res.status(500).json({ 
        success: false, 
        error: msgError.message,
        details: msgError.details || msgError.hint
      });
    }

    // Auto-repair legacy rows: if no messages returned, but there are messages with null user_id, assign to this user and refetch
    if (!messages || messages.length === 0) {
      const { data: nullUserMsgs, error: nullMsgErr } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .is('user_id', null);

      if (!nullMsgErr && nullUserMsgs && nullUserMsgs.length > 0) {
        const { error: repairErr } = await supabase
          .from('chat_messages')
          .update({ user_id: userId })
          .eq('conversation_id', conversationId)
          .is('user_id', null);

        if (!repairErr) {
          const refetch = await sb
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          if (!refetch.error) {
            messages = refetch.data || [];
          }
        }
      }
    }

    // Final fallback: if still zero, fetch with service client without user filter (legacy data with different user_id)
    if (!messages || messages.length === 0) {
      const { data: anyMsgs, error: anyErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (!anyErr && anyMsgs) {
        messages = anyMsgs;
      }
    }

    res.json({ 
      success: true, 
      conversation,
      messages: messages || [] 
    });

  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== CREATE NEW CONVERSATION ====================
// POST /api/chat-history/conversations
router.post('/conversations', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const {
      userId,
      title,
      projectId,
      projectName,
      department,
      division,
      status
    } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const { data, error } = await sb
      .from('chat_conversations')
      .insert([{
        user_id: userId,
        title: title || 'New Conversation',
        project_id: projectId || null,
        project_name: projectName || null,
        department: department || null,
        division: division || null,
        status: status || null,
        message_count: 0,
        last_message_at: new Date().toISOString(),
        is_pinned: false,
        is_archived: false
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating conversation:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      conversation: data 
    });

  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== ADD MESSAGE TO CONVERSATION ====================
// POST /api/chat-history/conversations/:id/messages
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const conversationId = req.params.id;
    const {
      userId,
      role,
      content,
      hasDocuments,
      documentReferences,
      metadata
    } = req.body;

    if (!userId || !role || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID, role, and content are required' 
      });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Role must be user, assistant, or system' 
      });
    }

    const { data, error } = await sb
      .from('chat_messages')
      .insert([{
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        has_documents: hasDocuments || false,
        document_references: documentReferences || null,
        metadata: metadata || null
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding message:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      message: data 
    });

  } catch (error) {
    console.error('❌ Error adding message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== UPDATE CONVERSATION ====================
// PATCH /api/chat-history/conversations/:id
router.patch('/conversations/:id', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const conversationId = req.params.id;
    const {
      userId,
      title,
      isPinned,
      isArchived
    } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (isPinned !== undefined) updateData.is_pinned = isPinned;
    if (isArchived !== undefined) updateData.is_archived = isArchived;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from('chat_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating conversation:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      conversation: data 
    });

  } catch (error) {
    console.error('❌ Error updating conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== DELETE CONVERSATION ====================
// DELETE /api/chat-history/conversations/:id
router.delete('/conversations/:id', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const conversationId = req.params.id;
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Delete conversation (messages will be cascade deleted)
    const { error } = await sb
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting conversation:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== SAVE CURRENT CHAT ====================
// POST /api/chat-history/save-current
router.post('/save-current', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const {
      userId,
      title,
      projectId,
      projectName,
      department,
      division,
      status,
      messages
    } = req.body;

    if (!userId || !messages || messages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and messages are required' 
      });
    }

    // Generate title from first user message if not provided
    const autoTitle = title || messages.find(m => m.role === 'user')?.content.substring(0, 50) + '...' || 'New Conversation';

    // Create conversation
    const { data: conversation, error: convError } = await sb
      .from('chat_conversations')
      .insert([{
        user_id: userId,
        title: autoTitle,
        project_id: projectId || null,
        project_name: projectName || null,
        department: department || null,
        division: division || null,
        status: status || null,
        message_count: messages.length,
        last_message_at: new Date().toISOString(),
        is_pinned: false,
        is_archived: false
      }])
      .select()
      .single();

      if (convError) {
        console.error('❌ Error creating conversation:', convError);
        return res.status(500).json({ 
          success: false, 
          error: convError.message,
          details: convError.details || convError.hint
        });
      }
    // Add all messages
   // ✅ FIXED: Add all messages WITH metadata
   const messagesToInsert = messages.map(msg => ({
    conversation_id: conversation.id,
    user_id: userId,
    role: msg.role,
    content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content,
    has_documents: msg.hasDocuments || false,
    document_references: msg.documentReferences || null,
    metadata: msg.metadata || null  // ✅ Preserve metadata
  }));

  const { error: msgError } = await sb
  .from('chat_messages')
  .insert(messagesToInsert);

  if (msgError) {
    console.error('❌ Error inserting messages:', msgError);
    return res.status(500).json({ 
      success: false, 
      error: msgError.message,
      details: msgError.details || msgError.hint
    });
  }

  res.json({ 
    success: true, 
    conversation,
    message: 'Chat saved successfully' 
  });
  
  } catch (error) {
    console.error('❌ Error saving chat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== SEARCH CONVERSATIONS ====================
// GET /api/chat-history/search
router.get('/search', async (req, res) => {
  try {
    const sb = getSupabaseFromRequest(req);
    const userId = req.query.userId;
    const query = req.query.q;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!query) {
      return res.json({ 
        success: true, 
        conversations: [] 
      });
    }

    // Search in conversation titles
    const { data, error } = await sb
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .neq('is_archived', true)
      .ilike('title', `%${query}%`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('❌ Error searching conversations:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint
      });
    }

    res.json({ 
      success: true, 
      conversations: data || [] 
    });

  } catch (error) {
    console.error('❌ Error searching conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
