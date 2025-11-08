// ==================== MAIN PAGE ROUTES ====================
const express = require('express');
const router = express.Router();
const path = require('path');

// Serve main pages using EJS templates
router.get('/', (req, res) => {
    res.render('index');
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/document', (req, res) => {
    res.render('document');
});

router.get('/chatbot', (req, res) => {
    res.render('chatbot');
});

router.get('/project', (req, res) => {
    res.render('project');
});

router.get('/settings', (req, res) => {
    res.render('settings');
});

router.get('/pricing', (req, res) => {
    res.render('pricing');
});

router.get('/terms', (req, res) => {
    // Redirect old Terms page to Settings Terms tab
    res.redirect('/settings#terms');
});

router.get('/chat', (req, res) => {
    res.render('chatbot');
});

module.exports = router;