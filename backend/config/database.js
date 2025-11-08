// ==================== DATABASE CONFIGURATION ====================
const { createClient } = require('@supabase/supabase-js');
const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');
require('dotenv').config();

// Supabase Client
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase client initialized');
  } else {
    console.warn('⚠️ Supabase env vars missing (SUPABASE_URL or SUPABASE_SERVICE_KEY)');
  }
} catch (err) {
  console.error('❌ Supabase initialization failed:', err && err.message ? err.message : err);
  supabase = null;
}

// Qdrant Client
let qdrant = null;
try {
  if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY) {
    qdrant = new QdrantClient({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });
    console.log('✅ Qdrant client initialized');
  } else {
    console.warn('⚠️ Qdrant env vars missing (QDRANT_URL or QDRANT_API_KEY)');
  }
} catch (err) {
  console.error('❌ Qdrant initialization failed:', err && err.message ? err.message : err);
  qdrant = null;
}

// OpenAI Client
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI client initialized');
  } else {
    console.warn('⚠️ OPENAI_API_KEY missing');
  }
} catch (err) {
  console.error('❌ OpenAI initialization failed:', err && err.message ? err.message : err);
  openai = null;
}

module.exports = { supabase, qdrant, openai };