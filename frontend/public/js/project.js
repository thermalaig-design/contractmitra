// ==================== GLOBAL VARIABLES ====================
let projects = [];
let filteredProjects = [];
let currentUserId = null;
let currentSort = 'desc';
let editingProjectId = null;
let customCategories = [];
let currentProjectId = null;
let currentProjectDocuments = [];

// ==================== BACKEND URL ====================


console.log('Projects page loading...');
// ==================== LOAD CUSTOM CATEGORIES ====================
async function loadCustomCategories() {
  try {
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
// ==================== POPULATE DEPARTMENT DROPDOWN ====================
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
// ==================== POPULATE DEPARTMENT FILTER DROPDOWN ====================
function populateDepartmentFilter() {
  const filterDropdown = document.getElementById('departmentFilter');
  if (!filterDropdown) return;
  
  const defaultCategories = ['Legal', 'HR', 'Operations', 'Finance', 'IT'];
  const allCategories = [...new Set([...defaultCategories, ...customCategories])]; // Duplicates remove karne ke liye
  
  filterDropdown.innerHTML = `
    <option value="">All Departments</option>
    ${allCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('')}
  `;
}
// ==================== HANDLE DEPARTMENT CHANGE ====================
function handleDepartmentChange() {
  const dropdown = document.getElementById('departmentName');
  const customInput = document.getElementById('customDepartmentInput');
  
  if (dropdown.value === '__custom__') {
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
    if (customInput) customInput.remove();
  }
}
// ==================== SAVE NEW CATEGORY ====================
function saveNewCategory() {
  const input = document.getElementById('customDepartmentValue');
  const dropdown = document.getElementById('departmentName');
  
  if (input && input.value.trim()) {
    const newCategory = input.value.trim();
    saveCustomCategory(newCategory);
    
    populateDepartmentDropdown();
    dropdown.value = newCategory;
        populateDepartmentFilter();

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
// ==================== WAIT FOR SUPABASE ====================
async function waitForSupabase() {
  let attempts = 0;
  while (!window.supabase && attempts < 100) {
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }
  if (!window.supabase) throw new Error('Supabase not loaded');
  console.log('✅ Supabase loaded');
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
        console.log('✅ User from localStorage:', userData.email);
        displayUserInfo(userData);
        
        // Background mein session verify karo
        supabase.auth.getSession().then(({data: {session}}) => {
          if (!session) {
            console.log('⚠️ Session expired, redirecting...');
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
    await loadUserData();
    return true;
    
  } catch (error) {
    console.error('Auth error:', error);
    window.location.href = '/login';
    return false;
  }
}


// ==================== LOAD USER DATA ====================
async function loadUserData() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Always load from contractor_profiles table first
    const { data: profileData, error: profileError } = await supabase
      .from('contractor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let userData;
    
    if (profileData && !profileError) {
      // Use profile data from database
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
    } else {
      // Fallback to auth user if no profile found
      userData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 
                   user.user_metadata?.name || 
                   user.email?.split('@')[0] || 'User',
        avatar_url: user.user_metadata?.picture
      };
    }
    
    // Always update localStorage with latest data
    localStorage.setItem('cm_user', JSON.stringify(userData));
    displayUserInfo(userData);
  } catch (error) {
    console.error('Error loading user:', error);
    // On error, try to use localStorage as fallback
    const localData = localStorage.getItem('cm_user');
    if (localData) {
      try {
        const userData = JSON.parse(localData);
        displayUserInfo(userData);
      } catch (e) {
        console.error('Error parsing localStorage data:', e);
      }
    }
  }
}

// ==================== DISPLAY USER INFO ====================
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
    showMessage('Logout failed', 'error');
  }
}

// ==================== LOAD PROJECTS ====================
async function loadProjects() {
  try {
    console.log('Loading projects...');
    await loadCustomCategories();
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        documents:documents(count)
      `)
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Document count properly set karo
    projects = (data || []).map(project => ({
      ...project,
      document_count: project.documents?.[0]?.count || 0
    }));
    
    console.log(`✅ Loaded ${projects.length} projects`);
    
    filteredProjects = [...projects];
     populateDepartmentFilter();
    filterAndSortProjects();
    
  } catch (error) {
    console.error('Error loading projects:', error);
    showMessage('Failed to load projects', 'error');
  }
}

// ==================== UPDATE STATISTICS ====================
function updateStats() {
  const totalProjects = filteredProjects.length;
  const activeProjects = filteredProjects.filter(p => p.status === 'Active').length;
  const completedProjects = filteredProjects.filter(p => p.status === 'Completed').length;
  const totalDocuments = filteredProjects.reduce((sum, p) => sum + (p.document_count || 0), 0);

  document.getElementById('totalProjects').textContent = totalProjects;
  document.getElementById('activeProjects').textContent = activeProjects;
  document.getElementById('completedProjects').textContent = completedProjects;
  document.getElementById('totalDocuments').textContent = totalDocuments;
}

// ==================== FILTER AND SORT ====================
function filterAndSortProjects() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const departmentFilter = document.getElementById('departmentFilter').value;

  filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchTerm) ||
                          project.department?.toLowerCase().includes(searchTerm) ||
                          project.division?.toLowerCase().includes(searchTerm);
    
    const matchesStatus = !statusFilter || project.status === statusFilter;
    const matchesDepartment = !departmentFilter || project.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Sorting
  filteredProjects.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    
    return currentSort === 'desc' ? dateB - dateA : dateA - dateB;
  });

  renderProjectsTable();
  updateStats();
}

// ==================== VIEW PROJECT DETAILS ====================
async function viewProjectDetails(projectId) {
  currentProjectId = projectId;
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    showMessage('Project not found', 'error');
    return;
  }
  
  // Open modal with show class
  const modal = document.getElementById('projectDetailsModal');
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Populate project details
  document.getElementById('detailProjectName').textContent = project.project_name;
  document.getElementById('detailDepartment').textContent = project.department || 'N/A';
  document.getElementById('detailDivision').textContent = project.division || 'N/A';
  document.getElementById('detailDocCount').textContent = project.document_count || 0;
  
  // Format dates
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const updatedDate = new Date(project.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  document.getElementById('detailCreatedDate').textContent = createdDate;
  document.getElementById('detailUpdatedDate').textContent = updatedDate;
  
  // Status badge
  const statusBadge = document.getElementById('detailProjectStatus');
  statusBadge.textContent = project.status;
  statusBadge.className = 'status-badge status-' + project.status.toLowerCase().replace(' ', '');
  
  // Description
  const descBox = document.getElementById('detailDescription');
  descBox.textContent = project.description || 'No description available for this project.';
  
  // Load documents
  await loadProjectDocuments(projectId);
}

// ==================== LOAD PROJECT DOCUMENTS ====================
async function loadProjectDocuments(projectId) {
  const docsList = document.getElementById('projectDocumentsList');
  
  try {
    // Show loading
    docsList.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    `;
    
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    
    currentProjectDocuments = documents || [];


    if (!documents || documents.length === 0) {
      docsList.innerHTML = `
        <div class="empty-documents">
          <div class="empty-documents-icon">📄</div>
          <h4>No Documents Yet</h4>
          <p>Upload documents to get started with this project</p>
          <button class="btn" onclick="uploadDocumentToProject()">📤 Upload Document</button>
        </div>
      `;
      
      // Update storage to 0
      document.getElementById('detailStorage').textContent = '0 MB';
      return;
    }
    
    // Calculate total storage
    let totalStorage = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    let storageText = '0 MB';
    
    if (totalStorage < 1024 * 1024) {
      storageText = (totalStorage / 1024).toFixed(1) + ' KB';
    } else {
      storageText = (totalStorage / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    document.getElementById('detailStorage').textContent = storageText;
    
    // Render documents
    docsList.innerHTML = documents.map(doc => {
      const fileExt = (doc.document_type || '').toLowerCase();
      let iconClass = 'default';
      let icon = '📄';
      
      if (fileExt === 'pdf') {
        iconClass = 'pdf';
        icon = '📄';
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        iconClass = 'docx';
        icon = '📝';
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        iconClass = 'xlsx';
        icon = '📊';
      }
      
      const fileSize = formatFileSize(doc.file_size);
      const uploadDate = new Date(doc.uploaded_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      return `
        <div class="document-item">
          <div class="doc-icon ${iconClass}">${icon}</div>
          <div class="doc-info">
            <div class="doc-name">${escapeHtml(doc.document_name)}</div>
            <div class="doc-meta">${fileSize} • Uploaded ${uploadDate}</div>
          </div>
          <div class="doc-actions">
            <button class="doc-btn primary" onclick="viewDocument('${doc.id}')">View</button>
            <button class="doc-btn" onclick="downloadDocument('${doc.id}')">Download</button>
            <button class="doc-btn" onclick="deleteDocumentFromProject('${doc.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading documents:', error);
    docsList.innerHTML = `
      <div class="empty-documents">
        <div class="empty-documents-icon">❌</div>
        <h4>Error Loading Documents</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// ==================== DOCUMENT ACTIONS ====================
function viewDocument(docId) {
  const doc = currentProjectDocuments.find(d => d.id === docId);
  if (doc && doc.document_url) {
    window.open(doc.document_url, '_blank');
  }
}

function downloadDocument(docId) {
  const doc = currentProjectDocuments.find(d => d.id === docId);
  if (doc && doc.document_url) {
    const link = document.createElement('a');
    link.href = doc.document_url;
    link.download = doc.document_name;
    link.click();
  }
}

async function deleteDocumentFromProject(docId) {
  if (!confirm('Are you sure you want to delete this document?')) return;
  
  try {
    // You'll need to load all documents first
    const { data: allDocs } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', currentProjectId);
    
    const doc = allDocs.find(d => d.id === docId);
    if (!doc) return;
    
    // Delete from storage
    if (doc.document_url) {
      const fileName = doc.document_url.split('/').pop();
      const filePath = `${currentUserId}/${fileName}`;
      
      await supabase.storage
        .from('documents')
        .remove([filePath]);
    }
    
    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);
    
    if (error) throw error;
    
    showMessage('✅ Document deleted successfully!', 'success');
    
    // Reload documents and projects
    await loadProjectDocuments(currentProjectId);
    await loadProjects();
    
  } catch (error) {
    console.error('Delete error:', error);
    showMessage('Failed to delete document', 'error');
  }
}

// ==================== HELPER FUNCTIONS ====================
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== CLOSE PROJECT DETAILS ====================
function closeProjectDetails() {
  const modal = document.getElementById('projectDetailsModal');
  modal.classList.remove('show');
  document.body.style.overflow = 'auto';
  currentProjectId = null;
}


// ==================== EDIT CURRENT PROJECT ====================
function editCurrentProject() {
  if (!currentProjectId) {
    showMessage('No project selected', 'error');
    return;
  }
  
  // Close details modal first
  closeProjectDetails();
  
  // Small delay for smooth transition
  setTimeout(() => {
    openEditProjectModal(currentProjectId);
  }, 300);
}
// ==================== DELETE CURRENT PROJECT ====================
function deleteCurrentProject() {
  if (!currentProjectId) {
    showMessage('No project selected', 'error');
    return;
  }
  
  const project = projects.find(p => p.id === currentProjectId);
  if (!project) {
    showMessage('Project not found', 'error');
    return;
  }
  
  // Close details modal first
  closeProjectDetails();
  
  // Small delay then show confirmation
  setTimeout(() => {
    confirmDeleteProject(currentProjectId);
  }, 300);
}

// ==================== CONFIRM DELETE PROJECT ====================
function confirmDeleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    showMessage('Project not found', 'error');
    return;
  }
  
  const docCount = project.document_count || 0;
  let message = `⚠️ Are you sure you want to delete "${project.project_name}"?`;
  
  if (docCount > 0) {
    message += `\n\n📄 This project has ${docCount} document(s) that will also be deleted.`;
  }
  
  message += '\n\n🚨 This action cannot be undone!';
  
  if (confirm(message)) {
    deleteProject(projectId);
  }
}
// ==================== UPLOAD DOCUMENT TO PROJECT ====================
function uploadDocumentToProject() {
  if (!currentProjectId) {
    showMessage('No project selected', 'error');
    return;
  }
  
  // Store project ID in localStorage for document page to use
  localStorage.setItem('cm_selected_project', currentProjectId);
  
  // Navigate to document page
  window.location.href = '/document';
}

// Close modal on outside click
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('projectDetailsModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) closeProjectDetails();
    });
  }
});


// ==================== RENDER TABLE ====================
function renderProjectsTable() {
  const tableBody = document.getElementById('projectsTableBody');
  const emptyState = document.getElementById('emptyState');
  
  if (filteredProjects.length === 0) {
    tableBody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  tableBody.innerHTML = '';
  
  filteredProjects.forEach(project => {
    const row = document.createElement('tr');
    
    const statusClass = `status-${project.status.toLowerCase().replace(' ', '')}`;
    
    row.innerHTML = `
      <td class="project-name-cell" onclick="viewProjectDetails('${project.id}')">
        ${escapeHtml(project.project_name)}
      </td>
      <td onclick="viewProjectDetails('${project.id}')">
        <span class="department-badge">${escapeHtml(project.department || 'N/A')}</span>
      </td>
      <td onclick="viewProjectDetails('${project.id}')">${escapeHtml(project.division || 'N/A')}</td>
      <td onclick="viewProjectDetails('${project.id}')">
        <span class="status-badge ${statusClass}">${escapeHtml(project.status)}</span>
      </td>
      <td onclick="viewProjectDetails('${project.id}')">
        <span class="documents-count">📄 ${project.document_count || 0}</span>
      </td>
      <td onclick="viewProjectDetails('${project.id}')">${new Date(project.created_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openEditProjectModal('${project.id}')" title="Edit Project">
          ✏️
        </button>
        <button class="btn-icon btn-danger" onclick="confirmDeleteProject('${project.id}')" title="Delete Project">
          🗑️
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}
// ==================== OPEN EDIT PROJECT MODAL ====================
async function openEditProjectModal(projectId) {
  try {
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showMessage('Session expired. Please login again.', 'error');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
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
      // First populate dropdown
      populateDepartmentDropdown();
      
      // Then fill form with project data
      setTimeout(() => {
        document.getElementById('projectName').value = project.project_name || '';
        document.getElementById('departmentName').value = project.department || '';
        document.getElementById('divisionName').value = project.division || '';
        document.getElementById('status').value = project.status || 'Active';
        document.getElementById('description').value = project.description || '';
      }, 100);
      
      // Update modal UI
      if (title) title.textContent = '✏️ Edit Project';
      if (submitBtn) submitBtn.textContent = 'Update Project';
      
      // Open modal with show class
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  } catch (error) {
    console.error('Edit modal error:', error);
    showMessage('Failed to open edit modal', 'error');
  }
}
// ==================== CONFIRM DELETE PROJECT ====================


// ==================== DELETE PROJECT ====================
async function deleteProject(projectId) {
  try {
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showMessage('Session expired. Please login again.', 'error');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }
    
    showMessage('🗑️ Deleting project...', 'info');
    
    // Get project info for confirmation
    const project = projects.find(p => p.id === projectId);
    const projectName = project ? project.project_name : 'Unknown';
    
    // First, get all documents for this project
    const { data: projectDocs, error: docsError } = await supabase
      .from('documents')
      .select('document_url, id')
      .eq('project_id', projectId);
    
    if (docsError) throw docsError;
    
    // Delete documents from storage and database
    if (projectDocs && projectDocs.length > 0) {
      console.log(`Deleting ${projectDocs.length} documents...`);
      
      for (const doc of projectDocs) {
        if (doc.document_url) {
          try {
            const fileName = doc.document_url.split('/').pop();
            const filePath = `${currentUserId}/${fileName}`;
            
            await supabase.storage
              .from('documents')
              .remove([filePath]);
          } catch (storageError) {
            console.error('Storage delete error:', storageError);
            // Continue even if storage delete fails
          }
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
      .eq('id', projectId)
      .eq('user_id', currentUserId); // Extra security check
    
    if (projectError) throw projectError;
    
    showMessage(`✅ Project "${projectName}" deleted successfully!`, 'success');
    
    // Reload projects
    await loadProjects();
    
  } catch (error) {
    console.error('Delete project error:', error);
    showMessage(`❌ Failed to delete project: ${error.message}`, 'error');
  }
}
// ==================== VIEW PROJECT DETAILS ====================
// function viewProjectDetails(projectId) {
  // Future: Project detail page pe navigate karo
//   console.log('View project:', projectId);
//   showMessage('Project details page coming soon!', 'info');
// }

// ==================== MODAL FUNCTIONS ====================
function openAddProjectModal() {
  editingProjectId = null;
  const modal = document.getElementById('addProjectModal');
  modal.classList.add('show');
  document.getElementById('projectForm')?.reset();
  document.body.style.overflow = 'hidden';
  populateDepartmentDropdown();
  
  // Modal title update
  const title = document.querySelector('#addProjectModal .modal-title');
  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  if (title) title.textContent = 'Add New Project';
  if (submitBtn) submitBtn.textContent = 'Save Project';
}

// ==================== MODAL FUNCTIONS ====================
function closeAddProjectModal() {
  const modal = document.getElementById('addProjectModal');
  if (modal) {
    modal.classList.remove('show');
  }
  
  document.body.style.overflow = 'auto';
  
  // Reset form
  const form = document.getElementById('projectForm');
  if (form) {
    form.reset();
  }
  
  // Remove custom department input if exists
  const customInput = document.getElementById('customDepartmentInput');
  if (customInput) {
    customInput.remove();
  }
  
  // Reset modal to default state
  const title = document.querySelector('#addProjectModal .modal-title');
  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  if (title) title.textContent = 'Add New Project';
  if (submitBtn) submitBtn.textContent = 'Save Project';
  
  editingProjectId = null;
}
// ==================== CREATE PROJECT ====================
// ==================== CREATE/UPDATE PROJECT ====================
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
          status: document.getElementById('status').value || 'Active',
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
          // Create new project
          formData.user_id = currentUserId;
          formData.document_count = 0;
          formData.created_at = new Date().toISOString();
          
          const { data, error } = await supabase
            .from('projects')
            .insert([formData])
            .select();
          
          if (error) throw error;
          
          showMessage('✅ Project created successfully!', 'success');

          // Create Qdrant collection for this new project
          if(Array.isArray(data) && data[0] && data[0].id){
            try {
              const response = await fetch(`/api/create-collection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: data[0].id, projectName: data[0].project_name })
              });
              const resp = await response.json();
              if(resp.success){
                console.log('Qdrant collection created:', resp.collectionName);
              } else {
                console.warn('Qdrant collection create failed:', resp.error);
              }
            } catch(qerr){
              console.error('Qdrant collection create error:', qerr);
            }
          }
        }
        
        closeAddProjectModal();
        await loadProjects();
        
      } catch (error) {
        console.error('Error saving project:', error);
        showMessage('Failed to save project', 'error');
      }
    });
  }
});

// ==================== HELPER FUNCTIONS ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(message, type = 'success') {
  let bgColor = '#10b981';
  if (type === 'error') bgColor = '#dc2626';
  if (type === 'info') bgColor = '#2563eb';
  
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

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('show');
    
    // Add overlay for mobile
    if (sidebar.classList.contains('show')) {
      const overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 998;
      `;
      overlay.onclick = toggleSidebar;
      document.body.appendChild(overlay);
    } else {
      const overlay = document.getElementById('sidebarOverlay');
      if (overlay) overlay.remove();
    }
  }
}

// Close sidebar on window resize
window.addEventListener('resize', function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (window.innerWidth > 768) {
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.remove();
  }
});

// Close sidebar when clicking on sidebar links (mobile)
document.addEventListener('DOMContentLoaded', function() {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  
  sidebarItems.forEach(item => {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar) sidebar.classList.remove('show');
        if (overlay) overlay.remove();
      }
    });
  });
});

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Projects page initializing...');
  
  // Auth check pehle
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;
  
  // Projects load karo
  await loadProjects();
  
  // Check if a specific project should be opened
  const viewProjectId = localStorage.getItem('cm_view_project');
  if (viewProjectId) {
    // Clear the localStorage item
    localStorage.removeItem('cm_view_project');
    // Open project details modal
    setTimeout(() => {
      viewProjectDetails(viewProjectId);
    }, 300); // Small delay to ensure everything is loaded
  }
  
  const departmentDropdown = document.getElementById('departmentName');
  if (departmentDropdown) {
    departmentDropdown.addEventListener('change', handleDepartmentChange);
  }
  // Search input
  document.getElementById('searchInput').addEventListener('input', filterAndSortProjects);
  
  // Filter dropdowns
  document.getElementById('statusFilter').addEventListener('change', filterAndSortProjects);
  document.getElementById('departmentFilter').addEventListener('change', filterAndSortProjects);
  
  // Sort buttons
  document.getElementById('sortDesc').addEventListener('click', function() {
    currentSort = 'desc';
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    filterAndSortProjects();
  });
  
  document.getElementById('sortAsc').addEventListener('click', function() {
    currentSort = 'asc';
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    filterAndSortProjects();
  });

  // Close modal on outside click
  document.getElementById('addProjectModal').addEventListener('click', function(e) {
    if (e.target === this) closeAddProjectModal();
  });
  
  console.log('✅ Projects page initialized');
});

// ==================== LISTEN FOR PROFILE UPDATES ====================
window.addEventListener('userProfileUpdated', function(event) {
    if (event.detail && typeof displayUserInfo === 'function') {
        console.log('Profile updated event received, updating display...');
        displayUserInfo(event.detail);
    }
});

window.addEventListener('storage', function(event) {
    if (event.key === 'cm_user' && event.newValue && typeof displayUserInfo === 'function') {
        try {
            const updatedUserData = JSON.parse(event.newValue);
            console.log('Profile updated in another tab, updating display...');
            displayUserInfo(updatedUserData);
        } catch (e) {
            console.error('Error parsing updated user data:', e);
        }
    }
});