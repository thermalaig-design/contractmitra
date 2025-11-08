// ==================== GLOBAL VARIABLES ====================
let billingPeriod = 'monthly'; // 'monthly' or 'yearly'

// ==================== DOM LOADED ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Pricing page loading...');
    
    // Initialize all functionality
    initSidebar();
    initBillingToggle();
    initPlanButtons();
    loadUserData();
});

// ==================== SIDEBAR FUNCTIONALITY ====================
function initSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }
}

// ==================== BILLING TOGGLE FUNCTIONALITY ====================
function initBillingToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            
            // Update active state
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update global period
            billingPeriod = period;
            
            // Update prices
            updatePricing(period);
        });
    });
}

// ==================== UPDATE PRICING ====================
function updatePricing(period) {
    console.log('Switching to:', period);
    
    if (period === 'yearly') {
        // Show yearly prices
        document.querySelectorAll('.monthly-price').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.yearly-price').forEach(el => {
            el.style.display = 'inline';
        });
        document.querySelectorAll('.yearly-note').forEach(el => {
            el.style.display = 'block';
        });
    } else {
        // Show monthly prices
        document.querySelectorAll('.monthly-price').forEach(el => {
            el.style.display = 'inline';
        });
        document.querySelectorAll('.yearly-price').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.yearly-note').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// ==================== PLAN BUTTONS ====================
function initPlanButtons() {
    // Upgrade to Pro button
    const proButtons = document.querySelectorAll('.primary-button');
    proButtons.forEach(button => {
        button.addEventListener('click', function() {
            handlePlanUpgrade('professional');
        });
    });
    
    // Contact Sales button
    const enterpriseButtons = document.querySelectorAll('.secondary-button');
    enterpriseButtons.forEach(button => {
        button.addEventListener('click', function() {
            handlePlanUpgrade('enterprise');
        });
    });
}

// ==================== HANDLE PLAN UPGRADE ====================
function handlePlanUpgrade(plan) {
    console.log('Upgrading to:', plan);
    
    if (plan === 'professional') {
        // Calculate total based on billing period
        const amount = billingPeriod === 'monthly' ? '₹10,000' : '₹1,00,000';
        const period = billingPeriod === 'monthly' ? 'per month' : 'per year';
        
        if (confirm(`Upgrade to Professional Plan?\n\nAmount: ${amount} ${period}\n\nYou'll be redirected to payment page.`)) {
            // Redirect to payment or show payment modal
            showPaymentModal('professional', amount);
        }
    } else if (plan === 'enterprise') {
        // For enterprise, show contact form or redirect
        if (confirm('Contact our sales team for Enterprise plan?\n\nYou\'ll be redirected to contact form.')) {
            // Redirect to contact form or open modal
            showContactModal();
        }
    }
}

// ==================== PAYMENT MODAL (Placeholder) ====================
function showPaymentModal(plan, amount) {
    alert(`Payment Gateway Integration Coming Soon!\n\nPlan: ${plan}\nAmount: ${amount}\n\nYou'll receive an email with payment instructions.`);
    
    // In real implementation, this would:
    // 1. Open payment gateway (Razorpay/Stripe)
    // 2. Handle payment success/failure
    // 3. Update user subscription in database
    // 4. Show confirmation
}

// ==================== CONTACT MODAL (Placeholder) ====================
function showContactModal() {
    alert('Contact Sales Form\n\nFor Enterprise plan inquiries:\n\n📧 Email: sales@contractmitra.com\n📞 Phone: +91 XXXX-XXXXXX\n\nOur team will contact you within 24 hours.');
    
    // In real implementation, this would:
    // 1. Show contact form modal
    // 2. Send inquiry to sales team
    // 3. Show confirmation
}

// ==================== LOAD USER DATA ====================
async function loadUserData() {
    try {
        // Always load from database first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            // Fallback to localStorage
            const localUser = localStorage.getItem('cm_user');
            if (localUser) {
                const userData = JSON.parse(localUser);
                displayUserInfo(userData);
                await loadCurrentPlan(userData.id);
            }
            return;
        }

        // Load from contractor_profiles table
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
            // Fallback to auth user or localStorage
            const localUser = localStorage.getItem('cm_user');
            if (localUser) {
                userData = JSON.parse(localUser);
            } else {
                userData = {
                    id: user.id,
                    email: user.email,
                    full_name: user.email?.split('@')[0] || 'User',
                    avatar_url: null
                };
            }
        }

        // Always update localStorage with latest data
        localStorage.setItem('cm_user', JSON.stringify(userData));
        displayUserInfo(userData);
        
        // Load user's current plan and usage
        await loadCurrentPlan(userData.id);
    } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to localStorage
        const localUser = localStorage.getItem('cm_user');
        if (localUser) {
            try {
                const userData = JSON.parse(localUser);
                displayUserInfo(userData);
                await loadCurrentPlan(userData.id);
            } catch (e) {
                console.error('Error parsing localStorage data:', e);
            }
        }
    }
}

// ==================== DISPLAY USER INFO ====================
function displayUserInfo(userData) {
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userNameDisplay && userData.full_name) {
        const firstName = userData.full_name.split(' ')[0];
        userNameDisplay.textContent = firstName;
    }
    
    if (userAvatar && userData.full_name) {
        userAvatar.textContent = userData.full_name.charAt(0).toUpperCase();
    }
}

// ==================== LOAD CURRENT PLAN ====================
async function loadCurrentPlan(userId) {
    try {
        // In real implementation, fetch from Supabase
        // For now, using mock data
        
        const mockPlanData = {
            plan_type: 'free',
            ai_messages_used: 15,
            ai_messages_limit: 50,
            projects_used: 1,
            projects_limit: 2,
            documents_used: 8,
            documents_limit: 40
        };
        
        updateUsageDisplay(mockPlanData);
        
    } catch (error) {
        console.error('Error loading plan data:', error);
    }
}

// ==================== UPDATE USAGE DISPLAY ====================
function updateUsageDisplay(planData) {
    // Update AI Messages usage
    const aiMessagesFill = document.querySelector('.usage-item:nth-child(1) .usage-fill');
    const aiMessagesValue = document.querySelector('.usage-item:nth-child(1) .usage-value');
    if (aiMessagesFill && aiMessagesValue) {
        const percentage = (planData.ai_messages_used / planData.ai_messages_limit) * 100;
        aiMessagesFill.style.width = percentage + '%';
        aiMessagesValue.textContent = `${planData.ai_messages_used} / ${planData.ai_messages_limit}`;
    }
    
    // Update Projects usage
    const projectsFill = document.querySelector('.usage-item:nth-child(2) .usage-fill');
    const projectsValue = document.querySelector('.usage-item:nth-child(2) .usage-value');
    if (projectsFill && projectsValue) {
        const percentage = (planData.projects_used / planData.projects_limit) * 100;
        projectsFill.style.width = percentage + '%';
        projectsValue.textContent = `${planData.projects_used} / ${planData.projects_limit}`;
    }
    
    // Update Documents usage
    const documentsFill = document.querySelector('.usage-item:nth-child(3) .usage-fill');
    const documentsValue = document.querySelector('.usage-item:nth-child(3) .usage-value');
    if (documentsFill && documentsValue) {
        const percentage = (planData.documents_used / planData.documents_limit) * 100;
        documentsFill.style.width = percentage + '%';
        documentsValue.textContent = `${planData.documents_used} / ${planData.documents_limit}`;
    }
}

// ==================== FAQ ACCORDION ====================
document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', function() {
        // Toggle active class for animation (if needed)
        this.classList.toggle('faq-active');
    });
});

// ==================== SMOOTH SCROLL FOR SETTINGS NAV ====================
document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        // If these are real links to different sections, handle navigation
        console.log('Settings nav clicked:', this.textContent);
    });
});

// ==================== RESPONSIVE HANDLING ====================
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    
    // Close sidebar on resize to desktop
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('open');
    }
});

// ==================== UTILITY FUNCTIONS ====================

// Format currency for Indian Rupees
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Show notification/toast (for future use)
function showNotification(message, type = 'info') {
    // In real implementation, show a toast notification
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Log analytics event (for future use)
function logAnalyticsEvent(eventName, eventData) {
    console.log('Analytics Event:', eventName, eventData);
    // In real implementation, send to analytics service
}

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

// ==================== DEBUG INFO ====================
console.log('Pricing page initialized');
console.log('Current billing period:', billingPeriod);