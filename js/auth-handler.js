// Authentication Handler - Manages Firebase Authentication

class AuthHandler {
    constructor() {
        this.user = null;
        this.init();
    }

    init() {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available');
            return;
        }

        // Listen for auth state changes
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                this.showApp();
                console.log('User signed in:', user.email);
            } else {
                this.user = null;
                this.showLogin();
                console.log('User signed out');
            }
        });
    }

    showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }

    showApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        // Update user email display
        const userEmail = document.getElementById('userEmail');
        if (userEmail && this.user) {
            userEmail.textContent = this.user.email;
        }
    }

    async signIn(email, password) {
        try {
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
            this.user = userCredential.user;
            return { success: true };
        } catch (error) {
            console.error('Sign in error:', error);
            return { 
                success: false, 
                error: this.getErrorMessage(error.code) 
            };
        }
    }

    async signOut() {
        try {
            await window.firebaseAuth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }

    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };
        return errorMessages[errorCode] || 'Sign in failed. Please try again.';
    }

    isAuthenticated() {
        return this.user !== null;
    }

    getCurrentUser() {
        return this.user;
    }
}

// Initialize auth handler
window.authHandler = new AuthHandler();

// Setup login form
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (loginError) {
                loginError.style.display = 'none';
                loginError.textContent = '';
            }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            const result = await window.authHandler.signIn(email, password);

            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            if (!result.success) {
                if (loginError) {
                    loginError.textContent = result.error;
                    loginError.style.display = 'block';
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to sign out?')) {
                await window.authHandler.signOut();
            }
        });
    }
});

