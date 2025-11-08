// ==================== DATE ROUTES ====================
const express = require('express');
const router = express.Router();
const { supabase, qdrant } = require('../config/database');

// Helper: Get collection name for project
function getCollectionName(projectId) {
    return `project_${projectId}`;
}

// Get all dates from both Supabase documents and Qdrant
router.post('/get-project-dates', async (req, res) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'Project ID is required'
            });
        }

        console.log('📅 Getting dates for project:', projectId);
        const dates = [];

        // 1. Get dates from Supabase documents
        console.log('📊 Checking Supabase documents...');
        
        if (!supabase) {
            console.warn('⚠️ Supabase not initialized');
        } else {
            try {
                const { data: documents, error: supaError } = await supabase
                    .from('documents')
                    .select('id, document_name, created_at, updated_at, uploaded_at')
                    .eq('project_id', projectId);

                if (supaError) {
                    console.error('Supabase error:', supaError);
                } else if (documents && documents.length > 0) {
                    console.log(`📄 Found ${documents.length} documents in Supabase`);
                    documents.forEach(doc => {
                        // Add document creation date
                        if (doc.created_at) {
                            dates.push({
                                documentId: doc.id,
                                documentName: doc.document_name,
                                date: doc.created_at,
                                originalText: new Date(doc.created_at).toLocaleDateString(),
                                context: 'Document uploaded',
                                source: 'supabase'
                            });
                        }
                    });
                } else {
                    console.log('📄 No documents found in Supabase for this project');
                }
            } catch (supaError) {
                console.error('Error querying Supabase documents:', supaError);
            }
        }

        // 2. Get dates from Qdrant (documents content)
        console.log('🔍 Checking Qdrant documents...');
        
        if (!qdrant) {
            console.log('⚠️ Qdrant not initialized');
        } else {
            const collectionName = getCollectionName(projectId);
            
            try {
                const collections = await qdrant.getCollections();
                const exists = collections.collections.some(c => c.name === collectionName);

                if (exists) {
                    // Get all documents from collection
                    const result = await qdrant.scroll(collectionName, {
                        limit: 100,
                        with_payload: true,
                        with_vector: false
                    });

                    console.log(`📄 Found ${result.points?.length || 0} documents in Qdrant`);

                    // Extract dates from each document's content
                    if (result.points && result.points.length > 0) {
                        result.points.forEach(point => {
                            const payload = point.payload;
                            if (!payload) return;

                            const fullContent = payload.full_content || payload.content_preview || '';
                            const documentName = payload.document_name || 'Unknown Document';
                            const documentId = point.id;

                            // Extract dates using regex patterns
                            const contentDates = extractDatesFromContent(fullContent);
                            
                            contentDates.forEach(dateInfo => {
                                dates.push({
                                    documentId: documentId,
                                    documentName: documentName,
                                    date: dateInfo.date,
                                    originalText: dateInfo.originalText,
                                    context: dateInfo.context,
                                    source: 'qdrant'
                                });
                            });
                        });
                    }
                } else {
                    console.log('⚠️ Collection does not exist yet');
                }
            } catch (qdrantError) {
                console.error('Qdrant error:', qdrantError);
                // Continue without Qdrant dates
            }
        }

        // Sort all dates chronologically
        if (dates.length > 0) {
            dates.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Remove duplicates (same date + document)
            const uniqueDates = [];
            const seen = new Set();

            dates.forEach(date => {
                const key = `${date.date}_${date.documentId}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueDates.push(date);
                }
            });

            console.log(`✅ Total unique dates found: ${uniqueDates.length}`);
            console.log('   Sources:', {
                supabase: uniqueDates.filter(d => d.source === 'supabase').length,
                qdrant: uniqueDates.filter(d => d.source === 'qdrant').length
            });

            return res.json({
                success: true,
                dates: uniqueDates
            });
        } else {
            // No dates found - return success with empty array instead of error
            console.log('⚠️ No dates found in project documents');
            return res.json({
                success: true,
                dates: [],
                message: 'No dates found in project documents'
            });
        }

    } catch (error) {
        console.error('❌ Error getting project dates:', error);
        // Return success with empty dates instead of 500 error
        res.json({
            success: true,
            dates: [],
            error: error.message || 'Failed to get project dates',
            message: 'No dates available for this project'
        });
    }
});

// Helper function to extract dates from text
function extractDatesFromContent(text) {
    if (!text) return [];

    const datePatterns = [
        // DD/MM/YYYY or DD-MM-YYYY
        {
            regex: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
            format: 'DD/MM/YYYY'
        },
        // Month DD, YYYY
        {
            regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
            format: 'Month DD, YYYY'
        },
        // DD Month YYYY
        {
            regex: /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
            format: 'DD Month YYYY'
        },
        // YYYY-MM-DD
        {
            regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
            format: 'YYYY-MM-DD'
        }
    ];

    const foundDates = [];
    const seenDates = new Set();

    datePatterns.forEach(pattern => {
        const matches = text.matchAll(pattern.regex);
        
        for (const match of matches) {
            const dateStr = match[0];
            const matchIndex = match.index;

            if (seenDates.has(dateStr)) continue;

            try {
                const parsedDate = new Date(dateStr);
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    
                    if (year >= 1900 && year <= 2100) {
                        seenDates.add(dateStr);

                        // Get surrounding context
                        const contextStart = Math.max(0, matchIndex - 50);
                        const contextEnd = Math.min(text.length, matchIndex + dateStr.length + 50);
                        const context = text.substring(contextStart, contextEnd).trim();

                        foundDates.push({
                            originalText: dateStr,
                            date: parsedDate.toISOString(),
                            timestamp: parsedDate.getTime(),
                            context: context,
                            format: pattern.format
                        });
                    }
                }
            } catch (e) {
                // Skip invalid dates
            }
        }
    });

    // Sort chronologically
    foundDates.sort((a, b) => a.timestamp - b.timestamp);

    // Remove duplicates (same day)
    const uniqueDates = [];
    const seenTimestamps = new Set();

    foundDates.forEach(dateObj => {
        const dayStamp = Math.floor(dateObj.timestamp / (1000 * 60 * 60 * 24));
        if (!seenTimestamps.has(dayStamp)) {
            seenTimestamps.add(dayStamp);
            uniqueDates.push(dateObj);
        }
    });

    return uniqueDates;
}

module.exports = router;