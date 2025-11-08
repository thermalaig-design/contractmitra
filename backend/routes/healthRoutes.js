// ==================== HEALTH CHECK ROUTES ====================
const express = require('express');
const router = express.Router();
const { qdrant } = require('../config/database');
const { PDFTOPPM_AVAILABLE } = require('../config/constants');
const { ensureQdrantInitialized } = require('../utils/helpers');

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    services: {
      supabase: !!process.env.SUPABASE_URL,
      qdrant: !!process.env.QDRANT_URL,
      openai: !!process.env.OPENAI_API_KEY,
      poppler: PDFTOPPM_AVAILABLE
    }
  });
});

// Check Poppler
router.get('/api/pdftoppm', (req, res) => {
  res.json({
    success: true,
    available: PDFTOPPM_AVAILABLE,
    message: PDFTOPPM_AVAILABLE ? 'pdftoppm available' : 'pdftoppm not found on PATH'
  });
});

// Test Qdrant
router.get('/api/test-qdrant', async (req, res) => {
  try {
    if (!ensureQdrantInitialized(res)) return;
    const collections = await qdrant.getCollections();
    res.json({
      success: true,
      message: 'Qdrant connected',
      collections: collections.collections.map(c => c.name)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;