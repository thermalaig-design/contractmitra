// ==================== CHAT ROUTES ====================
const express = require('express');
const router = express.Router();
const { generateChatResponse } = require('../services/chatService');

// Main chat endpoint - universal, works no matter root path
router.post('/', async (req, res) => {
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
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Generate response using service
    const result = await generateChatResponse({
      message,
      projectId,
      projectName,
      department,
      division,
      status,
      documentCount,
      conversationHistory
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error),
      fallbackMessage: 'Sorry, an error occurred processing your request. Please try again.'
    });
  }
});

// For backward compatibility: supports /chat for legacy mounts
router.post('/chat', async (req, res) => {
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
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Generate response using service
    const result = await generateChatResponse({
      message,
      projectId,
      projectName,
      department,
      division,
      status,
      documentCount,
      conversationHistory
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error),
      fallbackMessage: 'Sorry, an error occurred processing your request. Please try again.'
    });
  }
});

module.exports = router;