// ==================== GLOBALS ====================
let currentTab = "login";
let otpTimers = {};
let hasTrackedLogin = false; // ✅ NEW: Prevent duplicate tracking

// ==================== WAIT FOR SUPABASE ====================
async function waitForSupabaseClient(timeoutMs = 3000) {
  const start = Date.now();
  while (typeof window.supabase === "undefined" && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (typeof window.supabase === "undefined") {
    console.error("❌ Supabase client not available after wait");
    throw new Error("Supabase not loaded");
  }
  console.log("✅ Supabase client loaded");
}

// ==================== INIT (RUN AFTER DOM READY) ====================
document.addEventListener("DOMContentLoaded", async () => {
  await waitForSupabaseClient();

  // ✅ FIXED: Auth state listener with duplicate prevention
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("📱 Auth event:", event);

    if (session) {
      localStorage.setItem("sb-session", JSON.stringify(session));
    } else {
      localStorage.removeItem("sb-session");
    }

    // ✅ Track login ONCE per session
    if (event === "SIGNED_IN" && session && !hasTrackedLogin) {
      const user = session.user;
      if (user) {
        hasTrackedLogin = true; // Mark as tracked
        await trackLoginEvent(user.id);
        
        // Reset flag after redirect
        setTimeout(() => {
          hasTrackedLogin = false;
        }, 2000);
      }
    }
  });
});

// ==================== LOGIN/LOGOUT TRACKING ====================
async function trackLoginEvent(userId) {
  try {
    console.log('📝 Tracking login for user:', userId);
    
    const { error } = await supabase.from("loginDetails").insert({
      useruid: userId,
      type: "login",
      timestamp: new Date().toISOString(),
    });
    
    if (error) {
      console.error("❌ Error tracking login:", error);
    } else {
      console.log("✅ Login tracked successfully");
    }
  } catch (err) {
    console.error("❌ Error tracking login event:", err);
  }
}

async function trackLogoutEvent(userId) {
  try {
    console.log('📝 Tracking logout for user:', userId);
    
    const { error } = await supabase.from("loginDetails").insert({
      useruid: userId,
      type: "logout",
      timestamp: new Date().toISOString(),
    });
    
    if (error) {
      console.error("❌ Error tracking logout:", error);
    } else {
      console.log("✅ Logout tracked successfully");
    }
  } catch (err) {
    console.error("❌ Error tracking logout event:", err);
  }
}

// ==================== GOOGLE SIGN IN ====================
async function signInWithGoogle() {
  try {
    console.log('🔐 Starting Google Sign-In...');
    showSuccessMessage("Redirecting to Google...");
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    
    if (error) throw error;
  } catch (err) {
    console.error("❌ Google Sign-In Error:", err);
    showErrorMessage("Google sign-in failed. Please try again.");
  }
}

const signUpWithGoogle = signInWithGoogle;

// ==================== UI HELPERS ====================
function showSuccessMessage(message) {
  // Create or update message element
  let msgEl = document.getElementById("successMessage");
  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.id = "successMessage";
    msgEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 90vw;
      font-size: 14px;
    `;
    document.body.appendChild(msgEl);
  }
  
  msgEl.textContent = message;
  msgEl.style.display = "block";
  
  setTimeout(() => {
    if (msgEl) msgEl.style.display = "none";
  }, 3000);
}

function showErrorMessage(message) {
  let msgEl = document.getElementById("successMessage");
  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.id = "successMessage";
    msgEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 90vw;
      font-size: 14px;
    `;
    document.body.appendChild(msgEl);
  }
  
  msgEl.textContent = message;
  msgEl.style.background = "#dc2626";
  msgEl.style.display = "block";
  
  setTimeout(() => {
    msgEl.style.display = "none";
    msgEl.style.background = "#10b981";
  }, 3000);
}

function redirectToDashboard() {
  window.location.href = "/"; // Redirect to the root path which serves index.ejs
}

// ==================== EXPORT FUNCTIONS ====================
window.signInWithGoogle = signInWithGoogle;
window.signUpWithGoogle = signUpWithGoogle;
window.redirectToDashboard = redirectToDashboard;
window.trackLoginEvent = trackLoginEvent;
window.trackLogoutEvent = trackLogoutEvent;

console.log('✅ Registration script loaded');
