// ==================== DYNAMIC SYSTEM PROMPTS ====================
// This will be populated from Supabase quick_actions table
let SYSTEM_PROMPTS = {};

/**
 * Load quick actions from Supabase
 * Replaces hardcoded prompts with dynamic database-driven prompts
 */
async function loadQuickActions() {
    try {
        console.log('📄 Loading quick actions from Supabase...');
        
        // ✅ Wait for supabase to be available with multiple retries
        let retries = 0;
        while (!window.supabase && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (!window.supabase) {
            console.error('❌ Supabase not loaded after waiting');
            showFallbackQuickActions();
            return;
        }
        
        console.log('✅ Supabase found, fetching quick_actions...');
        
        // First, try to get data from Supabase
        const { data, error } = await window.supabase
            .from('quick_actions')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        
        // ✅ Detailed error logging
        if (error) {
            console.error('❌ Supabase Error Details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            console.log('🔄 Using fallback actions due to error');
            showFallbackQuickActions();
            return;
        }
        
        // ✅ Log data received
        console.log('📦 Data received from Supabase:', data);
        console.log('📊 Number of actions:', data ? data.length : 0);
        
        // If we have data from Supabase, use it
        if (data && data.length > 0) {
            // Transform database records into SYSTEM_PROMPTS format
            SYSTEM_PROMPTS = {};
            data.forEach((action, index) => {
                console.log(`📝 Processing action ${index + 1}:`, {
                    key: action.prompt_key,
                    title: action.display_content,
                    order: action.display_order
                });
                
                SYSTEM_PROMPTS[action.prompt_key] = {
                    id: action.id,
                    title: action.display_content,
                    subtitle: action.display_subtitle,
                    icon: action.icon_emoji,
                    displayPrompt: action.display_prompt,
                    hiddenPrompt: action.hidden_prompt,
                    prompt: action.display_prompt, // For backward compatibility
                    requiresDocument: action.requires_document,
                    displayOrder: action.display_order
                };
            });
            
            console.log(`✅ Loaded ${data.length} quick actions from database`);
            console.log('📋 Actions loaded:', Object.keys(SYSTEM_PROMPTS));
            
            // Render the quick actions in sidebar
            renderQuickActions(data);
            return;
        }
        
        // If no data in Supabase, check localStorage for cached data
        const cachedActions = localStorage.getItem('quick_actions_cache');
        if (cachedActions) {
            try {
                const parsedActions = JSON.parse(cachedActions);
                console.log('✅ Using cached quick actions from localStorage');
                showFallbackQuickActions(parsedActions);
                return;
            } catch (e) {
                console.warn('⚠️ Failed to parse cached actions:', e);
            }
        }
        
        // If no data anywhere, show fallback actions
        console.warn('⚠️ No quick actions found in database or cache');
        showFallbackQuickActions();
        
    } catch (error) {
        console.error('❌ Exception in loadQuickActions:', error);
        console.error('Stack trace:', error.stack);
        showFallbackQuickActions();
    }
}

/**
 * Show fallback quick actions if database load fails
 * @param {Array} cachedActions - Optional cached actions to use
 */
function showFallbackQuickActions(cachedActions = null) {
    console.log('⚠️ Showing fallback quick actions (4 actions only)');
    console.log('💡 This means Supabase data could not be loaded');
    
    // Use cached actions if provided
    if (cachedActions && cachedActions.length > 0) {
        console.log('✅ Using cached actions instead of hardcoded fallback');
        renderQuickActions(cachedActions);
        return;
    }
    
    const fallbackActions = [
        {
            prompt_key: 'analyze-risk',
            icon_emoji: '⚖️',
            display_content: 'Analyze Contract Risks',
            display_subtitle: 'Identify potential legal risks',
            display_prompt: 'Please analyze contract risks',
            hidden_prompt: 'Please analyze the uploaded contract/document and identify all potential legal risks, liability issues, unfavorable terms, and areas of concern. Provide a detailed risk assessment with severity levels (High/Medium/Low) for each identified risk.',
            requires_document: true,
            display_order: 1
        },
        {
            prompt_key: 'draft-nda',
            icon_emoji: '📝',
            display_content: 'Draft NDA Template',
            display_subtitle: 'Create non-disclosure agreement',
            display_prompt: 'Please draft an NDA template',
            hidden_prompt: 'Please draft a comprehensive Non-Disclosure Agreement (NDA) template. Include standard clauses for: definition of confidential information, obligations of receiving party, permitted disclosures, term and termination, remedies for breach, and general provisions.',
            requires_document: false,
            display_order: 2
        },
        {
            prompt_key: 'check-compliance',
            icon_emoji: '🛡️',
            display_content: 'Check Compliance',
            display_subtitle: 'Verify regulatory requirements',
            display_prompt: 'Please check compliance',
            hidden_prompt: 'Please review the uploaded document for regulatory compliance issues. Check for adherence to relevant laws, industry standards, data protection requirements, and best practices. Highlight any non-compliant sections and suggest corrections.',
            requires_document: true,
            display_order: 3
        },
        {
            prompt_key: 'review-terms',
            icon_emoji: '🔍',
            display_content: 'Review Contract Terms',
            display_subtitle: 'Analyze terms and conditions',
            display_prompt: 'Please review contract terms',
            hidden_prompt: 'Please conduct a thorough review of all terms and conditions in the uploaded contract. Analyze: payment terms, deliverables, timelines, warranties, indemnification clauses, limitation of liability, termination conditions, and dispute resolution mechanisms.',
            requires_document: true,
            display_order: 4
        }
    ];
    
    // Populate SYSTEM_PROMPTS
    SYSTEM_PROMPTS = {};
    fallbackActions.forEach(action => {
        SYSTEM_PROMPTS[action.prompt_key] = {
            title: action.display_content,
            subtitle: action.display_subtitle,
            icon: action.icon_emoji,
            displayPrompt: action.display_prompt,
            hiddenPrompt: action.hidden_prompt,
            prompt: action.display_prompt,
            requiresDocument: action.requires_document,
            displayOrder: action.display_order
        };
    });
    
    // Cache fallback actions
    try {
        localStorage.setItem('quick_actions_cache', JSON.stringify(fallbackActions));
    } catch (e) {
        console.warn('⚠️ Failed to cache fallback actions:', e);
    }
    
    renderQuickActions(fallbackActions);
}

/**
 * Render quick actions dynamically in the sidebar
 * @param {Array} actions - Array of quick action objects from database
 */
function renderQuickActions(actions) {
    console.log('🎨 Rendering quick actions...');
    
    const container = document.getElementById('quickActionsContainer');
    if (!container) {
        console.error('❌ Quick actions container "#quickActionsContainer" not found in DOM');
        return;
    }
    
    console.log('✅ Container found:', container);
    
    // Clear existing content
    container.innerHTML = '';
    
    if (!actions || actions.length === 0) {
        console.warn('⚠️ No actions to render');
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
                No quick actions available
            </div>
        `;
        return;
    }
    
    console.log(`📝 Rendering ${actions.length} action cards...`);
    
    // Render each action
    actions.forEach((action, index) => {
        const button = document.createElement('button');
        button.className = 'system-prompt-card';
        button.onclick = () => useSystemPrompt(action.prompt_key);
        
        button.innerHTML = `
            <div class="prompt-icon">${action.icon_emoji || '⚖️'}</div>
            <div class="prompt-content">
                <div class="prompt-title">${action.display_content}</div>
                ${action.display_subtitle ? `<div class="prompt-subtitle">${action.display_subtitle}</div>` : ''}
            </div>
        `;
        
        container.appendChild(button);
        console.log(`  ✓ Rendered action ${index + 1}: ${action.display_content}`);
    });
    
    console.log(`✅ Successfully rendered ${actions.length} quick action cards`);
}

/**
 * Use a system prompt template
 * @param {string} promptKey - Key of the system prompt to use
 */
function useSystemPrompt(promptKey) {
    console.log('🎯 Using system prompt:', promptKey);
    
    const promptData = SYSTEM_PROMPTS[promptKey];
    
    if (!promptData) {
        console.error('❌ System prompt not found:', promptKey);
        console.log('Available prompts:', Object.keys(SYSTEM_PROMPTS));
        showToast('❌ Quick action not found', 'error');
        return;
    }
    
    console.log('📝 Prompt data:', {
        title: promptData.title,
        requiresDocument: promptData.requiresDocument,
        displayPrompt: promptData.displayPrompt?.substring(0, 50) + '...',
        hiddenPrompt: promptData.hiddenPrompt?.substring(0, 50) + '...'
    });
    
    // Check if document is required
    if (promptData.requiresDocument) {
        // Check if there are documents in the current project
        const hasDocuments = checkIfDocumentsAvailable();
        
        if (!hasDocuments) {
            // Show message to upload document first
            console.log('⚠️ Document required but not available');
            showToast('⚠️ Please upload a document first to use this feature', 'warning');
            
            // Optionally open file picker
            setTimeout(() => {
                document.getElementById('fileInput')?.click();
            }, 1000);
            
            return;
        }
    }
    
    // Hide welcome screen
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // Get the chat input element
    const chatInput = document.getElementById('chatInput');
    
    // Store the display prompt for sending (not hidden prompt)
    const messageToSend = promptData.displayPrompt;
    
    // Directly send the message without showing in input
    if (typeof sendMessage === 'function') {
        // Temporarily set the display prompt as the message
        if (chatInput) {
            const originalValue = chatInput.value;
            chatInput.value = messageToSend;
            
            // Send the message
            sendMessage();
            
            // Clear the input after sending
            setTimeout(() => {
                chatInput.value = '';
                chatInput.style.height = 'auto';
            }, 100);
        }
        
        console.log('✅ Message sent directly without showing in input');
    } else {
        console.error('❌ sendMessage function not found');
        showToast('❌ Failed to send message', 'error');
    }
    
    // Show toast notification
    showToast(`✅ Sent: ${promptData.title}`, 'success');
}

/**
 * Check if documents are available in current context
 * @returns {boolean}
 */
function checkIfDocumentsAvailable() {
    // Check if there are uploaded documents in current session
    if (typeof uploadedDocuments !== 'undefined' && uploadedDocuments && uploadedDocuments.length > 0) {
        console.log('✅ Documents found in uploadedDocuments');
        return true;
    }
    
    // Check if project has documents
    if (typeof projectDocuments !== 'undefined' && projectDocuments && projectDocuments.length > 0) {
        console.log('✅ Documents found in projectDocuments');
        return true;
    }
    
    // Check Qdrant document count
    if (typeof qdrantDocumentCount !== 'undefined' && qdrantDocumentCount > 0) {
        console.log('✅ Documents found in Qdrant');
        return true;
    }
    
    console.log('⚠️ No documents available');
    return false;
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type of toast (success/warning/error)
 */
function showToast(message, type = 'info') {
    // Check if toast container exists
    let toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6';
    
    toast.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
        cursor: pointer;
    `;
    
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100px);
            }
        }
    `;
    
    if (!document.getElementById('toastStyles')) {
        style.id = 'toastStyles';
        document.head.appendChild(style);
    }
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Remove on click
    toast.onclick = () => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    };
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}

// ==================== DEBUG FUNCTION ====================
/**
 * Manual test function - call this from browser console
 */
window.debugQuickActions = async function() {
    console.log('🔍 === QUICK ACTIONS DEBUG ===');
    console.log('1. Checking Supabase...');
    console.log('   Supabase loaded:', !!window.supabase);
    
    if (window.supabase) {
        console.log('2. Testing database connection...');
        try {
            // Test if we can access the database at all
            const { data: test_data, error: test_error } = await window.supabase
                .from('quick_actions')
                .select('count')
                .limit(1);
            
            console.log('   Test query result:');
            console.log('   Error:', test_error);
            console.log('   Data:', test_data);
            
            // If test query fails, try to list all tables
            if (test_error) {
                console.log('3. Trying to list tables...');
                try {
                    // This is a Supabase-specific way to list tables
                    const { data: tables, error: tables_error } = await window.supabase
                        .from('information_schema.tables')
                        .select('table_name')
                        .eq('table_schema', 'public');
                    
                    if (tables_error) {
                        console.log('   Tables query error:', tables_error);
                    } else {
                        console.log('   Available tables:', tables.map(t => t.table_name));
                        const hasQuickActions = tables.some(t => t.table_name === 'quick_actions');
                        console.log('   quick_actions table exists:', hasQuickActions);
                    }
                } catch (e) {
                    console.log('   Exception listing tables:', e);
                }
            }
            
            // Try the actual query
            console.log('4. Trying actual quick_actions query...');
            const { data, error } = await window.supabase
                .from('quick_actions')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            
            console.log('5. Query result:');
            console.log('   Error:', error);
            console.log('   Data:', data);
            console.log('   Count:', data ? data.length : 0);
            
            if (data && data.length > 0) {
                console.log('6. Actions found:');
                data.forEach((action, i) => {
                    console.log(`   ${i + 1}. ${action.display_content} (${action.prompt_key})`);
                });
            } else {
                console.log('6. No actions found in database');
            }
        } catch (e) {
            console.error('3. Exception:', e);
        }
    } else {
        console.log('2. Supabase not available');
    }
    
    console.log('7. Current SYSTEM_PROMPTS:', SYSTEM_PROMPTS);
    console.log('   Loaded actions:', Object.keys(SYSTEM_PROMPTS).length);
    console.log('=== END DEBUG ===');
};

// ✅ Auto-load on page load with proper timing
console.log('📦 Quick Actions module initializing...');

// Wait for both DOM and Supabase
const initQuickActions = async () => {
    console.log('🚀 Initializing quick actions...');
    
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    console.log('✅ DOM ready');
    
    // Small delay to ensure Supabase is fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Load quick actions
    await loadQuickActions();
};

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickActions);
} else {
    // DOM already loaded, wait a bit for Supabase
    setTimeout(initQuickActions, 500);
}

console.log('✅ Quick Actions module loaded');
console.log('💡 To debug, run: debugQuickActions()');