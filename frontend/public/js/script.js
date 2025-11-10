let currentView = 'dashboard';
let projects = [];
let documents = [];
let totalDocumentsCount = 0;
let currentUserId = null;
let editingProjectId = null;
let editingDocumentId = null;
let customCategories = [];

// ==================== BACKEND URL ====================

// ==================== WAIT FOR DEPENDENCIES ====================
async function waitForDependencies() {
  console.log('Waiting for dependencies...');
  let attempts = 0;
  while (!window.supabase && attempts < 100) {
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }
  if (!window.supabase) throw new Error('Supabase not loaded');
  console.log('✅ Supabase loaded');
  return true;
}

// ==================== AUTH USER MANAGEMENT ====================
async function checkAuth() {
  console.log('Checking authentication...');
  try {
    // Wait for Supabase to load
    await waitForDependencies();
    
    // Always check Supabase session first
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      console.log('No active session - redirecting to login');
      localStorage.removeItem('cm_user');
      window.location.href = '/login';
      return false;
    }
    
    console.log('✅ User authenticated from Supabase:', session.user.email);
    currentUserId = session.user.id;
    
    // Always load fresh data from database (loadUserData will refresh from contractor_profiles)
    await loadUserData();
    await loadCustomCategories();  
    await loadProjects();
    await loadDocuments();
    await updateDashboardKPIs();
    
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    window.location.href = '/login'; // Changed from '../Registration/loginSignUp.html'
    return false;
  }
}

// ==================== LOAD USER DATA ====================
async function loadUserData() {
  try {
    console.log('Loading user data...');
    
    // Always get user from auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Error loading user:', authError);
      // Fallback to localStorage
      const localData = localStorage.getItem('cm_user');
      if (localData) {
        try {
          const userData = JSON.parse(localData);
          displayUserInfo(userData);
          return;
        } catch (err) {
          console.error('localStorage parse error:', err);
        }
      }
      return;
    }

    // Always load from contractor_profiles table to get latest data
    const { data: profileData, error: profileError } = await supabase
      .from('contractor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let userData;
    
    if (profileData && !profileError) {
      // Use profile data from database (most up-to-date)
      userData = {
        id: profileData.user_id || user.id,
        email: profileData.email || user.email,
        full_name: profileData.full_name || user.email?.split('@')[0] || 'User',
        avatar_url: profileData.profile_picture_url,
        profile_picture_url: profileData.profile_picture_url,
        phone: profileData.phone,
        location: profileData.location,
        company_name: profileData.company_name,
        expertise: profileData.expertise
      };
      console.log('✅ User loaded from contractor_profiles table');
    } else {
      // Fallback to localStorage or auth user metadata
      const localData = localStorage.getItem('cm_user');
      if (localData) {
        try {
          userData = JSON.parse(localData);
          console.log('✅ User from localStorage (no profile in DB)');
        } catch (err) {
          // Create from auth user
          userData = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.picture || user.user_metadata?.avatar_url
          };
          console.log('✅ User from auth metadata');
        }
      } else {
        userData = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.picture || user.user_metadata?.avatar_url
        };
        console.log('✅ User from auth metadata');
      }
    }
    
    // Always update localStorage with latest data
    localStorage.setItem('cm_user', JSON.stringify(userData));
    displayUserInfo(userData);
    
  } catch (error) {
    console.error('Error in loadUserData:', error);
    // Final fallback to localStorage
    const localData = localStorage.getItem('cm_user');
    if (localData) {
      try {
        const userData = JSON.parse(localData);
        displayUserInfo(userData);
      } catch (err) {
        console.error('Error parsing localStorage data:', err);
      }
    }
  }
}

// ==================== LOAD CUSTOM CATEGORIES ====================
async function loadCustomCategories() {
  try {
    // Load custom categories from localStorage
    const stored = localStorage.getItem(`cm_categories_${currentUserId}`);
    if (stored) {
      customCategories = JSON.parse(stored);
      console.log(`✅ Loaded ${customCategories.length} custom categories`);
    }
  } catch (error) {
    console.error('Error loading custom categories:', error);
    customCategories = [];
  }
}

// ==================== SAVE CUSTOM CATEGORY ====================
function saveCustomCategory(categoryName) {
  if (!categoryName || categoryName.trim() === '') return;
  
  const trimmed = categoryName.trim();
  if (!customCategories.includes(trimmed)) {
    customCategories.push(trimmed);
    localStorage.setItem(`cm_categories_${currentUserId}`, JSON.stringify(customCategories));
    console.log('✅ Custom category saved:', trimmed);
  }
}

// ==================== DISPLAY USER INFO ====================
function displayUserInfo(userData) {
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userFullName = document.getElementById('userFullName');
  const userEmail = document.getElementById('userEmail');
  const userAvatar = document.getElementById('userAvatar');
  
  const displayName = userData.full_name || userData.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  
  if (userNameDisplay) userNameDisplay.textContent = displayName;
  if (userFullName) userFullName.textContent = displayName;
  if (userEmail) userEmail.textContent = userData.email || '';
  if (userAvatar) {
    if (userData.avatar_url) {
      userAvatar.innerHTML = `<img src="${userData.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      userAvatar.textContent = initials;
    }
  }
}
// User menu dropdown functionality
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdownMenu');
    
    if (dropdown && !userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});
// Close sidebar when window is resized to desktop
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth > 768) {
        if (sidebar) {
            sidebar.classList.remove('show');
        }
        if (overlay) {
            overlay.remove();
        }
    }
});

// ==================== LISTEN FOR PROFILE UPDATES ====================
// Listen for custom event when profile is updated
window.addEventListener('userProfileUpdated', function(event) {
    if (event.detail) {
        console.log('Profile updated event received, updating display...');
        displayUserInfo(event.detail);
    }
});

// Listen for storage events (cross-tab communication)
window.addEventListener('storage', function(event) {
    if (event.key === 'cm_user' && event.newValue) {
        try {
            const updatedUserData = JSON.parse(event.newValue);
            console.log('Profile updated in another tab, updating display...');
            displayUserInfo(updatedUserData);
        } catch (e) {
            console.error('Error parsing updated user data:', e);
        }
    }
});

// Also listen for localStorage changes on same tab (for immediate updates)
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'cm_user') {
        try {
            const updatedUserData = JSON.parse(value);
            // Small delay to ensure all updates are complete
            setTimeout(() => {
                displayUserInfo(updatedUserData);
            }, 100);
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
};
// Close sidebar when clicking on a sidebar link (mobile only)
document.addEventListener('DOMContentLoaded', function() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                
                if (sidebar) {
                    sidebar.classList.remove('show');
                }
                if (overlay) {
                    overlay.remove();
                }
            }
        });
    });
});







// ==================== HANDLE LOGOUT ====================
async function handleLogout(event) {
  event.preventDefault();
  
  console.log('🚪 Initiating logout...');
  
  try {
    // Get user ID BEFORE clearing anything
    let userId = currentUserId;
    
    // If currentUserId not set, try localStorage
    if (!userId) {
      const localUser = localStorage.getItem('cm_user');
      if (localUser) {
        try {
          const userData = JSON.parse(localUser);
          userId = userData.id;
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
    }
    
    // Track logout BEFORE signing out
    if (userId) {
      console.log('📝 Tracking logout for user:', userId);
      try {
        const { error } = await supabase
          .from('loginDetails')
          .insert({
            useruid: userId,
            type: 'logout',
            timestamp: new Date().toISOString()
          });
        
        if (error) {
          console.error('❌ Logout tracking error:', error);
        } else {
          console.log('✅ Logout tracked successfully');
        }
      } catch (err) {
        console.error('❌ Logout tracking failed:', err);
      }
    } else {
      console.warn('⚠️ No user ID found for logout tracking');
    }
    
    // Sign out from Supabase
    console.log('🔐 Signing out from Supabase...');
    await supabase.auth.signOut();
    
    // Clear all local storage
    localStorage.removeItem('cm_user');
    localStorage.removeItem('sb-session');
    
    console.log('✅ Logout complete');
    
    // Show success message
    showMessage('Logged out successfully', 'success');
    
    // Redirect after short delay
    setTimeout(() => {
      window.location.href = '/login'; // Changed from '../Registration/loginSignUp.html'
    }, 500);
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    showMessage('Logout failed, please try again', 'error');
    
    // Force logout anyway after error
    setTimeout(() => {
      localStorage.removeItem('cm_user');
      localStorage.removeItem('sb-session');
      window.location.href = '/login'; // Changed from '../Registration/loginSignUp.html'
    }, 1000);
  }
}
// ==================== SHOW MESSAGE ====================
function showMessage(message, type = 'success') {
  const bgColor = type === 'success' ? '#10b981' : 
                  type === 'error' ? '#dc2626' : '#2563eb';
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed; top: 80px; right: 20px;
    background: ${bgColor}; color: white;
    padding: 16px 24px; border-radius: 8px;
    z-index: 3000; font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease;
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => messageDiv.remove(), 3000);
}

// ==================== INIT ON PAGE LOAD ====================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM Content Loaded');
  
  try {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      console.log('Not authenticated, redirect handled by checkAuth');
      return;
    }
    
    console.log('✅ Dashboard initialized');
  } catch (error) {
    console.error('Error during initialization:', error);
    showMessage('Error loading dashboard', 'error');
  }
});

// ==================== LOAD PROJECTS (FIXED WITH CORRECT DOCUMENT COUNT) ====================
async function loadProjects() {
  try {
    console.log('Loading projects...');

    if (!window.supabase) {
      throw new Error('Supabase not initialized (window.supabase is falsy)');
    }

    // 1) Fetch projects
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (projectError) {
      console.error('Supabase projects error:', projectError);
      throw projectError;
    }

    const fetchedProjects = projectData || [];
    console.log(`Fetched ${fetchedProjects.length} projects`);

    // 2) Fetch ALL documents for this user to count properly
    const { data: docsData, error: docsError } = await supabase
      .from('documents')
      .select('project_id')
      .eq('user_id', currentUserId);

    if (docsError) {
      console.warn('Could not fetch documents for counting:', docsError);
    }

    // Build counts map: project_id => count
    const countsMap = {};
    if (Array.isArray(docsData)) {
      for (const row of docsData) {
        const pid = row.project_id;
        if (!pid) continue;
        countsMap[pid] = (countsMap[pid] || 0) + 1;
      }
    }

    // 3) Merge counts into projects array - USE ONLY THE CALCULATED COUNT
    projects = fetchedProjects.map(p => {
      return {
        ...p,
        // IMPORTANT FIX: Use only the calculated count from countsMap
        document_count: countsMap[p.id] || 0
      };
    });

    console.log('Projects with correct counts:', projects.map(p => ({ 
      id: p.id, 
      name: p.project_name, 
      document_count: p.document_count 
    })));

    // 4) Update UI
    displayRecentProjects();
    displayProjectsList();
    populateProjectDropdown();

    // 5) Also refresh KPIs
    await updateDashboardKPIs();

  } catch (err) {
    console.error('Error in loadProjects():', err);
    showMessage('Failed to load projects (see console for details)', 'error');
  }
}

// ==================== LOAD DOCUMENTS ====================
async function loadDocuments() {
  try {
    console.log('Loading documents...');
    
    // Fetch recent documents (for table) and fetch total count separately
    const recentPromise = supabase
      .from('documents')
      .select(`
        *,
        projects (
          project_name
        )
      `)
      .eq('user_id', currentUserId)
      .order('uploaded_at', { ascending: false })
      .limit(10);

    const countPromise = supabase
      .from('documents')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', currentUserId);

    const [recentRes, countRes] = await Promise.all([recentPromise, countPromise]);
    const { data, error } = recentRes;
    const { data: countData, error: countError, count } = countRes;

    if (error) throw error;
    if (countError) console.warn('Count query warning:', countError);
    
    documents = data || [];
    // count may be provided by Supabase response; fallback to length if not
    totalDocumentsCount = typeof count === 'number' ? count : (countData ? countData.length : documents.length);
    console.log(`✅ Loaded ${documents.length} recent documents, total documents: ${totalDocumentsCount}`);
    
    displayRecentDocuments();
    
  } catch (error) {
    console.error('Error loading documents:', error);
    showMessage('Failed to load documents', 'error');
  }
}

// ==================== DISPLAY RECENT PROJECTS ====================
function displayRecentProjects() {
  const tableBody = document.getElementById('recentProjectsTable');
  if (!tableBody) return;
  
  if (projects.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 30px; color: #64748b;">
          <div style="font-size: 40px; margin-bottom: 10px;">📋</div>
          <div style="font-weight: 500;">No projects yet</div>
          <button class="btn" onclick="openAddProjectModal()" style="margin-top: 16px;">Create Your First Project</button>
        </td>
      </tr>
    `;
    return;
  }
  
  const recentProjects = projects.slice(0, 10);
  tableBody.innerHTML = recentProjects.map(project => `
    <tr style="cursor: pointer;" onclick="viewProject('${project.id}')" title="Click to view project details">
      <td style="font-weight: 500;">${escapeHtml(project.project_name)}</td>
      <td>${escapeHtml(project.department || 'N/A')}</td>
      <td>${escapeHtml(project.division || 'N/A')}</td>
      <td><span style="font-weight: 600; color: #2563eb;">${project.document_count || 0}</span></td>
    </tr>
  `).join('');
}

// ==================== DISPLAY RECENT DOCUMENTS (UPDATED - NO VIEW BUTTON, ROW CLICK) ====================
function displayRecentDocuments() {
  const tableBody = document.getElementById('recentDocumentsTable');
  if (!tableBody) return;
  
  if (documents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 30px; color: #64748b;">
          <div style="font-size: 40px; margin-bottom: 10px;">📄</div>
          <div style="font-weight: 500;">No documents yet</div>
          <button class="btn" onclick="openAddDocumentModal()" style="margin-top: 16px;">Upload Your First Document</button>
        </td>
      </tr>
    `;
    return;
  }
  
  // Show only first 7 documents
  const recentDocuments = documents.slice(0, 7);
  tableBody.innerHTML = recentDocuments.map(doc => `
    <tr style="cursor: pointer;" onclick="navigateToDocuments()" title="Click to view all documents">
      <td style="font-weight: 500;">
        <a href="${doc.document_url || '#'}" target="_blank" style="color: #2563eb; text-decoration: none;" onclick="event.stopPropagation();">
          ${escapeHtml(doc.document_name)}
        </a>
      </td>
      <td>${doc.projects?.project_name || 'N/A'}</td>
      <td>${escapeHtml(doc.document_type || 'N/A')}</td>
      <td>${formatFileSize(doc.file_size)}</td>
    </tr>
  `).join('');
}

// ==================== NEW FUNCTION TO NAVIGATE TO DOCUMENTS PAGE ====================
function navigateToDocuments() {
  window.location.href = '/document';
}

// ==================== DISPLAY PROJECTS LIST ====================
function displayProjectsList() {
  const projectList = document.getElementById('dashboardProjectList');
  if (!projectList) return;
  
  if (projects.length === 0) {
    projectList.innerHTML = `
      <div style="text-align: center; color: #64748b; padding: 30px;">
        <div style="font-size: 40px; margin-bottom: 10px;">📁</div>
        <div style="font-weight: 500;">No projects</div>
      </div>
    `;
    return;
  }
  
  projectList.innerHTML = projects.slice(0, 10).map(project => `
    <div class="project-item" onclick="viewProject('${project.id}')">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1; min-width: 0;">
          <div class="project-name">${escapeHtml(project.project_name)}</div>
          <div class="project-details">${escapeHtml(project.department || 'N/A')} • ${project.document_count || 0} docs</div>
        </div>
        <div onclick="event.stopPropagation();" style="display: flex; gap: 8px; flex-shrink: 0;">
          <button class="btn-icon" onclick="openEditProjectModal('${project.id}')" title="Edit">
            ✏️
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== POPULATE PROJECT DROPDOWN ====================
function populateProjectDropdown() {
  const dropdown = document.getElementById('documentProject');
  const editDropdown = document.getElementById('editDocumentProject');
  
  const optionsHTML = '<option value="">Select Project</option>' +
    projects.map(project => `
      <option value="${project.id}">${escapeHtml(project.project_name)}</option>
    `).join('');
  
  if (dropdown) dropdown.innerHTML = optionsHTML;
  if (editDropdown) editDropdown.innerHTML = optionsHTML;
}
// ==================== POPULATE DEPARTMENT DROPDOWN WITH CUSTOM CATEGORIES ====================
function populateDepartmentDropdown() {
  const dropdown = document.getElementById('departmentName');
  if (!dropdown) return;
  
  const defaultCategories = ['Legal', 'HR', 'Operations', 'Finance', 'IT'];
  const allCategories = [...defaultCategories, ...customCategories];
  
  dropdown.innerHTML = `
    <option value="">Select Department</option>
    ${allCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('')}
    <option value="__custom__" style="color: #2563eb; font-weight: 600;">➕ Add New Category</option>
  `;
}

// ==================== HANDLE DEPARTMENT DROPDOWN CHANGE ====================
function handleDepartmentChange() {
  const dropdown = document.getElementById('departmentName');
  const customInput = document.getElementById('customDepartmentInput');
  
  if (dropdown.value === '__custom__') {
    // Show custom input
    if (!customInput) {
      const inputDiv = document.createElement('div');
      inputDiv.id = 'customDepartmentInput';
      inputDiv.style.marginTop = '8px';
      inputDiv.innerHTML = `
        <input type="text" 
               id="customDepartmentValue" 
               class="form-input" 
               placeholder="Enter new category name" 
               style="border: 2px solid #2563eb;"
               required>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button type="button" class="btn" onclick="saveNewCategory()" style="flex: 1;">Save Category</button>
          <button type="button" class="btn btn-outline" onclick="cancelNewCategory()" style="flex: 1;">Cancel</button>
        </div>
      `;
      dropdown.parentElement.appendChild(inputDiv);
      document.getElementById('customDepartmentValue').focus();
    }
  } else {
    // Remove custom input if exists
    if (customInput) {
      customInput.remove();
    }
  }
}

// ==================== SAVE NEW CATEGORY ====================
function saveNewCategory() {
  const input = document.getElementById('customDepartmentValue');
  const dropdown = document.getElementById('departmentName');
  
  if (input && input.value.trim()) {
    const newCategory = input.value.trim();
    saveCustomCategory(newCategory);
    
    // Refresh dropdown
    populateDepartmentDropdown();
    
    // Select the new category
    dropdown.value = newCategory;
    
    // Remove custom input
    const customInput = document.getElementById('customDepartmentInput');
    if (customInput) customInput.remove();
    
    showMessage(`✅ Category "${newCategory}" added successfully!`, 'success');
  } else {
    showMessage('Please enter a category name', 'error');
  }
}

// ==================== CANCEL NEW CATEGORY ====================
function cancelNewCategory() {
  const dropdown = document.getElementById('departmentName');
  const customInput = document.getElementById('customDepartmentInput');
  
  dropdown.value = '';
  if (customInput) customInput.remove();
}

// ==================== UPDATE DASHBOARD KPIs ====================
async function updateDashboardKPIs() {
  try {
    const totalProjectsEl = document.getElementById('totalProjects');
    const totalDocumentsEl = document.getElementById('totalDocuments');
    
    if (totalProjectsEl) totalProjectsEl.textContent = projects.length;
    if (totalDocumentsEl) totalDocumentsEl.textContent = totalDocumentsCount || documents.length;
    
  } catch (error) {
    console.error('Error updating KPIs:', error);
  }
}

// ==================== PROJECT MODAL FUNCTIONS ====================
function openAddProjectModal() {
  editingProjectId = null;
  const modal = document.getElementById('addProjectModal');
  const title = document.querySelector('#addProjectModal .modal-title');
  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  
  if (modal) {
    modal.classList.add('show');
    document.getElementById('projectForm')?.reset();
    populateDepartmentDropdown();
    if (title) title.textContent = 'Add New Project';
    if (submitBtn) submitBtn.textContent = 'Save Project';
  }
}

async function openEditProjectModal(projectId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Session expire ho gaya, dubara login karo');
    window.location.href = '/login';
    return;
  }
  editingProjectId = projectId;
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    showMessage('Project not found', 'error');
    return;
  }
  
  const modal = document.getElementById('addProjectModal');
  const title = document.querySelector('#addProjectModal .modal-title');
  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  
  if (modal) {
    modal.classList.add('show');
    
    // Fill form with project data
    document.getElementById('projectName').value = project.project_name || '';
    document.getElementById('departmentName').value = project.department || '';
    document.getElementById('divisionName').value = project.division || '';
    document.getElementById('status').value = project.status || 'Active';
    document.getElementById('description').value = project.description || '';
    
    if (title) title.textContent = 'Edit Project';
    if (submitBtn) submitBtn.textContent = 'Update Project';
  }
}

function closeAddProjectModal() {
  const modal = document.getElementById('addProjectModal');
  if (modal) modal.classList.remove('show');
  editingProjectId = null;
}

// ==================== DOCUMENT MODAL FUNCTIONS ====================
function openAddDocumentModal() {
  if (projects.length === 0) {
    showMessage('Please create a project first', 'error');
    return;
  }
  
  editingDocumentId = null;
  const modal = document.getElementById('addDocumentModal');
  const title = document.querySelector('#addDocumentModal .modal-title');
  const uploadBtn = document.getElementById('uploadDocBtn');
  
  if (modal) {
    modal.classList.add('show');
    
    // Reset form
    document.getElementById('documentForm')?.reset();
    
    // Show upload fields, hide edit fields
    const uploadGroup = document.getElementById('fileUploadGroup');
    const editFields = document.getElementById('editDocumentFields');
    if (uploadGroup) uploadGroup.style.display = 'block';
    if (editFields) editFields.style.display = 'none';
    
    // Hide progress bar
    const progressDiv = document.getElementById('uploadProgress');
    if (progressDiv) progressDiv.style.display = 'none';
    
    // Set title and button text
    if (title) title.textContent = '📤 Upload Document';
    if (uploadBtn) {
      uploadBtn.textContent = 'Upload Document';
      uploadBtn.disabled = false;
    }
  }
}

async function openEditDocumentModal(documentId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Session expire ho gaya, dubara login karo');
    window.location.href = '/login';
    return;
  }
  editingDocumentId = documentId;
  const doc = documents.find(d => d.id === documentId);
  
  if (!doc) {
    showMessage('Document not found', 'error');
    return;
  }
  
  const modal = document.getElementById('addDocumentModal');
  const title = document.querySelector('#addDocumentModal .modal-title');
  const uploadBtn = document.getElementById('uploadDocBtn');
  
  if (modal) {
    modal.classList.add('show');
    
    // Fill form with document data
    const docNameInput = document.getElementById('editDocumentName');
    const docProjectSelect = document.getElementById('editDocumentProject');
    
    if (docNameInput) docNameInput.value = doc.document_name || '';
    if (docProjectSelect) docProjectSelect.value = doc.project_id || '';
    
    // Hide file upload, show edit fields
    const uploadGroup = document.getElementById('fileUploadGroup');
    const editFields = document.getElementById('editDocumentFields');
    if (uploadGroup) uploadGroup.style.display = 'none';
    if (editFields) editFields.style.display = 'block';
    
    // Hide progress bar
    const progressDiv = document.getElementById('uploadProgress');
    if (progressDiv) progressDiv.style.display = 'none';
    
    // Set title and button text
    if (title) title.textContent = '✏️ Edit Document';
    if (uploadBtn) {
      uploadBtn.textContent = 'Update Document';
      uploadBtn.disabled = false;
    }
  }
}

function closeAddDocumentModal() {
  const modal = document.getElementById('addDocumentModal');
  if (modal) modal.classList.remove('show');
  
  editingDocumentId = null;
  
  // Reset form
  document.getElementById('documentForm')?.reset();
  
  // Show upload fields, hide edit fields
  const uploadGroup = document.getElementById('fileUploadGroup');
  const editFields = document.getElementById('editDocumentFields');
  if (uploadGroup) uploadGroup.style.display = 'block';
  if (editFields) editFields.style.display = 'none';
  
  // Reset upload button
  const uploadBtn = document.getElementById('uploadDocBtn');
  if (uploadBtn) {
    uploadBtn.textContent = 'Upload Document';
    uploadBtn.disabled = false;
  }
  
  // Hide progress bar
  const progressDiv = document.getElementById('uploadProgress');
  if (progressDiv) progressDiv.style.display = 'none';
}

// ==================== DELETE CONFIRMATIONS ====================
function confirmDeleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (confirm(`Are you sure you want to delete "${project.project_name}"?\n\nThis will also delete all associated documents.`)) {
    deleteProject(projectId);
  }
}

function confirmDeleteDocument(documentId) {
  const doc = documents.find(d => d.id === documentId);
  if (!doc) return;
  
  if (confirm(`Are you sure you want to delete "${doc.document_name}"?`)) {
    deleteDocument(documentId);
  }
}

// ==================== DELETE PROJECT ====================
async function deleteProject(projectId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Session expire ho gaya, dubara login karo');
    window.location.href = '/login';
    return;
  }
  try {
    showMessage('Deleting project...', 'info');
    
    // First, get all documents for this project
    const { data: projectDocs, error: docsError } = await supabase
      .from('documents')
      .select('document_url')
      .eq('project_id', projectId);
    
    if (docsError) throw docsError;
    
    // Delete documents from storage
    if (projectDocs && projectDocs.length > 0) {
      for (const doc of projectDocs) {
        if (doc.document_url) {
          const fileName = doc.document_url.split('/').pop();
          const filePath = `${currentUserId}/${fileName}`;
          
          await supabase.storage
            .from('documents')
            .remove([filePath]);
        }
      }
      
      // Delete documents from database
      const { error: deleteDocsError } = await supabase
        .from('documents')
        .delete()
        .eq('project_id', projectId);
      
      if (deleteDocsError) throw deleteDocsError;
    }
    
    // Delete the project
    const { error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    
    if (projectError) throw projectError;
    
    showMessage('✅ Project deleted successfully!', 'success');
    await loadProjects();
    await loadDocuments();
    
  } catch (error) {
    console.error('Delete project error:', error);
    showMessage('Failed to delete project: ' + error.message, 'error');
  }
}

// ==================== DELETE DOCUMENT ====================
async function deleteDocument(documentId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Session expire ho gaya, dubara login karo');
    window.location.href = '/login';
    return;
  }
  try {
    showMessage('Deleting document...', 'info');
    
    const doc = documents.find(d => d.id === documentId);
    if (!doc) {
      showMessage('Document not found', 'error');
      return;
    }
    
    // Delete from storage
    if (doc.document_url) {
      const fileName = doc.document_url.split('/').pop();
      const filePath = `${currentUserId}/${fileName}`;
      
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
      
      if (storageError) console.warn('Storage deletion warning:', storageError);
    }
    
    // Delete from database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
    
    if (dbError) throw dbError;
    
    // NO NEED to decrement project document count - it's calculated from actual documents
    
    showMessage('✅ Document deleted successfully!', 'success');
    await loadDocuments();
    await loadProjects(); // Reload to recalculate counts
    
  } catch (error) {
    console.error('Delete document error:', error);
    showMessage('Failed to delete document: ' + error.message, 'error');
  }
}

// ==================== HANDLE PROJECT FORM SUBMISSION ====================
document.addEventListener('DOMContentLoaded', function() {
  const projectForm = document.getElementById('projectForm');
  if (projectForm) {
    projectForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      try {
        const formData = {
          project_name: document.getElementById('projectName').value,
          department: document.getElementById('departmentName').value,
          division: document.getElementById('divisionName').value,
          status: document.getElementById('status').value,
          description: document.getElementById('description').value,
          updated_at: new Date().toISOString()
        };
        
        if (editingProjectId) {
          // Update existing project
          const { data, error } = await supabase
            .from('projects')
            .update(formData)
            .eq('id', editingProjectId)
            .select();
          
          if (error) throw error;
          
          showMessage('✅ Project updated successfully!', 'success');
        } else {
          // Create new project - DON'T set document_count
          formData.user_id = currentUserId;
          formData.created_at = new Date().toISOString();
          
          const { data, error } = await supabase
            .from('projects')
            .insert([formData])
            .select();
          
          if (error) throw error;
          
          showMessage('✅ Project created successfully!', 'success');
        }
        
        closeAddProjectModal();
        await loadProjects();
        
      } catch (error) {
        console.error('Error saving project:', error);
        showMessage('Failed to save project', 'error');
      }
    });
  }
  
  const departmentDropdown = document.getElementById('departmentName');
  if (departmentDropdown) {
    departmentDropdown.addEventListener('change', handleDepartmentChange);
  }
});

// ==================== HANDLE DOCUMENT UPLOAD/EDIT ====================
document.addEventListener('DOMContentLoaded', function() {
  const documentForm = document.getElementById('documentForm');
  if (documentForm) {
    documentForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (editingDocumentId) {
        // Edit existing document
        await updateDocument();
      } else {
        // Upload new document
        await uploadNewDocument();
      }
    });
  }
});

async function updateDocument() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Session expire ho gaya, dubara login karo');
    window.location.href = '/login';
    return;
  }
  try {
    const documentName = document.getElementById('editDocumentName').value.trim();
    const projectId = document.getElementById('editDocumentProject').value;
    
    // Manual validation for edit mode
    if (!documentName) {
      showMessage('Please enter document name', 'error');
      document.getElementById('editDocumentName').focus();
      return;
    }
    
    if (!projectId) {
      showMessage('Please select a project', 'error');
      document.getElementById('editDocumentProject').focus();
      return;
    }
    
    const { error } = await supabase
      .from('documents')
      .update({
        document_name: documentName,
        project_id: projectId,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingDocumentId);
    
    if (error) throw error;
    
    // NO NEED to update document counts - they're calculated
    
    showMessage('✅ Document updated successfully!', 'success');
    closeAddDocumentModal();
    await loadDocuments();
    await loadProjects(); // Reload to recalculate counts
    
  } catch (error) {
    console.error('Update document error:', error);
    showMessage('Failed to update document: ' + error.message, 'error');
  }
}

// ==================== ENHANCED: UPLOAD NEW DOCUMENT FROM DASHBOARD ====================
async function uploadNewDocument() {
  const fileInput = document.getElementById('documentFile');
  const projectId = document.getElementById('documentProject').value;
  const customName = document.getElementById('documentName').value;
  const uploadBtn = document.getElementById('uploadDocBtn');
  const progressDiv = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  
  // Manual validation for upload mode
  if (!fileInput.files[0]) {
    showMessage('Please select a file', 'error');
    fileInput.focus();
    return;
  }
  
  if (!projectId) {
    showMessage('Please select a project', 'error');
    document.getElementById('documentProject').focus();
    return;
  }
  
  const file = fileInput.files[0];
  
  // Validate file size (25MB max)
  if (file.size > 25 * 1024 * 1024) {
    showMessage('File size must be less than 25MB', 'error');
    return;
  }
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Uploading file...';
    
    // Sanitize filename to remove special characters that cause issues with Supabase
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
    
    // Create unique filename
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${currentUserId}/${Date.now()}_${sanitizedFileName}`;
    
    // Upload to Supabase Storage
    progressBar.style.width = '30%';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    progressBar.style.width = '60%';
    progressText.textContent = 'Saving document info...';
    
    // Get public URL
    const publicUrlResult = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);
    const publicUrl = (publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl) ? publicUrlResult.data.publicUrl : '';
    
    // Save document metadata to database
    const documentData = {
      user_id: currentUserId,
      project_id: projectId,
      document_name: customName || file.name,
      document_url: publicUrl,
      document_type: fileExt.toUpperCase(),
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: savedDoc, error: dbError } = await supabase
      .from('documents')
      .insert([documentData])
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    // ✅ ENHANCED: Extract text based on file type
    console.log('📄 Starting text extraction for Qdrant...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for file availability
    
    let extractedContent = '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt);
    const isExtractable = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'].includes(fileExt);
    
    if (isExtractable || isImage) {
      try {
        console.log(`📖 Extracting text from ${fileExt.toUpperCase()}...`);
        
        let retries = 5;
        let lastError = null;
        
        while (retries > 0 && extractedContent.length === 0) {
          try {
            console.log(`   Attempt ${6 - retries}/5...`);
            
            if (fileExt === 'pdf') {
              // Try regular PDF extraction first
              extractedContent = await extractTextFromDocument(publicUrl, fileExt);
              
              // If looks like OCR failed, try GCS-based OCR
              if (extractedContent && (extractedContent.includes('OCR failed') || extractedContent.includes('Scanned PDF processed'))) {
                console.log('   ⚠️ Regular extraction had issues, trying GCS-based OCR...');
                const result = await extractTextFromDocumentWithGCS(publicUrl, fileExt, file.name);
                extractedContent = result.text;
              }
            } else if (isImage) {
              // For images, use image extraction
              extractedContent = await extractTextFromDocument(publicUrl, fileExt);
            } else {
              // For other documents (DOCX, XLSX, TXT)
              extractedContent = await extractTextFromDocument(publicUrl, fileExt);
            }
            
            if (extractedContent && extractedContent.length > 0) {
              console.log(`✅ Extracted ${extractedContent.length} characters`);
              break;
            } else {
              console.warn(`⚠️ Extraction returned empty (${retries} retries left)`);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
          } catch (err) {
            lastError = err;
            console.error(`❌ Extraction error (${retries} retries left):`, err.message);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }
        
        if (extractedContent.length === 0) {
          console.error(`❌ Failed to extract text from ${file.name} after 5 attempts`);
          if (lastError) console.error('   Last error:', lastError.message);
          showMessage(`⚠️ Could not extract text from ${file.name}`, 'warning');
        }
      } catch (extractError) {
        console.error('❌ Text extraction error:', extractError);
      }
    }
    
    // Save to Qdrant
    try {
      await saveToQdrant(
        savedDoc.id,
        file.name,
        extractedContent,
        projectId,
        publicUrl,
        isImage
      );
      console.log('✅ Saved to Qdrant');
    } catch (qdrantError) {
      console.error('❌ Qdrant save error:', qdrantError);
    }
    
    progressBar.style.width = '100%';
    progressText.textContent = '✅ Upload complete!';
    
    setTimeout(async () => {
      showMessage('✅ Document uploaded successfully!', 'success');
      closeAddDocumentModal();
      await loadDocuments();
      await loadProjects();
    }, 500);
    
  } catch (error) {
    console.error('Upload error:', error);
    showMessage('Failed to upload document: ' + error.message, 'error');
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Document';
    progressDiv.style.display = 'none';
  }
}

// ==================== EXTRACT TEXT FROM DOCUMENT ====================
async function extractTextFromDocument(documentUrl, documentType) {
  try {
    console.log(`📄 Extracting text from ${documentType.toUpperCase()} document...`);
    
    const response = await fetch(`/api/extract-document-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        documentUrl, 
        documentType: documentType.toLowerCase() 
      })
    });

    const data = await response.json();

    if (data.success && data.text) {
      console.log(`✅ Text extracted: ${data.textLength} characters`);
      console.log(`   Preview: ${data.text.substring(0, 200)}...`);
      return data.text;
    } else {
      console.warn(`⚠️ Text extraction failed:`, data.error);
      return '';
    }
  } catch (error) {
    console.error(`❌ Text extraction error:`, error);
    return '';
  }
}

// ==================== SAVE TO QDRANT ====================
async function saveToQdrant(documentId, documentName, content, projectId, documentUrl, isImage = false) {
  try {
    if (!projectId) {
      console.error('❌ Project ID is required for Qdrant save');
      return false;
    }

    // Get project name
    const project = projects.find(p => p.id === projectId);
    const projectName = project ? project.project_name : null;
    
    const fileExt = documentName.split('.').pop().toLowerCase();
    const documentType = fileExt.toUpperCase();

    console.log('💾 Saving to Qdrant:', {
      documentName,
      documentType,
      contentLength: content?.length || 0,
      isImage
    });

    const response = await fetch(`/api/save-to-qdrant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        documentName,
        content,
        projectId,
        projectName,
        documentType,
        documentUrl,
        isImage
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ ${isImage ? 'Image' : 'Document'} saved to Qdrant`);
      console.log(`   Collection: ${data.collectionName}`);
      console.log(`   Content indexed: ${data.contentLength} characters`);
      return true;
    } else {
      console.error('❌ Qdrant save failed:', data.error);
      return false;
    }

  } catch (error) {
    console.error('❌ Qdrant API error:', error);
    return false;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showMessage(message, type = 'success') {
  let bgColor = '#10b981'; // success
  if (type === 'error') bgColor = '#dc2626';
  if (type === 'info') bgColor = '#2563eb';
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 3000;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease;
    max-width: 90%;
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 4000);
}

// Sidebar toggle functionality for mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebar) {
        sidebar.classList.toggle('show');
        
        // Optional: Add overlay when sidebar is open on mobile
        if (window.innerWidth <= 768) {
            let overlay = document.getElementById('sidebarOverlay');
            
            if (sidebar.classList.contains('show')) {
                // Create overlay if it doesn't exist
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'sidebarOverlay';
                    overlay.style.cssText = `
                        position: fixed;
                        top: 64px;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        z-index: 998;
                        backdrop-filter: blur(2px);
                    `;
                    overlay.onclick = toggleSidebar;
                    document.body.appendChild(overlay);
                }
            } else {
                // Remove overlay
                if (overlay) {
                    overlay.remove();
                }
            }
        }
    }
}


function viewDocument(docId) {
  // Navigate to documents page
  window.location.href = '/document';
}

function viewProject(projectId) {
  // Store project ID in localStorage for project page to open
  localStorage.setItem('cm_view_project', projectId);
  // Navigate to projects page
  window.location.href = '/project';
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Dashboard initializing...');
  try {
    await checkAuth();
    console.log('✅ Dashboard initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
  }
});