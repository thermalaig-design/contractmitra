// ==================== VECTOR UTILITIES ====================
const { openai } = require('../config/database');

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({ 
      model: 'text-embedding-3-small', 
      input: text.substring(0, 8000) 
    });
    return response.data[0].embedding;
  } catch (err) {
    // Fallback deterministic-ish embedding (normalized char codes)
    const v = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) v[i % 1536] += text.charCodeAt(i) / 1000;
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return v.map(x => x / (mag || 1));
  }
}

// Split text into quadrants
function splitIntoQuadrants(text) {
  if (!text) return ['', '', '', ''];
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const len = cleaned.length;
  if (len === 0) return ['', '', '', ''];
  const q = Math.ceil(len / 4);
  const quadrants = [];
  for (let i = 0; i < 4; i++) {
    const start = i * q;
    quadrants.push(cleaned.substring(start, Math.min(start + q, len)).trim());
  }
  return quadrants;
}

module.exports = {
  generateEmbedding,
  splitIntoQuadrants
};