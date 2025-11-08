// ==================== EVENT ROUTES ====================
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');

// Get all events for a project
// safer events fetch - returns empty list instead of 500 on missing table
router.get('/events/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    console.log('📋 Getting events for project:', projectId);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .order('event_date', { ascending: false });

    if (eventsError) {
      // Log full error for debug, but return graceful response
      console.error('❌ Error fetching events (returning empty list):', eventsError);
      return res.json({
        success: true,
        events: [],
        warning: 'Could not fetch events from Supabase. Table may not exist or permissions missing.'
      });
    }

    console.log(`✅ Found ${events?.length || 0} events in Supabase`);

    res.json({
      success: true,
      events: events || []
    });

  } catch (error) {
    console.error('❌ Error in events route (unexpected):', error);
    // Very defensive: still return success false but with client-friendly message
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching events'
    });
  }
});

// Create a new event
router.post('/events', async (req, res) => {
    try {
        const { projectId, eventName, eventDate, description } = req.body;

        if (!projectId || !eventName || !eventDate) {
            return res.status(400).json({
                success: false,
                error: 'Project ID, event name, and date are required'
            });
        }

        const { data, error } = await supabase
            .from('events')
            .insert([{
                project_id: projectId,
                event_name: eventName,
                event_date: eventDate,
                description: description || ''
            }])
            .select();

        if (error) throw error;

        console.log('✅ Event created successfully');

        res.json({
            success: true,
            event: data[0]
        });

    } catch (error) {
        console.error('❌ Error creating event:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;