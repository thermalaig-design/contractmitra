// ==================== GLOBAL VARIABLES ====================

let documents = [];
let projects = [];
let currentUserId = null;
let filteredDocuments = [];

console.log('📄 Enhanced Documents page loading with multi-format support...');

// ==================== SUPPORTED FILE TYPES ====================
const DOCUMENT_TYPES = {
  pdf: { icon: '📄', class: 'document-pdf', name: 'PDF', extractable: true },
  docx: { icon: '📝', class: 'document-docx', name: 'Word', extractable: true },
  doc: { icon: '📝', class: 'document-docx', name: 'Word', extractable: true },
  xlsx: { icon: '📊', class: 'document-xlsx', name: 'Excel', extractable: true },
  xls: { icon: '📊', class: 'document-xlsx', name: 'Excel', extractable: true },
  txt: { icon: '📃', class: 'document-default', name: 'Text', extractable: true },
  // Images
  jpg: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false },
  jpeg: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false },
  png: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false },
  gif: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false },
  webp: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false },
  svg: { icon: '🖼️', class: 'document-image', name: 'Image', extractable: false }
};

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const EXTRACTABLE_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'];

// ==================== CHECK IF FILE IS IMAGE ====================
function isImageFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

// ==================== CHECK IF FILE IS EXTRACTABLE ====================
function isExtractableFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return EXTRACTABLE_EXTENSIONS.includes(ext);
}

// ==================== ✅ ENHANCED: EXTRACT TEXT FROM ANY DOCUMENT ====================
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

// ==================== GCS-BASED OCR FUNCTION (MODIFIED TO HANDLE IMAGES) ====================
async function extractTextFromDocumentWithGCS(documentUrl, documentType, documentName) {
  try {
    console.log(`☁️ Extracting text from ${documentType.toUpperCase()} document with LOCAL OCR...`);
    
    const response = await fetch(`/api/extract-document-text-gcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        documentUrl, 
        documentType: documentType.toLowerCase(),
        documentName
      })
    });

    const data = await response.json();

    if (data.success && data.text) {
      console.log(`✅ LOCAL OCR text extracted: ${data.textLength} characters`);
      // If images were saved, log them
      if (data.images && data.images.length > 0) {
        console.log(`✅ ${data.images.length} images saved:`);
        data.images.forEach(img => console.log(`   - ${img.url}`));
      }
      return data; // Return the full data object including text and images
    } else {
      console.warn('⚠️ LOCAL OCR extraction failed:', data.error || 'Unknown error');
      throw new Error(data.error || 'LOCAL OCR extraction failed');
    }
  } catch (error) {
    console.error('❌ LOCAL OCR extraction error:', error);
    throw error;
  }
}

// ==================== SAVE TO QDRANT ====================
async function saveToQdrant(documentId, documentName, content, projectId, documentUrl, isImage = false) {
  try {
    if (!projectId) {
      console.error('❌ Project ID is required for Qdrant save');
      return false;
    }

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

// ==================== DELETE FROM QDRANT ====================
async function deleteFromQdrant(documentId, projectId) {
  try {
    if (!projectId) {
      console.warn('⚠️ Project ID missing for deletion');
      return false;
    }

    const url = `/api/delete-from-qdrant/${documentId}?projectId=${projectId}`;
    const response = await fetch(url, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      console.log('✅ Deleted from Qdrant:', documentId);
      return true;
    } else {
      console.warn('⚠️ Qdrant delete warning:', data.error);
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Qdrant delete error:', error);
    return false;
  }
}

// ==================== CREATE COLLECTION FOR PROJECT ====================
async function createCollectionForProject(projectId, projectName) {
  try {
    if (!projectId) {
      console.warn('⚠️ Cannot create collection without project ID');
      return false;
    }

    const response = await fetch(`/api/create-collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectName })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Collection created:', data.collectionName);
      return true;
    } else {
      console.error('❌ Collection creation failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Collection API error:', error);
    return false;
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

    const localUser = localStorage.getItem('cm_user');
    if (localUser) {
      try {
        const userData = JSON.parse(localUser);
        currentUserId = userData.id;
        console.log('✅ User from localStorage:', userData.email);
        displayUserInfo(userData);

        supabase.auth.getSession().then(({ data: { session } }) => {
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

document.addEventListener('click', function (event) {
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
    window.location.href = '/login'; // Changed from '../Registration/loginSignUp.html'
  } catch (error) {
    console.error('Logout error:', error);
    showMessage('Logout failed', 'error');
  }
}

// ==================== LOAD PROJECTS ====================
async function loadProjects() {
  try {
    console.log('Loading projects...');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    projects = data || [];
    console.log(`✅ Loaded ${projects.length} projects`);

    if (projects.length > 0) {
      console.log('Creating Qdrant collections for projects...');
      for (const project of projects) {
        await createCollectionForProject(project.id, project.project_name);
      }
    } else {
      console.log('⚠️ No projects found. Please create a project first.');
    }

    populateProjectDropdown();

  } catch (error) {
    console.error('Error loading projects:', error);
    showMessage('Failed to load projects', 'error');
  }
}

// ==================== POPULATE PROJECT DROPDOWN ====================
function populateProjectDropdown() {
  const dropdown = document.getElementById('linkedProject');
  const filterDropdown = document.getElementById('projectFilter');

  const optionsHTML = '<option value="">⚠️ Select Project (Required)</option>' +
    projects.map(project => `
      <option value="${project.id}">${escapeHtml(project.project_name)}</option>
    `).join('');

  if (dropdown) {
    dropdown.innerHTML = optionsHTML;
    dropdown.style.borderColor = '#dc2626';
    dropdown.addEventListener('change', function() {
      if (this.value) {
        this.style.borderColor = '#10b981';
      } else {
        this.style.borderColor = '#dc2626';
      }
    });
    
    // Check if coming from project details page
    const selectedProjectId = localStorage.getItem('cm_selected_project');
    if (selectedProjectId) {
      dropdown.value = selectedProjectId;
      dropdown.style.borderColor = '#10b981';
      
      // Clear the stored project ID
      localStorage.removeItem('cm_selected_project');
      
      // Auto-open upload modal
      setTimeout(() => {
        openUploadModal();
      }, 500);
    }
  }

  if (filterDropdown) {
    filterDropdown.innerHTML = '<option value="">All Projects</option>' +
      projects.map(project => `
        <option value="${project.id}">${escapeHtml(project.project_name)}</option>
      `).join('');
  }
}

// ==================== LOAD DOCUMENTS ====================
async function loadDocuments() {
  try {
    console.log('Loading documents...');

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        projects (
          project_name
        )
      `)
      .eq('user_id', currentUserId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    documents = data || [];
    filteredDocuments = [...documents];

    console.log(`✅ Loaded ${documents.length} documents`);

    renderDocuments();
    updateStats();

  } catch (error) {
    console.error('Error loading documents:', error);
    showMessage('Failed to load documents', 'error');
  }
}

// ==================== UPDATE STATS ====================
function updateStats() {
  const totalDocs = documents.length;
  const recentDocs = documents.filter(doc => {
    const uploadDate = new Date(doc.uploaded_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return uploadDate > weekAgo;
  }).length;

  const totalSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);

  document.getElementById('totalDocuments').textContent = totalDocs;
  document.getElementById('recentUploads').textContent = recentDocs;
  document.getElementById('pendingReview').textContent = '0';
  document.getElementById('storageUsed').textContent = sizeInGB + ' GB';
}

// ==================== RENDER DOCUMENTS ====================
function renderDocuments() {
  const grid = document.getElementById('documentsGrid');

  if (filteredDocuments.length === 0) {
    grid.innerHTML = `
      <div class="empty-documents" style="grid-column: 1 / -1;">
        <div class="empty-documents-icon">📄</div>
        <h3>No Documents Found</h3>
        <p>${projects.length === 0 ? '⚠️ Please create a project first before uploading documents' : 'Upload your first document or image to get started'}</p>
        ${projects.length > 0 ? '<button class="btn" onclick="openUploadModal()">📤 Upload Files</button>' : '<button class="btn" onclick="window.location.href=\'../Project/project.html\'">➕ Create Project First</button>'}
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredDocuments.map(doc => {
    const fileExt = (doc.document_type || '').toLowerCase();
    const fileInfo = DOCUMENT_TYPES[fileExt] || { icon: '📄', class: 'document-default', name: 'File' };
    
    const isImage = isImageFile(doc.document_name);
    const projectName = doc.projects?.project_name || '⚠️ No Project';
    const fileSize = formatFileSize(doc.file_size);
    const uploadDate = formatDate(doc.uploaded_at);

    let displayContent = `<div class="document-icon ${fileInfo.class}">${fileInfo.icon}</div>`;
    
    if (isImage && doc.document_url) {
      displayContent = `
        <div class="document-image-preview" style="
          width: 100%;
          height: 150px;
          background-image: url('${doc.document_url}');
          background-size: cover;
          background-position: center;
          border-radius: 8px;
          margin-bottom: 12px;
        "></div>
      `;
    }

    return `
      <div class="document-card ${isImage ? 'is-image' : ''}">
        ${displayContent}
        <div class="document-name">${escapeHtml(doc.document_name)}</div>
        <div class="document-project">${escapeHtml(projectName)}</div>
        <div class="document-meta">
          <span>${fileSize}</span>
          <span>${uploadDate}</span>
        </div>
        <div class="document-actions">
          <button class="action-btn primary" onclick="viewDocument('${doc.id}')">
            ${isImage ? 'View' : 'Open'}
          </button>
          <button class="action-btn" onclick="downloadDocument('${doc.id}')">Download</button>
          <button class="action-btn" onclick="deleteDocument('${doc.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== DOCUMENT ACTIONS ====================
function viewDocument(docId) {
  const doc = documents.find(d => d.id === docId);
  if (doc && doc.document_url) {
    window.open(doc.document_url, '_blank');
  }
}

function downloadDocument(docId) {
  const doc = documents.find(d => d.id === docId);
  if (doc && doc.document_url) {
    const link = document.createElement('a');
    link.href = doc.document_url;
    link.download = doc.document_name;
    link.click();
  }
}

// ==================== DELETE DOCUMENT ====================
async function deleteDocument(docId) {
  if (!confirm('Are you sure you want to delete this file?')) return;

  try {
    showMessage('🗑️ Deleting file...', 'info');
    
    const doc = documents.find(d => d.id === docId);
    if (!doc) {
      showMessage('File not found', 'error');
      return;
    }

    if (doc.document_url) {
      const fileName = doc.document_url.split('/').pop();
      const filePath = `${currentUserId}/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
        
      if (storageError) {
        console.warn('Storage delete warning:', storageError);
      }
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (dbError) throw dbError;

    if (doc.project_id) {
      await deleteFromQdrant(docId, doc.project_id);
    }

    showMessage('✅ File deleted successfully!', 'success');
    await loadDocuments();

  } catch (error) {
    console.error('Delete error:', error);
    showMessage('Failed to delete file: ' + error.message, 'error');
  }
}

// ==================== MODAL FUNCTIONS ====================
function openUploadModal() {
  if (projects.length === 0) {
    showMessage('⚠️ Please create a project first before uploading documents', 'error');
    setTimeout(() => {
      if (confirm('No projects found. Would you like to create one now?')) {
        window.location.href = '../Project/project.html';
      }
    }, 500);
    return;
  }

  document.getElementById('uploadModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  document.body.style.overflow = 'auto';
  document.getElementById('uploadForm').reset();

  const dropdown = document.getElementById('linkedProject');
  if (dropdown) {
    dropdown.style.borderColor = '#dc2626';
  }

  document.querySelector('.file-upload-text').innerHTML = `
    <strong>Click to select files</strong> or drag and drop<br>
    Documents: PDF, DOCX, XLSX, TXT<br>
    Images: JPG, PNG, GIF, WEBP, SVG<br>
    Max 10MB per file
  `;
}

// ==================== ✅ ENHANCED: FILE UPLOAD WITH MULTI-FORMAT SUPPORT ====================
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('documentFiles');
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        const fileNames = files.map(f => {
          const isImg = isImageFile(f.name);
          const ext = f.name.split('.').pop().toLowerCase();
          const typeInfo = DOCUMENT_TYPES[ext] || DOCUMENT_TYPES['txt'];
          return `${typeInfo.icon} ${f.name}`;
        }).join('<br>');
        
        document.querySelector('.file-upload-text').innerHTML =
          `<strong>${files.length} file(s) selected:</strong><br>${fileNames}`;
      }
    });
  }

  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const files = fileInput.files;
      if (files.length === 0) {
        showMessage('⚠️ Please select at least one file', 'error');
        return;
      }

      const projectId = document.getElementById('linkedProject').value;
      if (!projectId) {
        showMessage('⚠️ Please select a project before uploading', 'error');
        const dropdown = document.getElementById('linkedProject');
        dropdown.style.borderColor = '#dc2626';
        dropdown.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
        dropdown.focus();
        return;
      }

      const progressBar = document.getElementById('progressBar');
      const progressContainer = document.getElementById('uploadProgressContainer');
      const uploadMessage = document.getElementById('uploadMessage');
      const uploadPercentage = document.getElementById('uploadPercentage');

      // Show progress container
      console.log('Showing progress container');
      progressContainer.style.display = 'block';
      
      // Ensure progress bar is properly initialized
      if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.transition = 'width 0.3s ease';
        console.log('Progress bar initialized to 0%');
      }
      
      if (uploadPercentage) {
        uploadPercentage.textContent = '0%';
        console.log('Percentage text set to 0%');
      }
      
      if (uploadMessage) {
        uploadMessage.textContent = 'Starting upload...';
        console.log('Message set to Starting upload...');
      }
      
      // Force reflow to ensure UI update
      progressContainer.offsetHeight;
      console.log('Forced reflow');

      try {
        let successCount = 0;
        let failCount = 0;
        const totalFiles = files.length;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const currentFileNum = i + 1;
          
          // Update progress message
          uploadMessage.textContent = `Uploading file ${currentFileNum} of ${totalFiles}: ${file.name}`;
          
          // Calculate and update progress
          const baseProgress = (i / totalFiles) * 100;
          console.log(`Updating progress: ${baseProgress}% for file ${i+1}/${totalFiles}`);
          
          // Ensure progress bar element exists before updating
          if (progressBar) {
            progressBar.style.width = `${baseProgress}%`;
            console.log(`Progress bar width set to ${baseProgress}%`);
          }
          
          // Ensure percentage element exists before updating
          if (uploadPercentage) {
            uploadPercentage.textContent = `${Math.round(baseProgress)}%`;
            console.log(`Percentage text set to ${Math.round(baseProgress)}%`);
          }
          
          // Force reflow to ensure UI update
          if (progressBar) {
            progressBar.offsetHeight;
          }
          
          // Small delay to make progress visible
          await new Promise(resolve => setTimeout(resolve, 100));

          if (file.size > 25 * 1024 * 1024) {
            showMessage(`${file.name} is too large (max 25MB)`, 'error');
            failCount++;
            continue;
          }

          try {
            const fileExt = file.name.split('.').pop().toLowerCase();
            const fileName = `${currentUserId}/${Date.now()}_${file.name}`;
            const isImage = isImageFile(file.name);
            const isExtractable = isExtractableFile(file.name);

            // Sanitize filename to remove special characters that cause issues with Supabase
            const sanitizedFileName = file.name
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
              .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
            
            const sanitizedFullFileName = `${currentUserId}/${Date.now()}_${sanitizedFileName}`;

            console.log(`📤 Uploading: ${file.name} (${fileExt})`);
// Step 1: Upload to Supabase Storage
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('documents')
  .upload(sanitizedFullFileName, file);

if (uploadError) throw uploadError;

const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(sanitizedFullFileName);

console.log('✅ File uploaded to storage');

// ⚠️ CRITICAL: Wait longer for file to be accessible
console.log('⏳ Waiting for file to be fully available...');
await new Promise(resolve => setTimeout(resolve, 8000)); // 👈 CHANGED: 5 seconds instead of 2

console.log('✅ Starting text extraction...');
// âœ… Step 2: Extract text content for supported formats
// ✅ Step 2: Extract text content for supported formats
let extractedContent = '';
let extractedImages = []; // To store any images generated during OCR

if (isExtractable) {
  console.log(`📖 Extracting text from ${fileExt.toUpperCase()}...`);
  
  // 👇 ENHANCED: Try extraction with MORE retries and longer delays
  let retries = 5; // Increased from 3
  let lastError = null;
  
  while (retries > 0 && extractedContent.length === 0) {
    try {
      console.log(`   Attempt ${6 - retries}/5...`);
      console.log(`   🔗 Fetching from: ${publicUrl.substring(0, 100)}...`);  // ✅ ADD THIS
      
      // First try regular text extraction which correctly handles readable vs scanned PDFs
      if (fileExt === 'pdf') {
        // Try regular PDF extraction first (this will use pdf-parse for readable PDFs and OCR only for scanned PDFs)
        extractedContent = await extractTextFromDocument(publicUrl, fileExt);
        
        // Check if we got meaningful content or if it looks like OCR failed
        if (extractedContent && extractedContent.length > 0) {
          // If the content looks like an OCR failure message, try the GCS-based OCR
          if (extractedContent.includes('OCR failed') || extractedContent.includes('Scanned PDF processed')) {
            console.log('   ⚠️ Regular extraction had issues, trying GCS-based OCR...');
            const result = await extractTextFromDocumentWithGCS(publicUrl, fileExt, file.name);
            extractedContent = result.text;
            extractedImages = result.images || []; // Get any images that were saved
          } else {
            console.log('   ✅ Regular extraction successful, no need for OCR');
          }
        } else {
          // If no content was extracted, try GCS-based OCR
          console.log('   ⚠️ No content extracted, trying GCS-based OCR...');
          const result = await extractTextFromDocumentWithGCS(publicUrl, fileExt, file.name);
          extractedContent = result.text;
          extractedImages = result.images || []; // Get any images that were saved
        }
      } else {
        extractedContent = await extractTextFromDocument(publicUrl, fileExt);
      }
      
      if (extractedContent && extractedContent.length > 0) {
        console.log(`✅ Extracted ${extractedContent.length} characters`);
        console.log(`   Preview: ${extractedContent.substring(0, 200)}...`);
        // If images were extracted, log them
        if (extractedImages.length > 0) {
          console.log(`✅ ${extractedImages.length} images generated during OCR:`);
          extractedImages.forEach(img => console.log(`   - ${img.url}`));
        }
        break;
      } else {
        console.warn(`⚠️ Extraction returned empty (${retries} retries left)`);
        retries--;
        if (retries > 0) {
          console.log(`   Waiting 3 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between retries
        }
      }
    } catch (err) {
      lastError = err;
      console.error(`❌ Extraction error (${retries} retries left):`, err.message);
      retries--;
      if (retries > 0) {
        console.log(`   Waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  if (extractedContent.length === 0) {
    const errorMsg = `❌ Failed to extract text from ${file.name} after 5 attempts`;
    console.error(errorMsg);
    if (lastError) console.error('   Last error:', lastError.message);
    showMessage(`⚠️ Could not extract text from ${file.name}`, 'warning');
  }

}
            // Step 3: Save to Supabase Database
            const documentData = {
              user_id: currentUserId,
              project_id: projectId,
              document_name: file.name,
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

            console.log('✅ Document saved to database');

            // ✅ Step 4: Save to Qdrant WITH EXTRACTED CONTENT
            console.log('💾 Saving to Qdrant with content...');
            const qdrantSuccess = await saveToQdrant(
              savedDoc.id,
              file.name,
              extractedContent,
              projectId,
              publicUrl,
              isImage
            );

            if (qdrantSuccess) {
              console.log('✅ Saved to Qdrant successfully');
            } else {
              console.warn('⚠️ Qdrant save had issues');
            }

            // Step 5: Increment project document count
            await supabase.rpc('increment_document_count', {
              project_id: projectId
            });

            successCount++;
            
            // Update progress after successful upload
            const progress = ((i + 1) / totalFiles) * 100;
            console.log(`File upload successful, updating progress to: ${progress}%`);
            
            // Ensure progress bar element exists before updating
            if (progressBar) {
              progressBar.style.width = `${progress}%`;
              console.log(`Progress bar width set to ${progress}%`);
            }
            
            // Ensure percentage element exists before updating
            if (uploadPercentage) {
              uploadPercentage.textContent = `${Math.round(progress)}%`;
              console.log(`Percentage text set to ${Math.round(progress)}%`);
            }
            
            // Force reflow to ensure UI update
            if (progressBar) {
              progressBar.offsetHeight;
            }
            
            // Small delay to make progress visible
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (i + 1 === totalFiles) {
              console.log('All files uploaded, showing completion message');
              // Ensure message element exists before updating
              if (uploadMessage) {
                uploadMessage.textContent = 'Upload complete! Processing...';
                console.log('Completion message set');
              }
                      
              // Force reflow to ensure UI update
              if (progressContainer) {
                progressContainer.offsetHeight;
              }
            }

          } catch (fileError) {
            console.error(`Error uploading ${file.name}:`, fileError);
            failCount++;
            
            // Update progress even on failure
            const progress = ((i + 1) / totalFiles) * 100;
            console.log(`File upload failed, updating progress to: ${progress}%`);
            
            // Ensure progress bar element exists before updating
            if (progressBar) {
              progressBar.style.width = `${progress}%`;
              console.log(`Progress bar width set to ${progress}%`);
            }
            
            // Ensure percentage element exists before updating
            if (uploadPercentage) {
              uploadPercentage.textContent = `${Math.round(progress)}%`;
              console.log(`Percentage text set to ${Math.round(progress)}%`);
            }
            
            // Force reflow to ensure UI update
            if (progressBar) {
              progressBar.offsetHeight;
            }
            
            // Small delay to make progress visible
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (successCount > 0) {
          showMessage(`✅ Successfully uploaded ${successCount} file(s)!`, 'success');
        }
        if (failCount > 0) {
          showMessage(`⚠️ Failed to upload ${failCount} file(s)`, 'error');
        }

        closeUploadModal();
        await loadDocuments();

      } catch (error) {
        console.error('Upload error:', error);
        showMessage('Upload failed: ' + error.message, 'error');
      } finally {
        console.log('Upload process completed, hiding progress bar');
        // Hide progress after a short delay
        setTimeout(() => {
          progressContainer.style.display = 'none';
          if (progressBar) {
            progressBar.style.width = '0%';
          }
          if (uploadPercentage) {
            uploadPercentage.textContent = '0%';
          }
          if (uploadMessage) {
            uploadMessage.textContent = 'Starting upload...';
          }
          
          // Force reflow to ensure UI update
          if (progressContainer) {
            progressContainer.offsetHeight;
          }
          console.log('Progress bar reset and hidden');
        }, 1500);
      }
    });
  }
});

// ==================== SEARCH & FILTER ====================
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('searchDocuments');
  if (searchInput) {
    searchInput.addEventListener('input', filterDocuments);
  }

  const projectFilter = document.getElementById('projectFilter');
  if (projectFilter) {
    projectFilter.addEventListener('change', filterDocuments);
  }

  const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) {
    typeFilter.addEventListener('change', filterDocuments);
  }
});

function filterDocuments() {
  const searchTerm = document.getElementById('searchDocuments').value.toLowerCase();
  const projectFilter = document.getElementById('projectFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;

  filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchTerm) ||
      doc.projects?.project_name?.toLowerCase().includes(searchTerm);

    const matchesProject = !projectFilter || doc.project_id === projectFilter;
    const matchesType = !typeFilter || doc.document_type === typeFilter;

    return matchesSearch && matchesProject && matchesType;
  });

  renderDocuments();
}

// ==================== DRAG & DROP ====================
document.addEventListener('DOMContentLoaded', function () {
  const uploadArea = document.getElementById('uploadArea');

  if (uploadArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('dragover');
      });
    });

    uploadArea.addEventListener('drop', function (e) {
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        if (projects.length === 0) {
          showMessage('⚠️ Please create a project first', 'error');
          return;
        }

        openUploadModal();
        document.getElementById('documentFiles').files = files;

        const event = new Event('change', { bubbles: true });
        document.getElementById('documentFiles').dispatchEvent(event);
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

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
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

document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeUploadModal();
    });
  }
});

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function () {
  console.log('📄 Enhanced Documents page initializing...');
  console.log('✅ Multi-format support: PDF, DOCX, XLSX, TXT, Images');

  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  await loadProjects();
  await loadDocuments();

  console.log('✅ Documents page initialized with enhanced extraction');
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