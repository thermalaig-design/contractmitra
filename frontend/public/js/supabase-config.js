// Supabase Configuration
const SUPABASE_URL = 'https://dhpwzyxuoanpfhxdqsde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocHd6eXh1b2FucGZoeGRxc2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODk4NDUsImV4cCI6MjA3NTU2NTg0NX0.tttQTtsFb-BHVbnc70Q35qIv0qPKP2HNYNp-J6gN65E';

// Initialize Supabase client
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
});

console.log('✅ Supabase client initialized');

// ==================== TRACKING FUNCTIONS ====================
// These are ONLY helper functions, NOT automatic tracking
// Tracking will be done manually from reg.js

async function trackLoginEvent(userId) {
    try {
        const { error } = await window.supabase
            .from('loginDetails')
            .insert({
                useruid: userId,
                type: 'login',
                timestamp: new Date().toISOString()
            });

        if (error) {
            console.error('❌ Error tracking login:', error);
        } else {
            console.log('✅ Login event tracked');
        }
    } catch (err) {
        console.error('❌ Login tracking error:', err);
    }
}

async function trackLogoutEvent(userId) {
    try {
        const { error } = await window.supabase
            .from('loginDetails')
            .insert({
                useruid: userId,
                type: 'logout',
                timestamp: new Date().toISOString()
            });

        if (error) {
            console.error('❌ Error tracking logout:', error);
        } else {
            console.log('✅ Logout event tracked');
        }
    } catch (err) {
        console.error('❌ Logout tracking error:', err);
    }
}

// ==================== AUTH STATUS CHECK ====================
async function checkAuthStatus() {
    const { data: { session } } = await window.supabase.auth.getSession();

    if (session && window.location.pathname.includes('/login')) {
        // User already logged in, redirect to dashboard
        window.location.href = '../Dashboard/index.html';
    }

    return session;
}

// ==================== OAUTH CALLBACK ====================
async function handleOAuthCallback() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (accessToken) {
        const { data: { user }, error } = await window.supabase.auth.getUser();

        if (user && !error) {
            await saveGoogleUserToDatabase(user);
        }
    }
}

// ==================== SAVE GOOGLE USER ====================
async function saveGoogleUserToDatabase(user) {
    try {
        const userData = {
            id: user.id,
            google_id: user.id,
            email: user.email || null,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Google User',
            first_name: user.user_metadata?.given_name || null,
            last_name: user.user_metadata?.family_name || null,
            avatar_url: user.user_metadata?.picture || user.user_metadata?.avatar_url || null,
            email_verified: user.user_metadata?.email_verified ?? true,
            locale: user.user_metadata?.locale || navigator.language || 'en-IN',
            created_at: user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Try to save to profiles table
        try {
            // Check if profile exists first
            const { data: existingProfile } = await window.supabase
                .from('contractor_profiles')
                .select('id')
                .eq('user_id', userData.id)
                .single();
            
            let insertError;
            if (existingProfile) {
                // Update existing profile
                const { error } = await window.supabase
                    .from('contractor_profiles')
                    .update({
                        full_name: userData.full_name,
                        email: userData.email
                    })
                    .eq('id', existingProfile.id);
                insertError = error;
            } else {
                // Insert new profile
                const { error } = await window.supabase
                    .from('contractor_profiles')
                    .insert([{
                        user_id: userData.id,
                        full_name: userData.full_name,
                        email: userData.email
                    }]);
                insertError = error;
            }

            if (insertError) {
                console.warn('⚠️ profiles table write failed:', insertError);
            }
        } catch (err) {
            console.warn('⚠️ Skipping DB write for user profile:', err);
        }

        // Store in localStorage
        localStorage.setItem('cm_user', JSON.stringify(userData));
        console.log('✅ User data saved to localStorage');

    } catch (err) {
        console.error('❌ Error saving Google user:', err);
    }
}

// ==================== SESSION PERSISTENCE (NO AUTO TRACKING) ====================
// Listen for auth state changes - ONLY for session management
// Tracking is done manually from login/logout functions
window.supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth State Change:', event);
    
    if (event === 'SIGNED_IN' && session) {
        const user = session.user;
        const userData = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.picture
        };
        
        // Save to localStorage
        localStorage.setItem('cm_user', JSON.stringify(userData));
        console.log('✅ User data saved to localStorage');
        
        // ✅ DON'T track here - will be tracked from reg.js
    }
    
    if (event === 'SIGNED_OUT') {
        // Clear localStorage
        localStorage.removeItem('cm_user');
        localStorage.removeItem('sb-session');
        console.log('🗑️ localStorage cleared');
        
        // Redirect to login page
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
        
        // ✅ DON'T track here - will be tracked from handleLogout
    }
    
    if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
    }
});

// Call on page load
checkAuthStatus();
handleOAuthCallback();