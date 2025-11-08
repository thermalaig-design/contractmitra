// ==================== HELPER FUNCTIONS ====================
const { qdrant } = require('../config/database');

// Get collection name from project ID
function getCollectionName(projectId) {
  if (!projectId) return null;
  return `project_${projectId}`;
}

// Ensure Qdrant is initialized
function ensureQdrantInitialized(res) {
  if (!qdrant) {
    if (res) res.status(500).json({ success: false, error: 'Qdrant client not initialized' });
    return false;
  }
  return true;
}

module.exports = {
  getCollectionName,
  ensureQdrantInitialized
};