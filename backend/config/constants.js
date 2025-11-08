// ==================== CONSTANTS ====================
const { spawnSync } = require('child_process');

// Check if pdftoppm (Poppler) is available
let PDFTOPPM_AVAILABLE = false;
try {
  const res = spawnSync('pdftoppm', ['-h']);
  if (res.error) {
    PDFTOPPM_AVAILABLE = false;
  }
} catch (e) {
  PDFTOPPM_AVAILABLE = false;
}

module.exports = {
  PDFTOPPM_AVAILABLE
};