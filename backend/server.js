// ==================== LOAD ENVIRONMENT VARIABLES FIRST ====================
// ⚠️ CRITICAL: This must be at the very top before any other imports
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');
const qdrantRoutes = require('./routes/qdrantRoutes');
const chatRoutes = require('./routes/chatRoutes');
const mainRoutes = require('./routes/mainRoutes');
const chatHistoryRoutes = require('./routes/chatHistory');
const profileRoutes = require('./routes/profileRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Verify environment variables are loaded
console.log('='.repeat(50));
console.log('🔧 Environment Configuration Check:');
console.log('='.repeat(50));
console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Loaded' : '❌ Missing');
console.log('✅ SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ Loaded' : '❌ Missing');
console.log('✅ OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Loaded' : '❌ Missing');
console.log('✅ QDRANT_URL:', process.env.QDRANT_URL ? '✓ Loaded' : '❌ Missing');
console.log('✅ QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? '✓ Loaded' : '❌ Missing');
console.log('='.repeat(50));

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for large files
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve pdf_images directory
app.use('/pdf_images', express.static(path.join(__dirname, 'pdf_images')));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ==================== ROUTES (FIXED) ====================
// Mount routes directly under /api without extra prefixes
app.use('/api', documentRoutes);  // ✅ Now /api/extract-document-text works
app.use('/api', qdrantRoutes);    // ✅ Now /api/save-to-qdrant works
app.use('/api', chatRoutes); // ✅ /api/chat/* works
app.use('/chat', chatRoutes); // ✅ Now /chat also works
app.use('/', mainRoutes);         // ✅ Main page routes
app.use('/api/chat-history', chatHistoryRoutes);
app.use('/chat-history', chatHistoryRoutes);
app.use('/api/profile', profileRoutes);
// ✅ NEW: Terms & Conditions Route



router.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login - ContractMitra',
        // SEO data
        description: 'Login to ContractMitra - Professional contract management platform',
    });
});

// OAuth callback page (Google/Supabase se wapas aane ke baad)
app.get('/auth/callback', (req, res) => {
  res.render('auth-callback'); // views/auth-callback.ejs
});

// Dashboard page (login ke baad yahan aana hai)
app.get('/dashboard', (req, res) => {
  res.render('index'); // views/dashboard.ejs
});

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ 
    error: 'Not Found', 
    path: req.url,
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Contract Mitra Backend running on port ${PORT}`);
  console.log(`📡 Server URL: http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
});
