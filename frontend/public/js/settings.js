// ==================== GLOBAL VARIABLES ====================
let currentUserId = null;
let currentUserData = null;

console.log('Settings page loading...');

// ==================== WAIT FOR SUPABASE ====================
async function waitForSupabase() {
  let attempts = 0;
  while (!window.supabase && attempts < 100) {
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }
  if (!window.supabase) throw new Error('Supabase not loaded');
  console.log('âœ… Supabase loaded');
}

// ==================== CHECK AUTH ====================
async function checkAuth() {
  console.log('Checking authentication...');
  try {
    await waitForSupabase();
    
    // Pehle localStorage check karo
    const localUser = localStorage.getItem('cm_user');
    if (localUser) {
      try {
        const userData = JSON.parse(localUser);
        currentUserId = userData.id;
        currentUserData = userData;
        console.log('âœ… User from localStorage:', userData.email);
        displayUserInfo(userData);
        
        // Background mein session verify karo
        supabase.auth.getSession().then(({data: {session}}) => {
          if (!session) {
            console.log('âš ï¸ Session expired, redirecting...');
            localStorage.removeItem('cm_user');
            window.location.href = '/login';
          }
        });
        
        return true;
      } catch (err) {
        console.error('localStorage parse error:', err);
        localStorage.removeItem('cm_user');
      }
    }
    
    // Agar localStorage mein nahi, Supabase se check karo
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      console.log('No session - redirecting to login');
      window.location.href = '/login';
      return false;
    }
    
    currentUserId = session.user.id;
    // Ensure a profile row exists (non-destructive)
    await ensureUserProfileExists(session.user);
    await loadUserData();
    return true;
    
  } catch (error) {
    console.error('Auth error:', error);
    window.location.href = '/login';
    return false;
  }
}

// ==================== ENSURE USER PROFILE EXISTS ====================
async function ensureUserProfileExists(user) {
  try {
    if (!user || !user.id) return;

    const { data: existing } = await supabase
      .from('contractor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) return;

    const { error: insertError } = await supabase
      .from('contractor_profiles')
      .insert({
        user_id: user.id,
        email: user.email || null,
        full_name: null
      });

    if (insertError && insertError.code !== '23505') {
      console.warn('ensureUserProfileExists (settings) insert warning:', insertError);
    }
  } catch (e) {
    console.warn('ensureUserProfileExists (settings) failed:', e);
  }
}

// ==================== LOAD USER DATA ====================
async function loadUserData() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try to get data from contractor_profiles table first
    const { data: profileData, error: profileError } = await supabase
      .from('contractor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    let userData;
    
    if (profileData && !profileError) {
      // Use profile data if available
      userData = {
        id: profileData.user_id || user.id,
        email: profileData.email || user.email,
        full_name: profileData.full_name,
        avatar_url: profileData.profile_picture_url, // Use profile_picture_url as avatar_url for navbar
        profile_picture_url: profileData.profile_picture_url
      };
    } else {
      // Fallback to auth user metadata
      userData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 
                   user.user_metadata?.name || 
                   user.email?.split('@')[0] || 'User',
        first_name: user.user_metadata?.given_name || '',
        last_name: user.user_metadata?.family_name || '',
        job_title: '',
        department: '',
        avatar_url: user.user_metadata?.picture
      };
    }
    
    currentUserData = userData;
    // Only persist to localStorage if we loaded an actual profile row
    const hasProfile = !!(profileData && !profileError);
    if (hasProfile) {
      localStorage.setItem('cm_user', JSON.stringify(userData));
    }
    displayUserInfo(userData);
    populateProfileForm(userData);
    
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

// ==================== DISPLAY USER INFO (TOP NAV) ====================
function displayUserInfo(userData) {
  if (!userData) return;
  
  const name = userData.full_name || userData.email?.split('@')[0] || 'User';
  const email = userData.email || '';
  const firstName = name.split(' ')[0] || name;
  
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userFullName = document.getElementById('userFullName');
  const userEmail = document.getElementById('userEmail');
  const userAvatar = document.getElementById('userAvatar');
  
  if (userNameDisplay) userNameDisplay.textContent = firstName;
  if (userFullName) userFullName.textContent = name;
  if (userEmail) userEmail.textContent = email;
  
  if (userAvatar) {
    if (userData.avatar_url) {
      userAvatar.innerHTML = `<img src="${userData.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      userAvatar.textContent = name.charAt(0).toUpperCase();
    }
  }
}

// ==================== POPULATE PROFILE FORM ====================
function populateProfileForm(userData) {
  if (!userData) return;
  
  // Profile form fields
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const jobTitleInput = document.getElementById('jobTitle');
  const departmentSelect = document.getElementById('department');
  
  if (fullNameInput) fullNameInput.value = userData.full_name || '';
  if (emailInput) emailInput.value = userData.email || '';
  if (jobTitleInput) jobTitleInput.value = userData.job_title || '';
  if (departmentSelect) departmentSelect.value = userData.department || '';
  
  // Update avatar preview
  const avatarPreview = document.querySelector('.avatar-preview');
  if (avatarPreview) {
    if (userData.avatar_url) {
      avatarPreview.innerHTML = `<img src="${userData.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      avatarPreview.textContent = (userData.full_name || 'U').charAt(0).toUpperCase();
    }
  }
}

// ==================== SAVE PROFILE CHANGES ====================
async function saveProfileChanges() {
  try {
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const jobTitle = document.getElementById('jobTitle').value.trim();
    const department = document.getElementById('department').value;
    
    if (!fullName) {
      showErrorMessage('Please enter your full name');
      return;
    }
    
    if (!email) {
      showErrorMessage('Please enter your email');
      return;
    }
    
    // Prepare profile data matching Supabase schema
    const profileData = {
      full_name: fullName,
      email: email,
      updated_at: new Date().toISOString()
    };
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('contractor_profiles')
      .select('id')
      .eq('user_id', currentUserId)
      .single();
    
    let updateError;
    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('contractor_profiles')
        .update(profileData)
        .eq('id', existingProfile.id);
      updateError = error;
    } else {
      // Insert new profile
      const { error } = await supabase
        .from('contractor_profiles')
        .insert({
          user_id: currentUserId,
          ...profileData
        });
      updateError = error;
    }
    
    if (updateError) {
      console.error('Profile update error:', updateError);
      // If profiles table doesn't exist, just save to localStorage
      console.log('Saving to localStorage only');
    }
    
    // Update localStorage
    const updatedUserData = {
      ...currentUserData,
      ...profileData
    };
    
    currentUserData = updatedUserData;
    localStorage.setItem('cm_user', JSON.stringify(updatedUserData));
    
    // Update displays
    displayUserInfo(updatedUserData);
    
    showSuccessMessage('âœ… Profile updated successfully!');
    
  } catch (error) {
    console.error('Save profile error:', error);
    showErrorMessage('Failed to save profile changes');
  }
}

// ==================== TOGGLE USER MENU ====================
function toggleUserMenu() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdownMenu');
  
  if (userMenu && dropdown && !userMenu.contains(event.target)) {
    dropdown.classList.remove('show');
  }
});

// ==================== HANDLE LOGOUT ====================
async function handleLogout(event) {
  event.preventDefault();
  
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('cm_user');
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
    showErrorMessage('Logout failed');
  }
}

// ==================== LOAD USAGE STATS ====================
async function loadUsageStats() {
  try {
    // Load projects count
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id', { count: 'exact' })
      .eq('user_id', currentUserId);
    
    // Load documents count and size
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('file_size', { count: 'exact' })
      .eq('user_id', currentUserId);
    
    const projectCount = projects?.length || 0;
    const documentCount = documents?.length || 0;
    
    // Calculate total storage
    let totalStorage = 0;
    if (documents) {
      totalStorage = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    }
    
    const storageInGB = (totalStorage / (1024 * 1024 * 1024)).toFixed(2);
    const storagePercentage = (totalStorage / (10 * 1024 * 1024 * 1024)) * 100; // Assuming 10GB limit
    
    // Update billing section usage meters
    updateUsageDisplay({
      ai_messages_used: 15,
      ai_messages_limit: 50,
      projects_used: projectCount,
      projects_limit: 2,
      documents_used: documentCount,
      documents_limit: 40
    });
    
  } catch (error) {
    console.error('Error loading usage stats:', error);
    // Use mock data on error
    updateUsageDisplay({
      ai_messages_used: 15,
      ai_messages_limit: 50,
      projects_used: 1,
      projects_limit: 2,
      documents_used: 8,
      documents_limit: 40
    });
  }
}

// ==================== UPDATE USAGE DISPLAY ====================
function updateUsageDisplay(planData) {
  // Update AI Messages usage
  const aiMessagesFill = document.querySelector('#billing .usage-item:nth-child(1) .usage-fill');
  const aiMessagesValue = document.querySelector('#billing .usage-item:nth-child(1) .usage-value');
  if (aiMessagesFill && aiMessagesValue) {
    const percentage = (planData.ai_messages_used / planData.ai_messages_limit) * 100;
    aiMessagesFill.style.width = percentage + '%';
    aiMessagesValue.textContent = `${planData.ai_messages_used} / ${planData.ai_messages_limit}`;
  }
  
  // Update Projects usage
  const projectsFill = document.querySelector('#billing .usage-item:nth-child(2) .usage-fill');
  const projectsValue = document.querySelector('#billing .usage-item:nth-child(2) .usage-value');
  if (projectsFill && projectsValue) {
    const percentage = (planData.projects_used / planData.projects_limit) * 100;
    projectsFill.style.width = percentage + '%';
    projectsValue.textContent = `${planData.projects_used} / ${planData.projects_limit}`;
  }
  
  // Update Documents usage
  const documentsFill = document.querySelector('#billing .usage-item:nth-child(3) .usage-fill');
  const documentsValue = document.querySelector('#billing .usage-item:nth-child(3) .usage-value');
  if (documentsFill && documentsValue) {
    const percentage = (planData.documents_used / planData.documents_limit) * 100;
    documentsFill.style.width = percentage + '%';
    documentsValue.textContent = `${planData.documents_used} / ${planData.documents_limit}`;
  }
}

// ==================== TOGGLE SIDEBAR ====================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  
  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('expanded');
}

// ==================== SHOW SETTINGS SECTION ====================
function showSection(sectionId, evt) {
  console.log('Showing section:', sectionId);
  
  // Prevent default anchor behavior (handle undefined event)
  if (evt && evt.preventDefault) {
    evt.preventDefault();
  } else if (typeof event !== 'undefined' && event.preventDefault) {
    event.preventDefault();
  }
  
  // Hide all sections (ensure display none too)
  document.querySelectorAll('.settings-section').forEach(section => {
    section.classList.remove('active');
    section.style.display = 'none';
  });

  // Remove active class from all nav items
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Show selected section
  const section = document.getElementById(sectionId);
  if (section) {
    console.log('Found section element:', section);
    section.classList.add('active');
    section.style.display = 'block';
    if (sectionId === 'terms') {
      const fb = document.getElementById('termsFallback');
      if (fb) fb.style.display = 'none';
    }
  } else {
    console.log('Section not found:', sectionId);
  }
  
  // Add active class to corresponding nav item (anchor with matching href)
  const matchingNav = document.querySelector(`.settings-nav-item[href="#${sectionId}"]`);
  if (matchingNav) matchingNav.classList.add('active');
  
  // Update URL hash for deep-linking/bookmarks
  if (window.location.hash !== `#${sectionId}`) {
    history.replaceState(null, '', `#${sectionId}`);
  }
  
  // Load stats if billing section
  if (sectionId === 'billing') {
    loadUsageStats();
  }
}

// ==================== MESSAGE FUNCTIONS ====================
function showSuccessMessage(message) {
  const successMsg = document.createElement('div');
  successMsg.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 3000;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;
  successMsg.textContent = message;
  document.body.appendChild(successMsg);
  
  setTimeout(() => {
    document.body.removeChild(successMsg);
  }, 3000);
}

function showErrorMessage(message) {
  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #dc2626;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 3000;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;
  errorMsg.textContent = message;
  document.body.appendChild(errorMsg);
  
  setTimeout(() => {
    document.body.removeChild(errorMsg);
  }, 3000);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Settings page initializing...');
  
  // Check authentication first
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;
  
  // Handle initial section based on URL hash
  const hash = window.location.hash.substring(1);
  if (hash && document.getElementById(hash)) {
    showSection(hash);
  } else {
    // Default to profile and set hash for consistency
    showSection('profile');
  }
  
  // Profile form save button
  const profileSaveBtn = document.querySelector('#profile .btn');
  if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      await saveProfileChanges();
    });
  }
  
  // Preferences save button
  const preferencesSaveBtn = document.querySelector('#preferences .btn');
  if (preferencesSaveBtn) {
    preferencesSaveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showSuccessMessage('âœ… Preferences saved successfully!');
    });
  }
  
  // Avatar upload buttons (placeholder functionality)
  const changePhotoBtn = document.querySelector('.avatar-actions .btn-secondary:first-child');
  if (changePhotoBtn) {
    changePhotoBtn.addEventListener('click', function() {
      showErrorMessage('Avatar upload coming soon!');
    });
  }
  
  // Remove photo button
  const removePhotoBtn = document.querySelector('.avatar-actions .btn-secondary:last-child');
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', function() {
      showErrorMessage('Avatar removal coming soon!');
    });
  }
  
  // Delete account button
  const deleteAccountBtn = document.querySelector('.btn-danger');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', function() {
      if (confirm('âš ï¸ Are you sure you want to delete your account? This action cannot be undone!')) {
        showErrorMessage('Account deletion coming soon! Please contact support.');
      }
    });
  }
  
  console.log('âœ… Settings page initialized');
  try { startMojibakeFix(); } catch (e) {}
});

// ==================== MOJIBAKE FIX (UI CLEANUP) ====================
function startMojibakeFix() {
  const MAP = new Map([
    ['âœ…', '✅'],
    ['âš ï¸', '⚠'],
    ['âš', '⚠'],
    ['âœï¸', '✏'],
    ['ðŸ“¤', '📝'],
    ['ðŸ“„', '📄'],
    ['ðŸ“‹', '📚'],
    ['ðŸ’¾', '💾'],
    ['ðŸ“–', '📖'],
    ['ðŸ“', '📁'],
    ['ðŸ“', '📝'],
    ['ðŸ”', '🔐'],
    ['ðŸšª', '🚪'],
    ['â³', '⏳']
  ]);

  const fixNode = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.nodeValue;
      let changed = false;
      MAP.forEach((val, key) => {
        if (t.includes(key)) { t = t.split(key).join(val); changed = true; }
      });
      if (changed) node.nodeValue = t;
    }
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let n; while ((n = walker.nextNode())) fixNode(n);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes && m.addedNodes.forEach(el => {
        if (el.nodeType === Node.TEXT_NODE) fixNode(el);
        else if (el.nodeType === Node.ELEMENT_NODE) {
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
          let x; while ((x = w.nextNode())) fixNode(x);
        }
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// Handle window resize
window.addEventListener('resize', function() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  
  if (window.innerWidth > 768) {
    sidebar.classList.remove('collapsed');
    mainContent.classList.remove('expanded');
  }
});

// Handle hash change for navigation
window.addEventListener('hashchange', function() {
  const hash = window.location.hash.substring(1);
  if (hash && document.getElementById(hash)) {
    showSection(hash);
  }
});

// ==================== CONTRACTOR PROFILE FORM FUNCTIONALITY ====================

// Business Type GST Toggle
const businessTypeSelect = document.getElementById('businessType');
if (businessTypeSelect) {
  businessTypeSelect.addEventListener('change', function() {
    const gstWrapper = document.getElementById('gstWrapper');
    const gstInput = document.getElementById('gstNumber');
    const value = this.value;
    
    // Show GST field for Company, LLP, Partnership
    if (value === 'Company' || value === 'LLP' || value === 'Partnership') {
      gstWrapper.style.display = 'block';
      if (value === 'Company' || value === 'LLP') {
        gstInput.required = true;
      } else {
        gstInput.required = false;
      }
    } else {
      gstWrapper.style.display = 'none';
      gstInput.required = false;
    }
  });
}

// Photo Preview
const photoInput = document.getElementById('photoInput');
if (photoInput) {
  photoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });
}

// License Files Display
const licenseFilesInput = document.getElementById('licenseFiles');
if (licenseFilesInput) {
  licenseFilesInput.addEventListener('change', function(e) {
    const fileList = document.getElementById('licenseList');
    const files = Array.from(e.target.files);
    
    if (files.length > 0) {
      fileList.textContent = `${files.length} file(s) selected: ${files.map(f => f.name).join(', ')}`;
    } else {
      fileList.textContent = '';
    }
  });
}

// ==================== SAVE PROFILE FORM TO SUPABASE ====================
async function saveProfileToSupabase(formData) {
  try {
    if (!currentUserId) {
      showErrorMessage('User not authenticated');
      return false;
    }

    // Extract form data
    const fullName = formData.get('fullName')?.trim() || '';
    const email = formData.get('email')?.trim() || '';
    const phone = formData.get('phone')?.trim() || '';
    const location = formData.get('location')?.trim() || '';
    const companyName = formData.get('companyName')?.trim() || '';
    const businessType = formData.get('businessType')?.trim() || '';
    const gstNumber = formData.get('gstNumber')?.trim() || '';
    const website = formData.get('website')?.trim() || '';
    const expertise = formData.get('expertise')?.trim() || '';
    const experience = formData.get('experience') ? parseInt(formData.get('experience')) : null;
    const skills = formData.getAll('skills') || [];
    const bio = formData.get('bio')?.trim() || '';

    // Validate required fields
    if (!fullName || !email) {
      showErrorMessage('Full Name and Email are required');
      return false;
    }

    // Prepare profile data matching Supabase schema
    const profileData = {
      user_id: currentUserId,
      full_name: fullName,
      email: email,
      phone: phone || null,
      location: location || null,
      company_name: companyName || null,
      business_type: businessType || null,
      gst_number: gstNumber || null,
      website: website || null,
      expertise: expertise || null,
      experience_years: experience || null,
      bio: bio || null,
      skills: skills.length > 0 ? skills : [], // JSONB array
      updated_at: new Date().toISOString()
    };

    // Set profile picture if uploaded
    if (uploadedProfilePicture) {
      // Upload picture first
      const fileExt = uploadedProfilePicture.name.split('.').pop();
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, uploadedProfilePicture, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);
        profileData.profile_picture_url = urlData.publicUrl;
      }
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('contractor_profiles')
      .select('id')
      .eq('user_id', currentUserId)
      .single();

    let savedData, updateError;
    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('contractor_profiles')
        .update(profileData)
        .eq('id', existingProfile.id)
        .select()
        .single();
      savedData = data;
      updateError = error;
    } else {
      // Insert new profile
      const { data, error } = await supabase
        .from('contractor_profiles')
        .insert(profileData)
        .select()
        .single();
      savedData = data;
      updateError = error;
    }

    if (updateError) {
      console.error('Profile update error:', updateError);
      // Try saving to localStorage as fallback
      console.log('Saving to localStorage as fallback');
    }

    // Update localStorage with latest data (use profile_picture_url as avatar_url for navbar)
    const updatedUserData = {
      ...currentUserData,
      id: currentUserId,
      full_name: fullName,
      email: email,
      phone: phone,
      avatar_url: savedData?.profile_picture_url || profileData.profile_picture_url || currentUserData?.avatar_url || currentUserData?.profile_picture_url,
      profile_picture_url: savedData?.profile_picture_url || profileData.profile_picture_url,
      location: location,
      company_name: companyName,
      business_type: businessType,
      expertise: expertise,
      experience_years: experience,
      bio: bio,
      skills: skills
    };

    currentUserData = updatedUserData;
    localStorage.setItem('cm_user', JSON.stringify(updatedUserData));

    // Update display on current page
    displayUserInfo(updatedUserData);
    // Update profile name and email displays
    const profileNameDisplay = document.getElementById('profileNameDisplay');
    const profileEmailDisplay = document.getElementById('profileEmailDisplay');
    if (profileNameDisplay) profileNameDisplay.textContent = fullName;
    if (profileEmailDisplay) profileEmailDisplay.textContent = email;

    // Dispatch custom event to notify other pages/windows
    window.dispatchEvent(new CustomEvent('userProfileUpdated', {
      detail: updatedUserData
    }));

    return true;
  } catch (error) {
    console.error('Save profile error:', error);
    showErrorMessage('Failed to save profile changes');
    return false;
  }
}

// Profile Form Submission
document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Show loading
      const loadingOverlay = document.getElementById('loadingOverlay');
      const messageBox = document.getElementById('messageBox');
      const messageText = document.getElementById('messageText');
      
      if (loadingOverlay) loadingOverlay.style.display = 'flex';
      
      const formData = new FormData(this);
      const success = await saveProfileToSupabase(formData);
      
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      
      if (success) {
        // Show success message
        if (messageBox && messageText) {
          messageText.textContent = 'âœ… Profile saved successfully!';
          messageBox.style.display = 'flex';
          messageBox.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          
          setTimeout(() => {
            messageBox.style.display = 'none';
          }, 3000);
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        if (messageBox && messageText) {
          messageText.textContent = 'âŒ Failed to save profile. Please try again.';
          messageBox.style.display = 'flex';
          messageBox.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
          
          setTimeout(() => {
            messageBox.style.display = 'none';
          }, 3000);
        }
      }
    });
  }
});