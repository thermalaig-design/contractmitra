// ==================== QDRANT SERVICE ====================
const { qdrant } = require('../config/database');

// Ensure collection exists
async function ensureCollection(collectionName, projectId = null, projectName = null) {
  if (!collectionName) throw new Error('collectionName required');
  if (!qdrant) throw new Error('Qdrant client not initialized (check QDRANT_URL/QDRANT_API_KEY)');
  
  try {
    let collections;
    try {
      collections = await qdrant.getCollections();
    } catch (err) {
      console.error('ensureCollection: qdrant.getCollections failed:', err && err.message ? err.message : err);
      throw new Error('qdrant.getCollections failed: ' + (err && err.message ? err.message : String(err)));
    }

    const exists = (collections.collections || []).some(c => c.name === collectionName);
    if (!exists) {
      try {
        const resp = await qdrant.createCollection(collectionName, { 
          vectors: { size: 1536, distance: 'Cosine' } 
        });
        console.log('ensureCollection: createCollection response:', resp || '(no response)');
      } catch (err) {
        console.error('ensureCollection: qdrant.createCollection failed:', err && err.message ? err.message : err);
        throw new Error('qdrant.createCollection failed: ' + (err && err.message ? err.message : String(err)));
      }
    }

    return true;
  } catch (err) {
    console.error('ensureCollection error:', err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = {
  ensureCollection
};