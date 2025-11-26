/* ==================== COPY THIS ENTIRE CODE ==================== */
/* Paste at the TOP of your chatbot.js file */

// ===== EMERGENCY FIX: Force hide overlay on page load =====
(function() {
    'use strict';
    
    // Run as soon as possible
    function forceHideOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
            overlay.style.visibility = 'hidden';
            overlay.style.opacity = '0';
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
    }
    
    // Run immediately
    forceHideOverlay();
    
    // Run on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', forceHideOverlay);
    
    // Run on window load (backup)
    window.addEventListener('load', forceHideOverlay);
})();

// ===== Sidebar Toggle Function =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) return;
    
    const isActive = sidebar.classList.contains('active');
    
    if (isActive) {
        // Close sidebar
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.position = '';
    } else {
        // Open sidebar
        sidebar.classList.add('active');
        overlay.classList.add('active');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// ===== Close Sidebar Function =====
function closeChatSidebar() {
    const sidebar = document.getElementById('sidebar');
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        sidebar.classList.remove('active');
    }
    
    if (chatSidebar) {
        chatSidebar.classList.remove('open');
    }
    
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        overlay.style.visibility = 'hidden';
        overlay.style.opacity = '0';
    }
    
    document.body.style.overflow = '';
    document.body.style.position = '';
}

// ===== Auto-close on window resize =====
window.addEventListener('resize', function() {
    clearTimeout(window.chatResizeTimer);
    window.chatResizeTimer = setTimeout(function() {
        // Close sidebar when going to desktop size
        if (window.innerWidth > 768) {
            closeChatSidebar();
        }
    }, 250);
});

// ===== Close on ESC key =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
        closeChatSidebar();
    }
});

// ===== Overlay click handler =====
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('sidebarOverlay');
    
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeChatSidebar();
            }
        });
    }
});

// ===== Prevent scroll when sidebar open =====
function preventScroll(prevent) {
    if (prevent) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    } else {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
}

// ===== Project Filter Modal Functions =====
function openProjectFilter() {
    const modal = document.getElementById('projectFilterModal');
    const selectBtn = document.getElementById('projectSelectBtn');
    
    if (modal) {
        modal.classList.add('active');
        preventScroll(true);
    }
    
    if (selectBtn) {
        selectBtn.classList.add('open');
    }
}

function closeProjectFilter() {
    const modal = document.getElementById('projectFilterModal');
    const selectBtn = document.getElementById('projectSelectBtn');
    
    if (modal) {
        modal.classList.remove('active');
        preventScroll(false);
    }
    
    if (selectBtn) {
        selectBtn.classList.remove('open');
    }
}

// ===== Sidebar Tab Functions =====
function showSidebarTab(tab) {
    const historyTab = document.getElementById('tabHistory');
    const quickTab = document.getElementById('tabQuick');
    const historySection = document.getElementById('chatHistorySection');
    const quickSection = document.getElementById('quickActionsSection');
    
    if (tab === 'history') {
        if (historyTab) {
            historyTab.classList.add('active');
            historyTab.style.background = '#eff6ff';
        }
        if (quickTab) {
            quickTab.classList.remove('active');
            quickTab.style.background = '#fff';
        }
        if (historySection) historySection.style.display = 'flex';
        if (quickSection) quickSection.style.display = 'none';
    } else if (tab === 'quick') {
        if (quickTab) {
            quickTab.classList.add('active');
            quickTab.style.background = '#eff6ff';
        }
        if (historyTab) {
            historyTab.classList.remove('active');
            historyTab.style.background = '#fff';
        }
        if (quickSection) quickSection.style.display = 'block';
        if (historySection) historySection.style.display = 'none';
    }
}

// ===== Debug Helper (Remove in production) =====
window.debugOverlay = function() {
    const overlay = document.getElementById('sidebarOverlay');
    console.log('Overlay element:', overlay);
    console.log('Display:', overlay ? overlay.style.display : 'not found');
    console.log('Classes:', overlay ? overlay.className : 'not found');
    console.log('Active:', overlay ? overlay.classList.contains('active') : 'not found');
};

console.log('✅ Sidebar toggle functions loaded');

/* ==================== END OF JS FIX ==================== */
// ==================== CONFIGURATION ====================
// Use relative path to support deployment on the same origin
const BACKEND_URL = '';
const TEMPLATE_API_BASE = `${BACKEND_URL}/api/templates`;

// ==================== CHAT APPLICATION STATE ====================
let currentChatId = 1;
let isAITyping = false;
let messageHistory = [];
let chatSessions = new Map();
let currentUser = null;
let selectedProjectId = null;
let selectedProjectName = null;
let selectedDepartment = null;
let selectedDivision = null;
let selectedStatus = null;
let uploadedDocuments = [];
let availableProjects = [];
let projectDocuments = []; // ✅ Store documents for selected project
let qdrantDocumentCount = 0; // ✅ NEW: Track Qdrant indexed count
let currentConversationId = null;
let isAutoSaveEnabled = true;
let chatHistoryList = [];
let isSidebarCollapsed = false;
let preferredSidebarCollapsed = false;
// ==================== SUPABASE CONNECTION ====================
let supabase = null;
let supabaseAccessToken = null;

function formatDocumentCount(count = 0) {
    if (!count) return '0 documents';
    return count === 1 ? '1 document' : `${count} documents`;
}

function updateProjectContextMeta() {
    const docCountEl = document.getElementById('projectDocumentCount');
    if (docCountEl) {
        docCountEl.textContent = formatDocumentCount(projectDocuments.length || 0);
    }
}

function setAssistantStatus(statusText = 'Ready') {
    const statusEl = document.getElementById('assistantStatusText');
    if (statusEl) {
        statusEl.textContent = statusText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateProjectContextMeta();
    setAssistantStatus('Ready');
});

async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabase && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    if (!window.supabase) throw new Error('Supabase not loaded');
    supabase = window.supabase;
    console.log('✅ Supabase loaded in chatbot');
}

// ==================== AUTHENTICATION CHECK ====================
async function checkAuth() {
    try {
        await waitForSupabase();

        const localUser = localStorage.getItem('cm_user');
        if (localUser) {
            const userData = JSON.parse(localUser);
            currentUser = userData;
            // Try to refresh/access session to get a valid access token
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                supabaseAccessToken = session.access_token;
                localStorage.setItem('cm_token', supabaseAccessToken);
                
                // Always refresh from database to get latest profile data
                const { data: profileData, error: profileError } = await supabase
                    .from('contractor_profiles')
                    .select('*')
                    .eq('user_id', userData.id)
                    .single();

                if (profileData && !profileError) {
                    // Update with latest profile data
                    const updatedUserData = {
                        id: profileData.user_id || userData.id,
                        email: profileData.email || userData.email,
                        full_name: profileData.full_name || userData.full_name,
                        avatar_url: profileData.profile_picture_url || userData.avatar_url,
                        profile_picture_url: profileData.profile_picture_url,
                        phone: profileData.phone,
                        location: profileData.location,
                        company_name: profileData.company_name,
                        expertise: profileData.expertise
                    };
                    localStorage.setItem('cm_user', JSON.stringify(updatedUserData));
                    displayUserInfo(updatedUserData);
                } else {
                    displayUserInfo(userData);
                }
            } else {
                // No active session, force re-login to satisfy RLS
                console.warn('No Supabase session found, redirecting to login');
                window.location.href = '/login';
                return false;
            }
            console.log('✅ User authenticated from localStorage');
            return true;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            console.log('No session - redirecting to login');
            window.location.href = '/login';
            return false;
        }

        currentUser = session.user;
        supabaseAccessToken = session.access_token;
        
        // Load profile from contractor_profiles table
        const { data: profileData, error: profileError } = await supabase
            .from('contractor_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        let userData;
        
        if (profileData && !profileError) {
            // Use profile data from database
            userData = {
                id: profileData.user_id || session.user.id,
                email: profileData.email || session.user.email,
                full_name: profileData.full_name || session.user.email?.split('@')[0] || 'User',
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
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || 
                           session.user.user_metadata?.name || 
                           session.user.email?.split('@')[0] || 'User',
                avatar_url: session.user.user_metadata?.picture
            };
        }
        
        localStorage.setItem('cm_user', JSON.stringify(userData));
        if (supabaseAccessToken) {
            localStorage.setItem('cm_token', supabaseAccessToken);
        }
        displayUserInfo(userData);
        return true;

    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = '/login';
        return false;
    }
}


// ==================== AUTH HEADER HELPER ====================
function getAuthHeaders(extra = {}) {
    try {
        const token = supabaseAccessToken || localStorage.getItem('cm_token');
        const headers = { ...extra };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    } catch (_) {
        return { ...extra };
    }
}

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

// ==================== MOBILE SIDEBAR FIX ====================
// Ensure sidebar is closed on mobile load
document.addEventListener('DOMContentLoaded', function() {
    function ensureMobileSidebarClosed() {
        if (window.innerWidth <= 768) {
            const chatSidebar = document.getElementById('chatSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            
            // Close chat sidebar on mobile
            if (chatSidebar && chatSidebar.classList.contains('open')) {
                chatSidebar.classList.remove('open');
            }
            
            // Hide overlay
            if (overlay && overlay.classList.contains('active')) {
                overlay.classList.remove('active');
            }
        }
    }
    
    // Run on load
    ensureMobileSidebarClosed();
    
    // Run on resize
    window.addEventListener('resize', function() {
        clearTimeout(window.resizeTimer2);
        window.resizeTimer2 = setTimeout(ensureMobileSidebarClosed, 250);
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            const chatSidebar = document.getElementById('chatSidebar');
            const toggleBtn = document.querySelector('.sidebar-toggle-chat');
            const overlay = document.getElementById('sidebarOverlay');
            
            if (chatSidebar && chatSidebar.classList.contains('open')) {
                // If click is not on sidebar or toggle button
                if (!chatSidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
                    chatSidebar.classList.remove('open');
                    if (overlay) {
                        overlay.classList.remove('active');
                    }
                }
            }
        }
    });
});

// ==================== INITIALIZE CHAT PAGE ====================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🤖 AI Chatbot initializing...');
    
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return;
    }

    // ✅ FIXED: Load quick actions from Supabase FIRST
    await loadQuickActions();
    
    // Load available projects
    await loadAvailableProjects();
    
    // Setup chat history first
    setupChatHistory();
    
    // Personalize welcome message
    personalizeWelcomeMessage();
    
    // Setup suggested questions
    setupSuggestedQuestions();
    
    // Setup chat input
    setupChatInput();
    
    // Setup file upload
    setupFileUpload();
    
    // Setup project selector
    setupProjectSelector();
    
    // Setup mobile responsiveness
    setupMobileResponsive();
    
    // ✅ Ensure mobile sidebar is closed on load
    ensureMobileSidebarClosed();
    
    console.log('✅ AI Chatbot initialized');
    console.log('📂 Loaded', availableProjects.length, 'projects');
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

// ==================== LOAD PROJECTS FROM SUPABASE ====================
async function loadAvailableProjects() {
    try {
        if (!currentUser) return;

        const { data, error } = await supabase
            .from('projects')
            .select('*, document_count:documents(count)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Process projects with document counts
        availableProjects = (data || []).map(project => ({
            ...project,
            document_count: project.document_count?.[0]?.count || 0
        }));

        console.log(`✅ Loaded ${availableProjects.length} projects for chatbot`);
        
        // Log projects with document counts
        availableProjects.forEach(p => {
            console.log(`  📁 ${p.project_name}: ${p.document_count} documents`);
        });

    } catch (error) {
        console.error('Error loading projects:', error);
        showMessage('Failed to load projects', 'error');
    }
}

// ==================== LOAD PROJECT DOCUMENTS ====================
async function loadProjectDocuments(projectId) {
    if (!projectId || projectId === 'null') {
        projectDocuments = [];
        qdrantDocumentCount = 0;
        updateProjectContextMeta();
        return;
    }

    try {
        console.log(`📄 Loading documents for project: ${projectId}`);
        
        // ✅ Load from Supabase
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', currentUser.id)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;

        projectDocuments = data || [];
        console.log(`✅ Loaded ${projectDocuments.length} documents from Supabase`);
        updateProjectContextMeta();
        
        // Log document names
        if (projectDocuments.length > 0) {
            console.log('  Documents in Supabase:');
            projectDocuments.forEach(doc => {
                console.log(`    • ${doc.document_name} (${doc.document_type})`);
            });
        }

        // ✅ Check Qdrant status
        await verifyDocumentsInQdrant(projectId);

        return projectDocuments;

    } catch (error) {
        console.error('Error loading project documents:', error);
        projectDocuments = [];
        qdrantDocumentCount = 0;
        updateProjectContextMeta();
        return [];
    }
}

// ==================== VERIFY DOCUMENTS IN QDRANT ====================
async function verifyDocumentsInQdrant(projectId) {
    try {
        console.log('🔍 Verifying documents in Qdrant...');
        
        const response = await fetch(`${BACKEND_URL}/api/check-collection`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ projectId })
        });

        const data = await response.json();

        if (data.success) {
            qdrantDocumentCount = data.documentsCount || 0;
            console.log(`✅ Qdrant collection: ${data.collectionName}`);
            console.log(`   📊 Documents indexed in Qdrant: ${qdrantDocumentCount}`);
            console.log(`   📊 Documents in Supabase: ${projectDocuments.length}`);
            
            // ⚠️ Alert if mismatch
            if (qdrantDocumentCount === 0 && projectDocuments.length > 0) {
                console.warn('⚠️ MISMATCH: Documents in Supabase but NOT in Qdrant!');
                showMessage(`⚠️ ${projectDocuments.length} documents need to be indexed in vector database`, 'info');
            } else if (qdrantDocumentCount !== projectDocuments.length) {
                console.warn(`⚠️ MISMATCH: Supabase has ${projectDocuments.length} docs, Qdrant has ${qdrantDocumentCount}`);
                showMessage(`⚠️ Document count mismatch (DB: ${projectDocuments.length}, Indexed: ${qdrantDocumentCount})`, 'info');
            } else if (qdrantDocumentCount > 0) {
                console.log(`✅ All ${qdrantDocumentCount} documents are indexed and ready!`);
            }
        }

    } catch (error) {
        console.warn('Could not verify Qdrant collection:', error);
        qdrantDocumentCount = 0;
    }
}

// ==================== PROJECT SELECTOR FUNCTIONS ====================
function setupProjectSelector() {
    populateFilterDropdowns();
    filterProjects();
    
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('projectFilterModal');
        const btn = document.getElementById('projectSelectBtn');
        
        if (modal && btn && !modal.contains(e.target) && !btn.contains(e.target)) {
            closeProjectFilter();
        }
    });
}

function populateFilterDropdowns() {
    const departments = [...new Set(availableProjects.map(p => p.department))].filter(Boolean).sort();
    const divisions = [...new Set(availableProjects.map(p => p.division))].filter(Boolean).sort();
    
    const deptFilter = document.getElementById('deptFilter');
    const divisionFilter = document.getElementById('divisionFilter');
    
    if (deptFilter) {
        deptFilter.innerHTML = '<option value="">All Departments</option>' +
            departments.map(dept => `<option value="${dept}">${dept}</option>`).join('');
    }
    
    if (divisionFilter) {
        divisionFilter.innerHTML = '<option value="">All Divisions</option>' +
            divisions.map(div => `<option value="${div}">${div}</option>`).join('');
    }
}

function openProjectFilter() {
    const modal = document.getElementById('projectFilterModal');
    const btn = document.getElementById('projectSelectBtn');
    
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    if (btn) {
        btn.classList.add('open');
    }
    
    setTimeout(() => {
        const searchInput = document.getElementById('projectSearchInput');
        if (searchInput) searchInput.focus();
    }, 100);
}

function closeProjectFilter() {
    const modal = document.getElementById('projectFilterModal');
    const btn = document.getElementById('projectSelectBtn');
    
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    if (btn) {
        btn.classList.remove('open');
    }
}

function filterProjects() {
    const deptFilter = document.getElementById('deptFilter')?.value || '';
    const divisionFilter = document.getElementById('divisionFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const searchInput = document.getElementById('projectSearchInput')?.value.toLowerCase() || '';
    
    let filteredList = availableProjects.filter(project => {
        const matchesDept = !deptFilter || project.department === deptFilter;
        const matchesDivision = !divisionFilter || project.division === divisionFilter;
        const matchesStatus = !statusFilter || project.status === statusFilter;
        const matchesSearch = !searchInput || 
            project.project_name?.toLowerCase().includes(searchInput) ||
            project.description?.toLowerCase().includes(searchInput);
        
        return matchesDept && matchesDivision && matchesStatus && matchesSearch;
    });
    
    renderFilteredProjects(filteredList);
    updateResultsCount(filteredList.length);
}

function renderFilteredProjects(projectList) {
    const container = document.getElementById('filteredProjects');
    
    if (!container) return;
    
    if (projectList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No Projects Found</h3>
                <p>Try adjusting your filters to find projects</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projectList.map(project => {
        const docCount = project.document_count || 0;
        const docText = docCount === 1 ? 'document' : 'documents';
        
        return `
        <div class="project-option ${selectedProjectId === project.id ? 'selected' : ''}" 
             onclick="selectProject('${project.id}', '${escapeHtml(project.project_name)}', '${escapeHtml(project.department || '')}', '${escapeHtml(project.division || '')}', '${escapeHtml(project.status || '')}')" 
             data-project-id="${project.id}">
            <div class="project-option-content">
                <div class="project-option-header">
                    <div class="project-name">${escapeHtml(project.project_name)}</div>
                    <div class="project-status status-${(project.status || '').toLowerCase().replace(' ', '')}">${project.status || 'Active'}</div>
                </div>
                <div class="project-details">${escapeHtml(project.description || 'No description available')}</div>
                <div class="project-meta">
                    <div class="meta-item">
                        <span>🏢</span>
                        <span>${project.department || 'N/A'}</span>
                    </div>
                    <div class="meta-item">
                        <span>📊</span>
                        <span>${project.division || 'N/A'}</span>
                    </div>
                    <div class="meta-item">
                        <span>📄</span>
                        <span>${docCount} ${docText}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `${count} project${count !== 1 ? 's' : ''} found`;
    }
}

function selectProject(projectId, projectName, department, division, status) {
    document.querySelectorAll('.project-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (projectId && projectId !== 'null') {
        const selectedOption = document.querySelector(`[data-project-id="${projectId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    } else {
        document.querySelector('.general-option')?.classList.add('selected');
    }
    
    window.tempSelectedProjectId = projectId;
    window.tempSelectedProjectName = projectName;
    window.tempSelectedDepartment = department;
    window.tempSelectedDivision = division;
    window.tempSelectedStatus = status;
}

async function applyProjectSelection() {
    selectedProjectId = window.tempSelectedProjectId || null;
    selectedProjectName = window.tempSelectedProjectName || null;
    selectedDepartment = window.tempSelectedDepartment || null;
    selectedDivision = window.tempSelectedDivision || null;
    selectedStatus = window.tempSelectedStatus || null;
    
    const selectedProjectText = document.getElementById('selectedProjectText');
    if (selectedProjectText) {
        if (selectedProjectId && selectedProjectId !== 'null') {
            selectedProjectText.textContent = selectedProjectName;
        } else {
            selectedProjectText.textContent = 'General Legal Advice';
        }
    }
    
    // ✅ Load documents for selected project
    if (selectedProjectId && selectedProjectId !== 'null') {
        await loadProjectDocuments(selectedProjectId);
    } else {
        projectDocuments = [];
        qdrantDocumentCount = 0;
        updateProjectContextMeta();
    }
    
    updateProjectContext();
    closeProjectFilter();
    
    // Refresh events if needed
    try {
        if (selectedProjectId && selectedProjectId !== 'null') {
            // await loadProjectEvents(selectedProjectId);
        } else {
            const eventsSection = document.getElementById('eventsSection');
            if (eventsSection) eventsSection.style.display = 'none';
        }
    } catch (err) {
        console.warn('Could not refresh events after selection:', err);
    }

    if (selectedProjectId && selectedProjectId !== 'null') {
        let contextInfo = `📁 Switched to project: ${selectedProjectName}`;
        if (selectedDepartment) contextInfo += ` | Dept: ${selectedDepartment}`;
        if (selectedDivision) contextInfo += ` | Division: ${selectedDivision}`;
        if (selectedStatus) contextInfo += ` | Status: ${selectedStatus}`;
        if (projectDocuments.length > 0) {
            contextInfo += ` | 📄 ${projectDocuments.length} docs (${qdrantDocumentCount} indexed)`;
        }
        showMessage(contextInfo, 'success');
    } else {
        showMessage('💬 Switched to general legal advice', 'success');
    }
}

function updateProjectContext() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const existingIndicator = messagesContainer.querySelector('.project-context-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    if (selectedProjectId && selectedProjectId !== 'null' && selectedProjectName) {
        let contextText = `Working on: ${escapeHtml(selectedProjectName)}`;
        if (selectedDepartment) contextText += ` • ${escapeHtml(selectedDepartment)}`;
        if (selectedDivision) contextText += ` • ${escapeHtml(selectedDivision)}`;
        if (selectedStatus) contextText += ` • ${escapeHtml(selectedStatus)}`;
        if (projectDocuments.length > 0) {
            contextText += ` • 📄 ${projectDocuments.length} docs`;
            if (qdrantDocumentCount !== projectDocuments.length) {
                contextText += ` (⚠️ ${qdrantDocumentCount} indexed)`;
            } else {
                contextText += ` (✅ all indexed)`;
            }
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'project-context-indicator';
        indicator.innerHTML = `
            <span>📁</span>
            <span>${contextText}</span>
        `;
        
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen && welcomeScreen.style.display !== 'none') {
            welcomeScreen.after(indicator);
        } else {
            const firstMessage = messagesContainer.querySelector('.message');
            if (firstMessage) {
                messagesContainer.insertBefore(indicator, firstMessage);
            } else {
                messagesContainer.appendChild(indicator);
            }
        }
    }
}

function clearAllFilters() {
    const deptFilter = document.getElementById('deptFilter');
    const divisionFilter = document.getElementById('divisionFilter');
    const statusFilter = document.getElementById('statusFilter');
    const projectSearchInput = document.getElementById('projectSearchInput');
    
    if (deptFilter) deptFilter.value = '';
    if (divisionFilter) divisionFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (projectSearchInput) projectSearchInput.value = '';
    
    filterProjects();
}

// ==================== PERSONALIZATION ====================
function personalizeWelcomeMessage() {
    if (!currentUser) return;
    
    const welcomeTitle = document.getElementById('welcomeTitle');
    if (welcomeTitle) {
        const firstName = currentUser.full_name ? currentUser.full_name.split(' ')[0] : 'there';
        welcomeTitle.textContent = `Hello ${firstName}! I'm your AI Legal Assistant`;
    }
}

function setupSuggestedQuestions() {
    const container = document.getElementById('suggestedQuestions');
    if (!container) return;
    
    const questions = [
        {
            icon: '⚖️',
            text: 'Analyze contract risks',
            description: 'Identify potential legal risks and liability issues in agreements'
        },
        {
            icon: '📝',
            text: 'Draft NDA template',
            description: 'Create a comprehensive non-disclosure agreement'
        },
        {
            icon: '🛡️',
            text: 'Check compliance',
            description: 'Verify regulatory compliance requirements'
        },
        {
            icon: '🔍',
            text: 'Review contract terms',
            description: 'Analyze terms and conditions for fairness and completeness'
        }
    ];
    
    container.innerHTML = questions.map(q => `
        <div class="suggested-question" onclick="askSuggestedQuestion('${q.text}')">
            <span class="question-icon">${q.icon}</span>
            <div class="question-text">${q.text}</div>
            <div class="question-description">${q.description}</div>
        </div>
    `).join('');
}

function askSuggestedQuestion(question) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = question;
        sendMessage();
    }
}

// ==================== CHAT INPUT SETUP ====================
function setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            
            if (sendBtn) {
                sendBtn.disabled = !this.value.trim() || isAITyping;
            }
        });

        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.disabled = true;
    }
}

// ==================== SEND MESSAGE (FIXED WITH AUTO-SAVE) ====================
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    let message = chatInput.value.trim();
    
    if (!message || isAITyping) return;
    
    const hiddenPrompt = chatInput.dataset.hiddenPrompt;
    const actualPromptToSend = hiddenPrompt || message;
    
    console.log('📝 Display Message:', message);
    console.log('🔐 Actual Prompt:', actualPromptToSend);
    
    // Add user message to UI
    addMessage(message, 'user');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    delete chatInput.dataset.hiddenPrompt;
    
    hideWelcomeScreen();
    showTypingIndicator();
    
    try {
        const requestBody = {
            message: actualPromptToSend,
            projectId: selectedProjectId !== 'null' ? selectedProjectId : null,
            projectName: selectedProjectName,
            department: selectedDepartment,
            division: selectedDivision,
            status: selectedStatus,
            documentCount: projectDocuments.length,
            conversationHistory: messageHistory.slice(-6) // Last 6 messages only
        };
        
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        hideTypingIndicator();

        if (data.success) {
            let aiMessage = data.message;
            
            if (data.documentsUsed > 0) {
                aiMessage += `\n\n---\n📚 **Analysis:** Used ${data.documentsUsed} document(s)`;
            }
            
            addMessage(aiMessage, 'ai');
            
            // ✅ AUTO-SAVE AFTER EACH EXCHANGE
            await saveConversationWithMessages();
            
        } else {
            console.error('AI response error:', data.error);
            addMessage(data.fallbackMessage || 'I apologize, but I encountered an error.', 'ai');
        }

    } catch (error) {
        console.error('Chat API error:', error);
        hideTypingIndicator();
        addMessage('I apologize, but I\'m having trouble connecting to the server.', 'ai');
    }
}
// ==================== FIXED: stripMarkdown Helper ====================
function stripMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic
        .replace(/__(.*?)__/g, '$1')     // Remove underline
        .replace(/`(.*?)`/g, '$1')       // Remove code
        .trim();
}

// Add the missing stripMarkdownBold function
function stripMarkdownBold(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

function escapeForCell(text) {
    if (text === null || text === undefined) return '';
    // convert to string and strip bold markers first
    let t = stripMarkdownBold(text);
    // preserve simple line breaks to <br>
    t = t.replace(/\r\n|\r|\n/g, '<br>');
    // escape HTML special chars (but keep <br>)
    t = t
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    // revert escaped <br> back to real tag
    t = t.replaceAll('&lt;br&gt;', '<br>');
    return t;
}
// ===== Render HTML table from array-of-objects (prettier + header blank rules) =====
function renderTableFromArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return '<div class="ai-table-empty">No table data</div>';
    }

    // Union of keys across rows (preserve insertion order roughly)
    const colsSet = new Set();
    arr.forEach(row => {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
            Object.keys(row).forEach(k => colsSet.add(k));
        }
    });
    const cols = Array.from(colsSet);

    // Build table HTML
    let html = `<div class="ai-table-wrap">
      <table class="ai-table" role="table" aria-label="AI generated table">
        <thead><tr>`;

    // Header: if header looks like raw markdown-bold or is empty => leave blank
    cols.forEach(col => {
        const raw = String(col || '').trim();
        const looksLikeBoldOnly = /^\*\*.*\*\*$/.test(raw);
        const display = looksLikeBoldOnly || raw === '' ? '' : stripMarkdownBold(raw);
        html += `<th scope="col">${escapeForCell(display)}</th>`;
    });

    html += `</tr></thead><tbody>`;

    arr.forEach((row, rIdx) => {
        html += `<tr>`;
        cols.forEach((c, cIdx) => {
            let v = (row && Object.prototype.hasOwnProperty.call(row, c)) ? row[c] : '';
            // If entire cell looks like markdown bold, strip it; if object/array, stringify nicely
            if (typeof v === 'object' && v !== null) {
                try { v = JSON.stringify(v); } catch(e) { v = String(v); }
            }
            const cellHtml = escapeForCell(v);
            html += `<td data-col="${escapeForCell(c)}">${cellHtml}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

// ===== Loose JSON array parser (unchanged, tolerant) =====
function tryParseJSONArray(text) {
    if (!text || typeof text !== 'string') return null;
    let t = text.trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    t = t.replace(/^\s*JSON\s*[:\-]\s*/i, '');
    try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.table)) return parsed.table;
        return null;
    } catch (e) {
        return null;
    }
}

// ===== Basic markdown table parser (keeps behavior but strips ** markers) =====
function tryParseMarkdownTable(text) {
    if (!text || typeof text !== 'string') return null;
    const lines = text.trim().split('\n').map(l => l.replace(/\r/g,'').trim());
    if (lines.length < 2) return null;

    // find header pipe line and next line being separator (---)
    const headerIdx = lines.findIndex((ln, i) => ln.includes('|') && i+1 < lines.length && /^[:\-\s|]+$/.test(lines[i+1].replace(/\s+/g,'')));
    if (headerIdx === -1) return null;

    const headerLine = lines[headerIdx];
    const rows = [];
    for (let i = headerIdx; i < lines.length; i++) {
        if (!lines[i] || !lines[i].includes('|')) break;
        rows.push(lines[i]);
    }
    if (rows.length < 2) return null;

    const cols = headerLine.split('|').map(c => c.trim()).filter((v,idx)=> !(v==='' && (idx===0 || idx===headerLine.split('|').length-1)));
    const bodyLines = rows.slice(2); // skip header + separator

    // Build HTML (use same styles)
    let html = '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
    cols.forEach(col => {
        // if header is just markdown bold, leave blank
        const raw = col.trim();
        const looksLikeBoldOnly = /^\*\*.*\*\*$/.test(raw);
        const display = looksLikeBoldOnly || raw === '' ? '' : stripMarkdownBold(raw);
        html += `<th scope="col">${escapeForCell(display)}</th>`;
    });
    html += '</tr></thead><tbody>';
    bodyLines.forEach(line => {
        const cells = line.split('|').map(c => c.trim()).filter((v,idx)=> !(v==='' && (idx===0 || idx===line.split('|').length-1)));
        html += '<tr>';
        cols.forEach((_,ci) => {
            const rawCell = cells[ci] !== undefined ? cells[ci] : '';
            html += `<td>${escapeForCell(rawCell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}
// ===== REPLACEMENT addMessage =====
function addMessage(text, sender, existingMessage = null) {
    console.log(`➕ Adding message: ${sender}`);

    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.style.opacity = '0'; // Start invisible

    const avatar = sender === 'ai' ? '🤖' : getUserAvatar();
    const time = existingMessage?.time || new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    let messageContentHtml = '';
    // If AI message, try to detect JSON table or markdown table
    if (sender === 'ai') {
        // 1) Try JSON array
        const parsedArray = tryParseJSONArray(text);
        if (parsedArray) {
            messageContentHtml = renderTableFromArray(parsedArray);
        } else {
            // 2) Try markdown table
            const mdTableHtml = tryParseMarkdownTable(text);
            if (mdTableHtml) {
                messageContentHtml = mdTableHtml;
            } else {
                // 3) Fallback to formatted text (allow limited HTML)
                messageContentHtml = `<div class="message-text">${formatMessage(text)}</div>`;
            }
        }
    } else {
        // user messages: keep previous behavior (escaped & formatted)
        messageContentHtml = `<div class="message-text">${formatMessage(text)}</div>`;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <span>${avatar}</span>
        </div>
        <div class="message-content">
            ${messageContentHtml}
            <div class="message-time">
                <span>${sender === 'ai' ? '🤖' : '👤'}</span>
                <span>${time}</span>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);

    // Trigger animation after a tiny delay
    setTimeout(() => {
        messageDiv.style.opacity = '1';
    }, 10);

    scrollToBottom();

    // Add to message history in correct format
    if (existingMessage) {
        // Use existing message properties
        messageHistory.push(existingMessage);
    } else {
        // Create new message object
        messageHistory.push({
            text: text,
            sender: sender,
            time: time,
            role: sender === 'ai' ? 'assistant' : 'user',
            content: text,
            hasDocuments: false,
            documentReferences: null,
            metadata: null
        });
    }

    console.log(`✅ Message added. Total: ${messageHistory.length}`);
}

// ==================== FIX BLANK SPACE - ENSURE PROPER CONTAINER HEIGHT ====================
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        // Prevent overscroll blank space
        chatMessages.style.overscrollBehavior = 'contain';
        
        // Monitor content changes and adjust scroll
        const observer = new MutationObserver(() => {
            // Only scroll if near bottom
            const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
            if (isNearBottom) {
                scrollToBottom();
            }
        });
        
        observer.observe(chatMessages, {
            childList: true,
            subtree: true
        });
    }
    
    // Fix container height calculation
    const chatMain = document.querySelector('.chat-main');
    if (chatMain) {
        chatMain.style.display = 'flex';
        chatMain.style.flexDirection = 'column';
        chatMain.style.height = '100%';
        chatMain.style.overflow = 'hidden';
    }
});

document.addEventListener('DOMContentLoaded', function() {
    restoreSidebarCollapsePreference();
    window.addEventListener('resize', handleSidebarCollapseOnResize);
});
// ==================== SAVE CONVERSATION WITH MESSAGES ====================
async function saveConversationWithMessages() {
    try {
        if (!currentUser?.id || messageHistory.length === 0) {
            console.log('⚠️ Cannot save - no user or no messages');
            return;
        }
        
        console.log('💾 Saving conversation...');
        console.log('📊 Current conversation ID:', currentConversationId);
        console.log('📊 Message history:', messageHistory.length);
        
        if (currentConversationId) {
            // Add new messages to existing conversation
            await addMessagesToConversation(currentConversationId);
        } else {
            // Create new conversation
            await createNewConversationWithMessages();
        }
        
    } catch (error) {
        console.error('❌ Error saving:', error);
    }
}// ==================== ADD MESSAGES TO EXISTING CONVERSATION ====================
async function addMessagesToConversation(conversationId) {
    try {
        // Get only last 2 messages (new user + AI response)
        const newMessages = messageHistory.slice(-2);
        
        console.log('📝 Adding', newMessages.length, 'messages to:', conversationId);
        
        for (const msg of newMessages) {
            const messageData = {
                userId: currentUser.id,
                role: msg.role || (msg.sender === 'ai' ? 'assistant' : 'user'),
                content: msg.content || msg.text,
                hasDocuments: msg.hasDocuments || false,
                documentReferences: msg.documentReferences || null,
                metadata: msg.metadata || null
            };
            
            const response = await fetch(`${BACKEND_URL}/api/chat-history/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(messageData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Message added');
            } else {
                console.error('❌ Failed to add message:', data.error);
            }
        }
        
        await loadChatHistory();
        
    } catch (error) {
        console.error('❌ Error adding messages:', error);
    }
}
// ==================== LOAD CHAT HISTORY ====================
async function loadChatHistory() {
    try {
        if (!currentUser?.id) {
            console.warn('⚠️ No user ID');
            return;
        }

        const response = await fetch(`${BACKEND_URL}/api/chat-history/conversations?userId=${currentUser.id}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            chatHistoryList = data.conversations || [];
            renderChatHistory(chatHistoryList);
            console.log(`✅ Loaded ${chatHistoryList.length} conversations`);
        } else {
            throw new Error(data.error || 'Failed to load');
        }

    } catch (error) {
        console.error('❌ Error loading chat history:', error);
        const container = document.getElementById('chatHistoryList');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">
                    Failed to load chat history
                </div>
            `;
        }
    }
}


function getUserAvatar() {
    if (currentUser && currentUser.full_name) {
        return currentUser.full_name.charAt(0).toUpperCase();
    }
    return '👤';
}

// ==================== CREATE NEW CONVERSATION ====================
async function createNewConversationWithMessages() {
    try {
        const firstUserMsg = messageHistory.find(m => m.sender === 'user');
        const title = firstUserMsg ? 
            (firstUserMsg.text.length > 50 ? firstUserMsg.text.substring(0, 50) + '...' : firstUserMsg.text) : 
            'New Conversation';
        
        console.log('✨ Creating new conversation:', title);
        
        // Format messages for backend
        const formattedMessages = messageHistory.map(msg => ({
            role: msg.role || (msg.sender === 'ai' ? 'assistant' : 'user'),
            content: msg.content || msg.text,
            hasDocuments: msg.hasDocuments || false,
            documentReferences: msg.documentReferences || null,
            metadata: msg.metadata || null
        }));
        
        console.log('📨 Sending', formattedMessages.length, 'messages');
        
        const response = await fetch(`${BACKEND_URL}/api/chat-history/save-current`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                userId: currentUser.id,
                title: title,
                projectId: selectedProjectId !== 'null' ? selectedProjectId : null,
                projectName: selectedProjectName,
                department: selectedDepartment,
                division: selectedDivision,
                status: selectedStatus,
                messages: formattedMessages
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentConversationId = data.conversation.id;
            console.log('✅ Conversation created:', currentConversationId);
            console.log('✅ Messages saved:', data.messagesCount || formattedMessages.length);
            await loadChatHistory();
        } else {
            console.error('❌ Failed:', data.error);
        }
        
    } catch (error) {
        console.error('❌ Error creating conversation:', error);
    }
}

function formatMessage(text) {
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^- (.*)/gm, '• $1')
        .replace(/^(\d+)\. (.*)/gm, '<strong>$1.</strong> $2');
}

// ==================== ENHANCED TYPING INDICATOR ====================
function showTypingIndicator() {
    isAITyping = true;
    setAssistantStatus('Drafting response...');
    let messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // Remove existing typing indicator if any (avoid duplicates)
    const old = document.getElementById('typingIndicator');
    if (old) messagesContainer.removeChild(old);
    
    // Create new enhanced typing indicator div
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'message typing-indicator';
    indicator.innerHTML = `
        <div class="message-avatar">
            <span>🤖</span>
        </div>
        <div class="typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;
    messagesContainer.appendChild(indicator);
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;
    
    scrollToBottom();
}

function hideTypingIndicator() {
    isAITyping = false;
    let indicator = document.getElementById('typingIndicator');
    if (indicator && indicator.parentNode) {
        // Add fade out animation before removing
        indicator.style.animation = 'messageFadeOut 0.3s ease';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 300);
    }
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && chatInput) {
        sendBtn.disabled = !chatInput.value.trim();
    }
    setAssistantStatus('Ready');
}
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes messageFadeOut {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.9);
        }
    }
`;
document.head.appendChild(fadeOutStyle);

function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

// ==================== ENHANCED SCROLL TO BOTTOM ====================
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        // Smooth scroll with animation
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
        
        // Backup: Force scroll after a tiny delay to ensure DOM is updated
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

// ==================== START NEW CHAT ====================
function startNewChat() {
    console.log('🆕 Starting new chat');
    
    currentConversationId = null;
    messageHistory = [];
    currentGenerationSession = null;
    generatedParts = [];
    clearChatMessages();
    
    selectedProjectId = null;
    selectedProjectName = null;
    selectedDepartment = null;
    selectedDivision = null;
    selectedStatus = null;
    
    const selectedProjectText = document.getElementById('selectedProjectText');
    if (selectedProjectText) {
        selectedProjectText.textContent = 'General Legal Advice';
    }
    
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
    }
    
    renderChatHistory(chatHistoryList);
    setupSuggestedQuestions();
    personalizeWelcomeMessage();
    
    console.log('✅ New chat started');
    showMessage('✨ Started new conversation', 'success');
}
// ==================== CLEAR CHAT MESSAGES ====================
function clearChatMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const elementsToRemove = messagesContainer.querySelectorAll('.message, .typing-indicator, .project-context-indicator');
    elementsToRemove.forEach(el => el.remove());
    
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

// ==================== FILE UPLOAD (PLACEHOLDER) ====================
function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                showMessage('📎 File upload feature coming soon!', 'info');
            }
        });
    }
}

function triggerFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const overlay = document.getElementById('dragDropOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const overlay = document.getElementById('dragDropOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    showMessage('📎 File upload feature coming soon!', 'info');
}

// ==================== CHAT HISTORY (PLACEHOLDER) ====================
function setupChatHistory() {
    // Load chat history when the page initializes
    if (currentUser && currentUser.id) {
        loadChatHistory();
    }
    
    // Keep the existing click event listeners for chat history items
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.chat-history-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function setupMobileResponsive() {
    if (window.innerWidth <= 768) {
        const toggle = document.querySelector('.sidebar-toggle-chat');
        if (toggle) {
            toggle.style.display = 'block';
        }
    }

    window.addEventListener('resize', function() {
        const chatSidebarToggle = document.querySelector('.sidebar-toggle-chat');
        if (chatSidebarToggle) {
            chatSidebarToggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        }
        
        if (window.innerWidth > 768) {
            const chatSidebar = document.getElementById('chatSidebar');
            if (chatSidebar) {
                chatSidebar.classList.remove('open');
            }
        }
    });
}

// ==================== MOBILE SIDEBAR FIX ====================
function ensureMobileSidebarClosed() {
    if (window.innerWidth <= 768) {
        const chatSidebar = document.getElementById('chatSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        // Close chat sidebar on mobile
        if (chatSidebar && chatSidebar.classList.contains('open')) {
            chatSidebar.classList.remove('open');
        }
        
        // Hide overlay
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    }
}

// Handle mobile sidebar close on resize
window.addEventListener('resize', function() {
    clearTimeout(window.resizeTimer3);
    window.resizeTimer3 = setTimeout(ensureMobileSidebarClosed, 250);
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768) {
        const chatSidebar = document.getElementById('chatSidebar');
        const toggleBtn = document.querySelector('.sidebar-toggle-chat');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (chatSidebar && chatSidebar.classList.contains('open')) {
            // If click is not on sidebar or toggle button
            if (!chatSidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
                chatSidebar.classList.remove('open');
                if (overlay) {
                    overlay.classList.remove('active');
                }
            }
        }
    }
});

function toggleChatSidebar() {
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (chatSidebar) {
        chatSidebar.classList.toggle('open');
        
        // Toggle overlay for mobile
        if (overlay) {
            if (chatSidebar.classList.contains('open')) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }
}



// Toggle main left sidebar (navigation)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        sidebar.classList.toggle('active');
        
        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
    
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Close chat sidebar function (for backward compatibility)
function closeChatSidebar() {
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (chatSidebar) {
        chatSidebar.classList.remove('open');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
}

function toggleSidebarCollapse() {
    preferredSidebarCollapsed = !preferredSidebarCollapsed;
    saveSidebarCollapsePreference();
    if (window.innerWidth > 900) {
        applySidebarCollapseState(preferredSidebarCollapsed);
    }
}

function applySidebarCollapseState(state) {
    const container = document.querySelector('.chat-page-container');
    const btn = document.getElementById('sidebarCollapseBtn');
    if (!container) return;

    isSidebarCollapsed = state;
    container.classList.toggle('sidebar-collapsed', state);

    if (btn) {
        btn.classList.toggle('collapsed', state);
        btn.setAttribute('aria-expanded', (!state).toString());
        btn.title = state ? 'Expand sidebar' : 'Collapse sidebar';
    }
}

function saveSidebarCollapsePreference() {
    try {
        localStorage.setItem('cm_sidebar_collapsed', preferredSidebarCollapsed ? '1' : '0');
    } catch (_) {
        // Ignore storage issues
    }
}

function restoreSidebarCollapsePreference() {
    try {
        preferredSidebarCollapsed = localStorage.getItem('cm_sidebar_collapsed') === '1';
    } catch (_) {
        preferredSidebarCollapsed = false;
    }

    if (window.innerWidth > 900 && preferredSidebarCollapsed) {
        applySidebarCollapseState(true);
    } else {
        applySidebarCollapseState(false);
    }
}

function handleSidebarCollapseOnResize() {
    if (window.innerWidth <= 900) {
        applySidebarCollapseState(false);
    } else {
        applySidebarCollapseState(preferredSidebarCollapsed);
    }
}


// Close sidebar on window resize
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth > 768) {
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close sidebar when clicking on sidebar links (mobile)
window.addEventListener('DOMContentLoaded', function() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
});

function toggleUserMenu() {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) menu.classList.toggle('show');
}

async function handleLogout(event) {
    event.preventDefault();
    
    try {
        if (supabase) {
            await supabase.auth.signOut();
        }
        localStorage.removeItem('cm_user');
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('Logout failed', 'error');
    }
}

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
        padding: 12px 20px; border-radius: 8px;
        z-index: 3000; font-weight: 500; font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (document.body.contains(messageDiv)) {
            messageDiv.remove();
        }
    }, 4000);
}
// ==================== INITIALIZE CHAT HISTORY ====================
async function initializeChatHistory() {
    try {
        console.log('📜 Initializing chat history...');
        await loadChatHistory();
    } catch (error) {
        console.error('❌ Error initializing chat history:', error);
    }
}
// ==================== RENDER CHAT HISTORY (UPDATED) ====================
function renderChatHistory(conversations) {
    const container = document.getElementById('chatHistoryList');
    if (!container) return;

    if (conversations.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
                No chat history yet<br>
                <small style="font-size: 11px;">Your conversations will appear here</small>
            </div>
        `;
        return;
    }

    // Group conversations by date
    const groupedConversations = groupConversationsByDate(conversations);
    
    let html = '';
    
    for (const [dateLabel, convs] of Object.entries(groupedConversations)) {
        html += `
            <div class="history-date-group">
                <div class="history-date-label">${dateLabel}</div>
        `;
        
        convs.forEach(conv => {
            const isPinned = conv.is_pinned;
            const projectBadge = conv.project_name 
                ? `<span class="history-project-badge" title="${conv.project_name}">📁 ${conv.project_name}</span>` 
                : '';
            
            html += `
                <div class="history-item ${currentConversationId === conv.id ? 'active' : ''}" 
                     data-conversation-id="${conv.id}">
                    <div class="history-item-header" onclick="loadConversation('${conv.id}')">
                        ${isPinned ? '<span class="history-pin-icon">📌</span>' : ''}
                        <div class="history-item-title">${escapeHtml(conv.title)}</div>
                        <div class="history-item-meta">
                            ${projectBadge}
                            <span class="history-message-count">${conv.message_count} messages</span>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button onclick="event.stopPropagation(); togglePinConversation('${conv.id}', ${!isPinned})" 
                                title="${isPinned ? 'Unpin' : 'Pin'}" 
                                class="history-action-btn">
                            ${isPinned ? '📌' : '📍'}
                        </button>
                        <button onclick="event.stopPropagation(); renameConversation('${conv.id}')" 
                                title="Rename" 
                                class="history-action-btn">
                            ✏️
                        </button>
                        <button onclick="event.stopPropagation(); deleteConversation('${conv.id}')" 
                                title="Delete" 
                                class="history-action-btn delete-btn">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}
// ==================== RENAME CONVERSATION ====================
async function renameConversation(conversationId) {
    try {
        const conversation = chatHistoryList.find(c => c.id === conversationId);
        if (!conversation) return;
        
        const newTitle = prompt('Enter new title:', conversation.title);
        if (!newTitle || newTitle === conversation.title) return;
        
        console.log(`✏️ Renaming: ${conversationId}`);
        
        const response = await fetch(`${BACKEND_URL}/api/chat-history/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                userId: currentUser.id,
                title: newTitle
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadChatHistory();
            showMessage('✅ Renamed', 'success');
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Error renaming:', error);
        showMessage('❌ Failed to rename', 'error');
    }
}

// ==================== TOGGLE PIN ====================
async function togglePinConversation(conversationId, isPinned) {
    try {
        console.log(`📌 ${isPinned ? 'Pinning' : 'Unpinning'}: ${conversationId}`);
        
        const response = await fetch(`${BACKEND_URL}/api/chat-history/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                userId: currentUser.id,
                isPinned: isPinned
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadChatHistory();
            showMessage(`✅ ${isPinned ? 'Pinned' : 'Unpinned'}`, 'success');
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        showMessage('❌ Failed to update', 'error');
    }
}
// ==================== SEARCH CHAT HISTORY ====================
let searchTimeout;
async function searchChatHistory() {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
        try {
            const searchInput = document.getElementById('historySearchInput');
            const query = searchInput?.value.trim();
            
            if (!query) {
                renderChatHistory(chatHistoryList);
                return;
            }
            
            console.log(`🔍 Searching: ${query}`);
            
            const response = await fetch(`${BACKEND_URL}/api/chat-history/search?userId=${currentUser.id}&q=${encodeURIComponent(query)}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                renderChatHistory(data.conversations);
                console.log(`✅ Found ${data.conversations.length}`);
            }
            
        } catch (error) {
            console.error('❌ Search error:', error);
        }
    }, 300);
}

// ==================== TOGGLE SEARCH ====================
function toggleHistorySearch() {
    const searchContainer = document.getElementById('chatHistorySearch');
    const searchInput = document.getElementById('historySearchInput');
    
    if (searchContainer) {
        const isHidden = searchContainer.style.display === 'none';
        searchContainer.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden) {
            searchInput?.focus();
        } else {
            searchInput.value = '';
            renderChatHistory(chatHistoryList);
        }
    }
}

// ==================== SAVE CURRENT CHAT (MANUAL) ====================
async function saveCurrentChat() {
    try {
        if (!currentUser?.id) {
            showMessage('❌ Please log in', 'error');
            return;
        }
        
        if (messageHistory.length === 0) {
            showMessage('⚠️ No messages to save', 'info');
            return;
        }
        
        const title = prompt('Enter title:', 
            messageHistory[0]?.content?.substring(0, 50) + '...' || 'New Conversation');
        
        if (!title) return;
        
        await createNewConversationWithMessages();
        showMessage('✅ Chat saved', 'success');
        
    } catch (error) {
        console.error('❌ Error saving:', error);
        showMessage('❌ Failed to save', 'error');
    }
}


// ==================== FIXED: loadConversation to restore template format ====================
async function loadConversation(conversationId) {
    try {
        console.log(`📖 Loading conversation: ${conversationId}`);
        
        if (!currentUser?.id) {
            console.error('❌ No user logged in!');
            showMessage('❌ Please log in', 'error');
            return;
        }
        
        const url = `${BACKEND_URL}/api/chat-history/conversations/${conversationId}?userId=${currentUser.id}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load');
        }
        
        currentConversationId = conversationId;
        
        // Clear chat
        messageHistory = [];
        clearChatMessages();
        hideWelcomeScreen();
        
        // Load project context
        const conv = data.conversation;
        if (conv.project_id) {
            selectedProjectId = conv.project_id;
            selectedProjectName = conv.project_name;
            selectedDepartment = conv.department;
            selectedDivision = conv.division;
            selectedStatus = conv.status;
            
            const selectedProjectText = document.getElementById('selectedProjectText');
            if (selectedProjectText) {
                selectedProjectText.textContent = conv.project_name || 'General Legal Advice';
            }
            
            await loadProjectDocuments(conv.project_id);
            updateProjectContext();
        }
        
        // ✅ FIXED: Load messages with proper formatting
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach((msg) => {
                let sender = 'user';
                if (msg.role === 'assistant') sender = 'ai';
                
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                
                // ✅ Check if this is a document part
                const isDocumentPart = msg.metadata && msg.metadata.isDocumentPart;
                
                if (isDocumentPart) {
                    // Restore as generated part with special formatting
                    const partData = {
                        currentPart: msg.metadata.partNumber,
                        partName: msg.metadata.partName,
                        message: content,
                        extractedData: msg.metadata.extractedData,
                        formattingRules: msg.metadata.formattingRules,
                        templateName: msg.metadata.templateName
                    };
                    addGeneratedPartMessage(partData);
                } else {
                    // Regular message
                    // Create a temporary message object with all properties
                    const tempMsg = {
                        text: content,
                        sender: sender,
                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        role: msg.role || (sender === 'ai' ? 'assistant' : 'user'),
                        content: content,
                        hasDocuments: msg.has_documents || false,
                        documentReferences: msg.document_references || null,
                        metadata: msg.metadata || null
                    };
                    // Display in UI and add to message history
                    addMessage(content, sender, tempMsg);
                }
            });
        }
        
        // Update UI
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        if (window.innerWidth <= 768) {
            closeChatSidebar();
        }
        
        scrollToBottom();
        showMessage('✅ Conversation loaded', 'success');
        
    } catch (error) {
        console.error('❌ Error loading conversation:', error);
        showMessage('❌ Failed to load conversation', 'error');
    }
}
// ==================== DELETE CONVERSATION ====================
async function deleteConversation(conversationId) {
    try {
        if (!confirm('Delete this conversation? This cannot be undone.')) {
            return;
        }
        
        console.log(`🗑️ Deleting: ${conversationId}`);
        
        const response = await fetch(`${BACKEND_URL}/api/chat-history/conversations/${conversationId}?userId=${currentUser.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                startNewChat();
            }
            await loadChatHistory();
            showMessage('✅ Conversation deleted', 'success');
        } else {
            throw new Error(data.error);
        }
        
        
    } catch (error) {
        console.error('❌ Error deleting:', error);
        showMessage('❌ Failed to delete', 'error');
    }
}
// ==================== GROUP BY DATE ====================
function groupConversationsByDate(conversations) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const groups = {
        'Today': [],
        'Yesterday': [],
        'Last 7 Days': [],
        'Last 30 Days': [],
        'Older': []
    };
    
    conversations.forEach(conv => {
        const convDate = new Date(conv.last_message_at);
        convDate.setHours(0, 0, 0, 0);
        
        if (convDate.getTime() === today.getTime()) {
            groups['Today'].push(conv);
        } else if (convDate.getTime() === yesterday.getTime()) {
            groups['Yesterday'].push(conv);
        } else if (convDate >= lastWeek) {
            groups['Last 7 Days'].push(conv);
        } else if (convDate >= lastMonth) {
            groups['Last 30 Days'].push(conv);
        } else {
            groups['Older'].push(conv);
        }
    });
    
    Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) {
            delete groups[key];
        }
    });
    
    return groups;
}

// ==================== SETUP CHAT HISTORY ====================
function setupChatHistory() {
    if (currentUser?.id) {
        loadChatHistory();
    }
}

// ==================== INITIALIZE ON LOAD ====================
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (currentUser && currentUser.id) {
                loadChatHistory();
            }
        }, 1000);
    });
}

console.log('✅ Chat history module loaded');

// ==================== CLOSE DROPDOWNS ON OUTSIDE CLICK ====================
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdownMenu');

    if (userMenu && dropdown && !userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

console.log('✅ Enhanced AI Chatbot loaded with Qdrant document integration');

// ==================== SIDEBAR TAB SWITCHER ====================
function showSidebarTab(tab) {
    const quick = document.getElementById('quickActionsSection');
    const history = document.getElementById('chatHistorySection');
    const tHistory = document.getElementById('tabHistory');
    const tQuick = document.getElementById('tabQuick');
    if (!quick || !history) return;
    if (tab === 'quick') {
        quick.style.display = '';
        history.style.display = 'none';
        if (tQuick) tQuick.style.background = '#eff6ff';
        if (tHistory) tHistory.style.background = '#fff';
    } else {
        history.style.display = '';
        quick.style.display = 'none';
        if (tHistory) tHistory.style.background = '#eff6ff';
        if (tQuick) tQuick.style.background = '#fff';
    }
}
/* ==================== MOBILE DROPDOWN HANDLER ==================== */
function handleMobileDropdownChange(value) {
    const dropdown = document.getElementById('mobileChatDropdown');
    
    if (value === 'new') {
        // Start new conversation
        startNewChat();
    } else if (value === 'history') {
        // Open sidebar and show history tab
        toggleChatSidebar();
        setTimeout(() => {
            showSidebarTab('history');
        }, 100);
    } else if (value === 'quick') {
        // Open sidebar and show quick actions tab
        toggleChatSidebar();
        setTimeout(() => {
            showSidebarTab('quick');
        }, 100);
    }
    
    // Reset dropdown to default
    dropdown.value = '';
}

/* ==================== TOGGLE CHAT SIDEBAR (MOBILE) ==================== */
function toggleChatSidebar() {
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const body = document.body;
    
    if (!chatSidebar || !overlay) return;
    
    const isActive = chatSidebar.classList.contains('active');
    
    if (isActive) {
        // Close sidebar
        chatSidebar.classList.remove('active');
        overlay.classList.remove('active');
        body.classList.remove('sidebar-open');
        body.style.overflow = '';
        body.style.position = '';
        body.style.width = '';
    } else {
        // Open sidebar
        chatSidebar.classList.add('active');
        overlay.classList.add('active');
        body.classList.add('sidebar-open');
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.width = '100%';
    }
}

/* ==================== CLOSE CHAT SIDEBAR ==================== */
function closeChatSidebar() {
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const body = document.body;
    
    if (chatSidebar) chatSidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    body.classList.remove('sidebar-open');
    body.style.overflow = '';
    body.style.position = '';
    body.style.width = '';
}

/* ==================== AUTO-CLOSE ON WINDOW RESIZE ==================== */
window.addEventListener('resize', function() {
    clearTimeout(window.chatResizeTimer);
    window.chatResizeTimer = setTimeout(function() {
        // Close sidebar when going to desktop size
        if (window.innerWidth > 768) {
            closeChatSidebar();
        }
    }, 250);
});

/* ==================== CLOSE ON ESC KEY ==================== */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
        if (window.innerWidth <= 768) {
            closeChatSidebar();
        }
    }
});

/* ==================== CLOSE ON OUTSIDE CLICK ==================== */
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('sidebarOverlay');
    
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeChatSidebar();
            }
        });
    }
});

/* ==================== ENSURE SIDEBAR CLOSED ON PAGE LOAD (MOBILE) ==================== */
(function() {
    'use strict';
    
    function ensureMobileSidebarClosed() {
        if (window.innerWidth <= 768) {
            const chatSidebar = document.getElementById('chatSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            const body = document.body;
            
            if (chatSidebar) chatSidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            
            body.classList.remove('sidebar-open');
            body.style.overflow = '';
            body.style.position = '';
            body.style.width = '';
        }
    }
    
    // Run immediately
    ensureMobileSidebarClosed();
    
    // Run on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', ensureMobileSidebarClosed);
    
    // Run on window load (backup)
    window.addEventListener('load', ensureMobileSidebarClosed);
})();

/* ==================== MAIN SIDEBAR TOGGLE (LEFT NAVIGATION) ==================== */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar) return;
    
    const isActive = sidebar.classList.contains('active');
    
    if (isActive) {
        // Close sidebar
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    } else {
        // Open sidebar
        sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }
}

/* ==================== SHOW SIDEBAR TAB ==================== */
function showSidebarTab(tab) {
    const historyTab = document.getElementById('tabHistory');
    const quickTab = document.getElementById('tabQuick');
    const historySection = document.getElementById('chatHistorySection');
    const quickSection = document.getElementById('quickActionsSection');
    
    if (tab === 'history') {
        // Show history tab
        if (historyTab) {
            historyTab.classList.add('active');
            historyTab.style.background = '#eff6ff';
            historyTab.style.borderColor = '#3b82f6';
            historyTab.style.color = '#1e40af';
        }
        if (quickTab) {
            quickTab.classList.remove('active');
            quickTab.style.background = '#fff';
            quickTab.style.borderColor = '#e5e7eb';
            quickTab.style.color = '#374151';
        }
        if (historySection) historySection.style.display = 'flex';
        if (quickSection) quickSection.style.display = 'none';
        
    } else if (tab === 'quick') {
        // Show quick actions tab
        if (quickTab) {
            quickTab.classList.add('active');
            quickTab.style.background = '#eff6ff';
            quickTab.style.borderColor = '#3b82f6';
            quickTab.style.color = '#1e40af';
        }
        if (historyTab) {
            historyTab.classList.remove('active');
            historyTab.style.background = '#fff';
            historyTab.style.borderColor = '#e5e7eb';
            historyTab.style.color = '#374151';
        }
        if (quickSection) quickSection.style.display = 'block';
        if (historySection) historySection.style.display = 'none';
    }
}

/* ==================== DEBUG HELPER (REMOVE IN PRODUCTION) ==================== */
window.debugMobileSidebar = function() {
    const chatSidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    console.log('=== Mobile Sidebar Debug ===');
    console.log('Window width:', window.innerWidth);
    console.log('Chat sidebar element:', chatSidebar);
    console.log('Chat sidebar active:', chatSidebar ? chatSidebar.classList.contains('active') : 'not found');
    console.log('Overlay element:', overlay);
    console.log('Overlay active:', overlay ? overlay.classList.contains('active') : 'not found');
    console.log('Body classes:', document.body.className);
    console.log('Body overflow:', document.body.style.overflow);
};

console.log('✅ Mobile chat sidebar functions loaded');
// ==================== FRONTEND: Add to chatbot.js ====================

// ==================== DOCUMENT GENERATION STATE ====================
let currentGenerationSession = null;
let generatedParts = [];

// ==================== DETECT GENERATION REQUEST IN sendMessage ====================
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    let message = chatInput.value.trim();
    
    if (!message || isAITyping) return;
    
    // Add user message to UI
    addMessage(message, 'user');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    hideWelcomeScreen();
    showTypingIndicator();
    
    try {
        const requestBody = {
            message: message,
            projectId: selectedProjectId !== 'null' ? selectedProjectId : null,
            projectName: selectedProjectName,
            department: selectedDepartment,
            division: selectedDivision,
            status: selectedStatus,
            documentCount: projectDocuments.length,
            conversationHistory: messageHistory.slice(-6)
        };
        
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        hideTypingIndicator();

        if (data.success) {
            // ✅ NEW: Check if this is a document generation request
            if (data.isGenerationRequest) {
                await handleGenerationResponse(data);
            } else {
                // Regular chat response
                let aiMessage = data.message;
                
                if (data.documentsUsed > 0) {
                    aiMessage += `\n\n---\n📚 **Analysis:** Used ${data.documentsUsed} document(s)`;
                }
                
                addMessage(aiMessage, 'ai');
            }
            
            await saveConversationWithMessages();
            
        } else {
            console.error('AI response error:', data.error);
            addMessage(data.fallbackMessage || 'I apologize, but I encountered an error.', 'ai');
        }

    } catch (error) {
        console.error('Chat API error:', error);
        hideTypingIndicator();
        addMessage('I apologize, but I\'m having trouble connecting to the server.', 'ai');
    }
}

// ==================== HANDLE GENERATION RESPONSE ====================
async function handleGenerationResponse(data) {
    if (data.requiresDocuments) {
        // Show message asking for documents
        addMessage(data.message, 'ai');
        return;
    }
    
    // Initialize generation session if not already started
    if (!currentGenerationSession) {
        try {
            const initResponse = await fetch(`${TEMPLATE_API_BASE}/generate/start`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    userId: currentUser.id,
                    projectId: selectedProjectId !== 'null' ? selectedProjectId : null,
                    templateName: data.templateName,
                    documentTitle: `${data.templateName} - ${new Date().toLocaleDateString()}`
                })
            });
            
            const initData = await initResponse.json();
            
            if (initData.success) {
                currentGenerationSession = {
                    documentId: initData.documentId,
                    templateName: data.templateName,
                    totalParts: initData.totalParts || data.totalParts || null,
                    currentPart: 1
                };
                generatedParts = [];
                
                console.log('✨ Generation session started:', currentGenerationSession);
            }
        } catch (error) {
            console.error('Error starting generation session:', error);
        }
    }
    
    // Display generated part with special formatting
    addGeneratedPartMessage(data);
    addGeneratedPartToHistory(data);
    
    // Save part to backend
    if (currentGenerationSession) {
        try {
            await fetch(`${TEMPLATE_API_BASE}/generate/${currentGenerationSession.documentId}/part`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    userId: currentUser.id,
                    partNumber: data.currentPart,
                    partContent: data.message,
                    extractedData: data.extractedData,
                    userFeedback: 'pending'
                })
            });
        } catch (error) {
            console.warn('Could not save part:', error);
        }
    }
    
    // Store/replace part locally at correct index
    generatedParts[data.currentPart - 1] = {
        partNumber: data.currentPart,
        partName: data.partName,
        content: data.message,
        extractedData: data.extractedData
    };

    if (currentGenerationSession) {
        currentGenerationSession.currentPart = data.currentPart;
    }
    
    // Show next action buttons
    addPartActionButtons(data);
}

// ==================== ADD GENERATED PART MESSAGE ====================
function addGeneratedPartMessage(data) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai generated-part';
    
    const partHeader = `
        <div class="part-header">
            <span class="part-badge">Part ${data.currentPart}</span>
            <span class="part-title">${data.partName}</span>
        </div>
    `;
    
    const partContent = `
        <div class="part-content">
            ${formatGeneratedContent(data.message)}
        </div>
    `;
    
    const extractedDataInfo = data.extractedData ? `
        <div class="extracted-data-summary">
            <details>
                <summary>📊 Extracted Data (${Object.keys(data.extractedData).length} fields)</summary>
                <pre>${JSON.stringify(data.extractedData, null, 2)}</pre>
            </details>
        </div>
    ` : '';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <span>📄</span>
        </div>
        <div class="message-content">
            ${partHeader}
            ${partContent}
            ${extractedDataInfo}
            <div class="message-time">
                <span>📄</span>
                <span>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Also add to message history if not already added
    // This is handled by addGeneratedPartToHistory which is called separately
}

// ==================== FIXED: addGeneratedPartToHistory ====================
function addGeneratedPartToHistory(data) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // ✅ FIXED: Store complete part info in metadata
    messageHistory.push({
        text: data.message,
        sender: 'ai',
        time,
        role: 'assistant',
        content: data.message,
        metadata: {
            type: 'generated_part',
            templateName: data.templateName || currentGenerationSession?.templateName || null,
            partNumber: data.currentPart,
            partName: data.partName,
            extractedData: data.extractedData,
            formattingRules: data.formattingRules,
            isDocumentPart: true // ✅ Flag for chat history
        }
    });
}


// ==================== FORMAT GENERATED CONTENT (FIXED) ====================
function formatGeneratedContent(content) {
    if (!content) return '';

    // First, convert markdown tables to HTML
    let formatted = convertMarkdownTables(content);

    // Apply basic markdown formatting (bold, italic, underline)
    formatted = formatted
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<u>$1</u>');

    // Convert bullet points
    formatted = formatted.replace(/^- (.*)/gm, '• $1');

    // Convert newlines to <br>, BUT NOT around tables
    const lines = formatted.split('\n');
    const processedLines = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('<div class="generated-table-container">')) {
            inTable = true;
            // Add line without <br>
            processedLines.push(line);
        } else if (line.includes('</div>') && inTable) {
            inTable = false;
            processedLines.push(line);
        } else if (inTable) {
            // Inside table, no <br>
            processedLines.push(line);
        } else if (line) {
            // Regular text, add <br>
            processedLines.push(line + '<br>');
        }
    }

    formatted = processedLines.join('\n');

    // Clean up excessive <br> tags
    formatted = formatted
        .replace(/(<br>\s*){3,}/g, '<br><br>') // Max 2 consecutive breaks
        .replace(/<br>\s*<div class="generated-table-container">/g, '<div class="generated-table-container">') // No break before table
        .replace(/<\/div>\s*<br>/g, '</div>'); // No break after table

    return formatted;
}


// ==================== CONVERT MARKDOWN TABLES (FIXED) ====================

// ==================== CONVERT MARKDOWN TABLES (FIXED) ====================
function convertMarkdownTables(content) {
    const lines = content.split('\n');
    const parts = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Detect start of markdown table
        if (line.startsWith('|') && line.endsWith('|')) {
            const tableLines = [];

            // Collect all table lines
            while (i < lines.length) {
                const tableLine = lines[i].trim();
                if (!tableLine.startsWith('|')) break;
                tableLines.push(tableLine);
                i++;
            }

            if (tableLines.length > 0) {
                parts.push(renderMarkdownTable(tableLines));
            }
        } else {
            parts.push(line);
            i++;
        }
    }

    return parts.join('\n');
}


// ==================== FIXED: renderMarkdownTable ====================
function renderMarkdownTable(tableLines) {
    if (!tableLines || tableLines.length < 2) return '';

    // Parse table rows - remove leading/trailing pipes
    const rows = tableLines
        .map(line => {
            const cells = line.trim()
                .replace(/^\||\|$/g, '') // Remove outer pipes
                .split('|')
                .map(c => c.trim());
            return cells;
        })
        .filter(cells => cells.length > 0);

    if (rows.length < 2) return '';

    // First row is header
    const headerCells = rows[0];
    
    // Find separator row (contains dashes)
    let bodyStartIndex = 1;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i].every(cell => /^[-:\s]+$/.test(cell))) {
            bodyStartIndex = i + 1;
            break;
        }
    }

    // Get body rows (skip separator)
    const bodyRows = rows.slice(bodyStartIndex);

    if (bodyRows.length === 0) return '';

    // Determine column count
    const columnCount = headerCells.length;

    // ✅ FIXED: Build proper HTML table
    let html = '<div class="generated-table-container"><table class="generated-table">';
    
    // Header
    html += '<thead><tr>';
    headerCells.forEach((cell, idx) => {
        // Clean cell: strip bold markers, escape HTML
        const cleanCell = stripMarkdown(cell);
        const align = (idx === 0 || idx === columnCount - 1) ? 'center' : 'left';
        html += `<th style="text-align: ${align};">${escapeHtml(cleanCell)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    bodyRows.forEach(row => {
        html += '<tr>';
        for (let i = 0; i < columnCount; i++) {
            const cell = row[i] || '';
            const cleanCell = stripMarkdown(cell);
            const align = (i === 0 || i === columnCount - 1) ? 'center' : 'left';
            html += `<td style="text-align: ${align};">${escapeHtml(cleanCell)}</td>`;
        }
        html += '</tr>';
    });
    html += '</tbody>';

    html += '</table></div>';
    return html;
}

// ==================== ESCAPE HTML (HELPER) ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// ==================== NEW: generatePartialDOCX ====================
async function generatePartialDOCX() {
    if (!currentGenerationSession || generatedParts.length === 0) {
        showMessage('❌ No parts generated yet', 'error');
        return;
    }
    
    try {
        showMessage('📝 Generating DOCX with current parts...', 'info');
        
        const response = await fetch(`${TEMPLATE_API_BASE}/generate/docx`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                documentId: currentGenerationSession.documentId,
                userId: currentUser.id,
                parts: generatedParts.filter(p => p != null) // Only non-null parts
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.fileUrl) {
                const link = document.createElement('a');
                link.href = data.fileUrl;
                link.download = data.fileName;
                link.click();
            } else if (data.fileData) {
                const blob = base64ToBlob(data.fileData, data.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = data.fileName || `Section_11_Partial_${Date.now()}.docx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            
            showMessage('✅ DOCX downloaded successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate DOCX');
        }
        
    } catch (error) {
        console.error('Error generating DOCX:', error);
        showMessage('❌ Failed to generate DOCX file', 'error');
    }
}

// ==================== FIXED: addPartActionButtons with DOCX at every part ====================
function addPartActionButtons(data) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'part-actions';
    
    // ✅ FIXED: DOCX button available at EVERY part
    const isLastPart = data.currentPart === currentGenerationSession?.totalParts;
    
    actionsDiv.innerHTML = `
        <div class="action-buttons">
            ${!isLastPart ? `
                <button class="btn btn-success" onclick="approvePart(${data.currentPart})">
                    ✓ Approve & Continue
                </button>
            ` : ''}
            <button class="btn btn-warning" onclick="revisePart(${data.currentPart})">
                ✏️ Request Revision
            </button>
            <button class="btn btn-secondary" onclick="regeneratePart(${data.currentPart})">
                🔄 Regenerate
            </button>
            <button class="btn btn-primary" onclick="generatePartialDOCX()">
                📥 Download Current DOCX
            </button>
        </div>
        <div class="part-progress">
            Part ${data.currentPart} of ${currentGenerationSession?.totalParts || '?'}
            ${isLastPart ? ' • <strong>Complete!</strong>' : ''}
        </div>
    `;

    messagesContainer.appendChild(actionsDiv);
    scrollToBottom();
}
// ==================== APPROVE PART ====================
async function approvePart(partNumber) {
    console.log('✅ Approving part:', partNumber);

    if (!currentGenerationSession) {
        showMessage('❌ Unable to continue. Please start the generation process again.', 'error');
        return;
    }
    
    // Update UI to show approval
    const actionsDiv = document.querySelector('.part-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = '<div class="approval-message">✓ Part approved, generating next part...</div>';
    }
    
    // Update backend
    try {
        await fetch(`${TEMPLATE_API_BASE}/generate/${currentGenerationSession.documentId}/part`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                userId: currentUser.id,
                partNumber: partNumber,
                partContent: generatedParts[partNumber - 1]?.content,
                userFeedback: 'approved'
            })
        });
    } catch (error) {
        console.warn('Could not update part approval:', error);
    }
    
    // Request next part
    if (currentGenerationSession && partNumber < currentGenerationSession.totalParts) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = `Generate Part ${partNumber + 1} of ${currentGenerationSession.templateName}`;
            sendMessage();
        }
    } else {
        // All parts complete
        showMessage('✅ All parts generated! You can now download the DOCX file.', 'success');
        
        if (currentGenerationSession) {
            await fetch(`${TEMPLATE_API_BASE}/generate/${currentGenerationSession.documentId}/complete`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ userId: currentUser.id })
            });
        }
    }
}

// ==================== REVISE PART ====================
function revisePart(partNumber) {
    const feedback = prompt(`What changes would you like to make to Part ${partNumber}?`);
    if (!feedback) return;
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = `Revise Part ${partNumber}: ${feedback}`;
        sendMessage();
    }
}

// ==================== REGENERATE PART ====================
function regeneratePart(partNumber) {
    if (!confirm(`Regenerate Part ${partNumber}? This will replace the current content.`)) {
        return;
    }
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = `Regenerate Part ${partNumber} of ${currentGenerationSession?.templateName}`;
        sendMessage();
    }
}

// ==================== GENERATE DOCX ====================
async function generateDOCX() {
    if (!currentGenerationSession) {
        showMessage('❌ No active generation session', 'error');
        return;
    }
    
    try {
        showMessage('📝 Generating DOCX file...', 'info');
        
        const response = await fetch(`${TEMPLATE_API_BASE}/generate/docx`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                documentId: currentGenerationSession.documentId,
                userId: currentUser.id,
                parts: generatedParts
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.fileUrl) {
                const link = document.createElement('a');
                link.href = data.fileUrl;
                link.download = data.fileName;
                link.click();
            } else if (data.fileData) {
                const blob = base64ToBlob(data.fileData, data.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = data.fileName || `Section_11_${Date.now()}.docx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                throw new Error('DOCX data not available');
            }
            
            showMessage('✅ DOCX file downloaded successfully!', 'success');
            currentGenerationSession = null;
            generatedParts = [];
        } else {
            throw new Error(data.error || 'Failed to generate DOCX');
        }
        
    } catch (error) {
        console.error('Error generating DOCX:', error);
        showMessage('❌ Failed to generate DOCX file', 'error');
    }
}

function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    const sliceSize = 1024;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
}

// ==================== CSS STYLES FOR GENERATED PARTS ====================
const generationStyles = `
<style>
.generated-part {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
}

.part-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
}

.part-badge {
    background: #3b82f6;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}

.part-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
}

.part-content {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    margin: 16px 0;
    font-family: 'Times New Roman', serif;
    line-height: 1.8;
}

.part-content br + br + .generated-table-container,
.part-content br + .generated-table-container {
    margin-top: 0;
}

.generated-table-container {
    overflow-x: auto;
    margin: 1px 0 12px;
}

.generated-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Times New Roman', serif;
}

.generated-table th,
.generated-table td {
    border: 1px solid #94a3b8;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
}

.generated-table th {
    background: #e2e8f0;
    font-weight: 600;
    text-transform: uppercase;
}

.generated-table tr:nth-child(even) td {
    background: #f8fafc;
}

.extracted-data-summary {
    margin-top: 16px;
    padding: 12px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 13px;
}

.extracted-data-summary details {
    cursor: pointer;
}

.extracted-data-summary summary {
    font-weight: 600;
    color: #475569;
}

.extracted-data-summary pre {
    margin-top: 8px;
    padding: 12px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 11px;
}

.part-actions {
    margin: 20px 0;
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}

.action-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

.action-buttons .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-success {
    background: #10b981;
    color: white;
}

.btn-success:hover {
    background: #059669;
}

.btn-warning {
    background: #f59e0b;
    color: white;
}

.btn-warning:hover {
    background: #d97706;
}

.btn-secondary {
    background: #6b7280;
    color: white;
}

.btn-secondary:hover {
    background: #4b5563;
}

.btn-primary {
    background: #3b82f6;
    color: white;
}

.btn-primary:hover {
    background: #2563eb;
}

.part-progress {
    text-align: center;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
}

.approval-message {
    text-align: center;
    color: #10b981;
    font-weight: 600;
    padding: 12px;
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', generationStyles);

console.log('✅ Document generation features loaded');
