// =====================================================
// Profile Routes for Contract Mitra
// =====================================================
// Handles all profile-related API endpoints
// =====================================================

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');

// Initialize Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configure Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
    }
});


// =====================================================
// MIDDLEWARE: Verify Authentication
// =====================================================
const verifyAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// =====================================================
// GET: Fetch User Profile
// =====================================================
router.get('/profile', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: profile, error } = await supabase
            .from('contractor_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        if (!profile) {
            // Return default profile structure if none exists
            return res.json({
                success: true,
                profile: {
                    user_id: userId,
                    email: req.user.email,
                    full_name: '',
                    phone: '',
                    location: '',
                    company_name: '',
                    business_type: '',
                    gst_number: '',
                    website: '',
                    expertise: '',
                    experience_years: null,
                    skills: [],
                    bio: '',
                    profile_picture_url: null
                }
            });
        }

        res.json({
            success: true,
            profile: profile
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch profile',
            details: error.message 
        });
    }
});


// =====================================================
// POST/PUT: Create or Update Profile
// =====================================================
router.post('/profile', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            full_name,
            email,
            phone,
            location,
            company_name,
            business_type,
            gst_number,
            website,
            expertise,
            experience_years,
            skills,
            bio
        } = req.body;

        // Validate required fields
        if (!full_name || !email || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Full name, email, and phone are required'
            });
        }

        // Prepare profile data
        const profileData = {
            user_id: userId,
            full_name: full_name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            location: location?.trim() || null,
            company_name: company_name?.trim() || null,
            business_type: business_type?.trim() || null,
            gst_number: gst_number?.trim() || null,
            website: website?.trim() || null,
            expertise: expertise?.trim() || null,
            experience_years: experience_years ? parseInt(experience_years) : null,
            skills: Array.isArray(skills) ? skills : [],
            bio: bio?.trim() || null,
            updated_at: new Date().toISOString()
        };

        // Upsert profile (insert or update)
        const { data, error } = await supabase
            .from('contractor_profiles')
            .upsert(profileData, { 
                onConflict: 'user_id',
                returning: 'representation'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Profile saved successfully',
            profile: data
        });

    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save profile',
            details: error.message 
        });
    }
});


// =====================================================
// POST: Upload Profile Picture
// =====================================================
router.post('/profile/picture', verifyAuth, upload.single('profilePicture'), async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Generate unique filename
        const fileExt = path.extname(file.originalname);
        const fileName = `${userId}_${Date.now()}${fileExt}`;
        const filePath = `profile-pictures/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('profiles')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update profile with new picture URL
        const { data: profileData, error: profileError } = await supabase
            .from('contractor_profiles')
            .update({ 
                profile_picture_url: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (profileError) throw profileError;

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            profile_picture_url: publicUrl
        });

    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload profile picture',
            details: error.message 
        });
    }
});


// =====================================================
// DELETE: Remove Profile Picture
// =====================================================
router.delete('/profile/picture', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current profile to find picture URL
        const { data: profile, error: fetchError } = await supabase
            .from('contractor_profiles')
            .select('profile_picture_url')
            .eq('user_id', userId)
            .single();

        if (fetchError) throw fetchError;

        if (profile?.profile_picture_url) {
            // Extract file path from URL
            const url = new URL(profile.profile_picture_url);
            const filePath = url.pathname.split('/').slice(-2).join('/');

            // Delete from storage
            const { error: deleteError } = await supabase.storage
                .from('profiles')
                .remove([filePath]);

            if (deleteError) {
                console.error('Error deleting from storage:', deleteError);
            }
        }

        // Update profile to remove picture URL
        const { error: updateError } = await supabase
            .from('contractor_profiles')
            .update({ 
                profile_picture_url: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Profile picture removed successfully'
        });

    } catch (error) {
        console.error('Error removing profile picture:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove profile picture',
            details: error.message 
        });
    }
});


// =====================================================
// GET: Fetch User Projects
// =====================================================
router.get('/profile/projects', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // First get contractor_profile id
        const { data: profile, error: profileError } = await supabase
            .from('contractor_profiles')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (profileError) throw profileError;

        // Fetch projects
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;

        res.json({
            success: true,
            projects: projects || []
        });

    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch projects',
            details: error.message 
        });
    }
});


// =====================================================
// GET: Profile Statistics
// =====================================================
router.get('/profile/stats', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get total projects count
        const { count: projectCount, error: projectError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (projectError) throw projectError;

        // Get active projects count
        const { count: activeCount, error: activeError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'Active');

        if (activeError) throw activeError;

        // Get completed projects count
        const { count: completedCount, error: completedError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'Completed');

        if (completedError) throw completedError;

        res.json({
            success: true,
            stats: {
                total_projects: projectCount || 0,
                active_projects: activeCount || 0,
                completed_projects: completedCount || 0
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics',
            details: error.message 
        });
    }
});


// =====================================================
// DELETE: Delete Profile (Danger Zone)
// =====================================================
router.delete('/profile', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete profile (cascade will delete projects)
        const { error } = await supabase
            .from('contractor_profiles')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Profile deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete profile',
            details: error.message 
        });
    }
});


// =====================================================
// ERROR HANDLER
// =====================================================
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds 5MB limit'
            });
        }
    }
    
    console.error('Profile route error:', error);
    res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal server error' 
    });
});


module.exports = router;