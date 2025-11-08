// ==================== TERMS & CONDITIONS PAGE SCRIPT ====================

let currentUser = null;
let supabase = null;

// ==================== WAIT FOR SUPABASE ====================
async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabase && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    if (!window.supabase) throw new Error('Supabase not loaded');
    supabase = window.supabase;
    console.log('✅ Supabase loaded on Terms page');
}

// ==================== CHECK AUTHENTICATION ====================
async function checkAuth() {
    try {
        await waitForSupabase();

        // Check localStorage first
        const localUser = localStorage.getItem('cm_user');
        if (localUser) {
            const userData = JSON.parse(localUser);
            currentUser = userData;
            displayUserInfo(userData);
            console.log('✅ User authenticated from localStorage');
            return true;
        }

        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            console.log('No session - Terms page can be viewed without login');
            return false;
        }

        currentUser = session.user;
        const userData = {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || 
                       session.user.user_metadata?.name || 
                       session.user.email?.split('@')[0] || 'User',
            avatar_url: session.user.user_metadata?.picture
        };
        localStorage.setItem('cm_user', JSON.stringify(userData));
        displayUserInfo(userData);
        return true;

    } catch (error) {
        console.error('Auth error:', error);
        return false;
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

// ==================== ACCEPT TERMS ====================
async function acceptTerms() {
    try {
        if (!currentUser) {
            showMessage('Please log in to accept terms', 'info');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }

        // Save acceptance to database or localStorage
        const acceptance = {
            userId: currentUser.id,
            acceptedAt: new Date().toISOString(),
            version: '1.0'
        };

        // Save to localStorage
        localStorage.setItem('terms_accepted', JSON.stringify(acceptance));

        // Optional: Save to Supabase if you have a terms_acceptance table
        try {
            await supabase
                .from('user_preferences')
                .upsert({
                    user_id: currentUser.id,
                    terms_accepted: true,
                    terms_accepted_at: new Date().toISOString()
                });
        } catch (err) {
            console.log('Could not save to database:', err);
        }

        showMessage('✅ Terms accepted successfully!', 'success');
        
        // Redirect to dashboard after 1 second
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);

    } catch (error) {
        console.error('Error accepting terms:', error);
        showMessage('❌ Error accepting terms', 'error');
    }
}

// ==================== SHOW MESSAGE ====================
function showMessage(message, type = 'info') {
    // Remove existing message if any
    const existingMessage = document.querySelector('.toast-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `toast-message toast-${type}`;
    messageEl.textContent = message;

    // Add styles
    messageEl.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
    `;

    // Set colors based on type
    if (type === 'success') {
        messageEl.style.background = '#10b981';
        messageEl.style.color = '#ffffff';
    } else if (type === 'error') {
        messageEl.style.background = '#ef4444';
        messageEl.style.color = '#ffffff';
    } else if (type === 'info') {
        messageEl.style.background = '#3b82f6';
        messageEl.style.color = '#ffffff';
    }

    document.body.appendChild(messageEl);

    // Auto remove after 3 seconds
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageEl.remove(), 300);
    }, 3000);
}

// Add CSS animation for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================== SMOOTH SCROLL TO SECTION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuth();

    // Handle hash links
    const hash = window.location.hash;
    if (hash) {
        setTimeout(() => {
            const element = document.querySelector(hash);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    // Add click handlers to TOC links
    document.querySelectorAll('.terms-toc a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Update URL without jumping
                history.pushState(null, null, targetId);
            }
        });
    });

    // Add scroll spy for active TOC item
    setupScrollSpy();

    // Print button handler
    setupPrintButton();
});

// ==================== SCROLL SPY ====================
function setupScrollSpy() {
    const sections = document.querySelectorAll('.terms-section[id]');
    const tocLinks = document.querySelectorAll('.terms-toc a');

    if (sections.length === 0 || tocLinks.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                tocLinks.forEach(link => {
                    link.style.fontWeight = link.getAttribute('href') === `#${id}` ? 'bold' : 'normal';
                });
            }
        });
    }, {
        rootMargin: '-100px 0px -66%',
        threshold: 0
    });

    sections.forEach(section => observer.observe(section));
}

// ==================== PRINT FUNCTIONALITY ====================
function setupPrintButton() {
    // Add print button to header
    const termsHeader = document.querySelector('.terms-header');
    if (termsHeader) {
        const printBtn = document.createElement('button');
        printBtn.innerHTML = '<i class="fas fa-print"></i> Print';
        printBtn.className = 'print-btn';
        printBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        printBtn.addEventListener('click', () => window.print());
        termsHeader.style.position = 'relative';
        termsHeader.appendChild(printBtn);
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + P for print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
    }

    // Escape to go back
    if (e.key === 'Escape') {
        window.history.back();
    }
});

// ==================== TRACK READING PROGRESS ====================
let readingProgress = 0;
let startTime = Date.now();

window.addEventListener('scroll', function() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    
    if (scrolled > readingProgress) {
        readingProgress = scrolled;
        
        // Track if user read 80% or more
        if (scrolled >= 80 && currentUser) {
            const timeSpent = (Date.now() - startTime) / 1000; // seconds
            console.log(`User read ${scrolled.toFixed(0)}% in ${timeSpent.toFixed(0)} seconds`);
            
            // Optional: Save reading analytics
            try {
                localStorage.setItem('terms_read_progress', JSON.stringify({
                    userId: currentUser.id,
                    progress: scrolled,
                    timeSpent: timeSpent,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                console.log('Could not save reading progress');
            }
        }
    }
});

console.log('✅ Terms & Conditions page script loaded');