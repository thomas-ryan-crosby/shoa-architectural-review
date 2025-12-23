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

        // Show main app immediately (no login required for viewing)
        const mainApp = document.getElementById('mainApp');
        if (mainApp) mainApp.style.display = 'block';
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'none';

        // Listen for auth state changes
        window.firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                this.user = user;
                // Load user data and check status
                if (window.userManager) {
                    await window.userManager.loadUserData(user.email);
                    // Check if user is approved
                    if (!window.userManager.isApproved()) {
                        alert('Your account is pending admin approval. You can view projects but cannot make changes until approved.');
                        await window.firebaseAuth.signOut();
                        return;
                    }
                }
                this.showApp();
                console.log('User signed in:', user.email);
            } else {
                this.user = null;
                // Don't hide app, just update UI for write operations
                if (window.projectManager) {
                    window.projectManager.checkAuthForWrites();
                    window.projectManager.renderProjects();
                }
                console.log('User signed out');
            }
        });
    }

    showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            // Close on backdrop click
            loginScreen.addEventListener('click', (e) => {
                if (e.target === loginScreen) {
                    this.hideLogin();
                }
            });
            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideLogin();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }
    
    hideLogin() {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.style.display = 'none';
        }
    }

    showRegister() {
        const registerScreen = document.getElementById('registerScreen');
        if (registerScreen) {
            registerScreen.style.display = 'flex';
            // Close on backdrop click
            registerScreen.addEventListener('click', (e) => {
                if (e.target === registerScreen) {
                    this.hideRegister();
                }
            });
            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideRegister();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }

    hideRegister() {
        const registerScreen = document.getElementById('registerScreen');
        if (registerScreen) {
            registerScreen.style.display = 'none';
        }
    }

    showApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        // Update user email display and login/logout buttons
        const userEmailWidget = document.getElementById('userEmailWidget');
        const userEmail = document.getElementById('userEmail');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminPanelBtn = document.getElementById('adminPanelBtn');
        
        if (this.user) {
            if (userEmailWidget) {
                userEmailWidget.style.display = 'flex';
            }
            if (userEmail) {
                userEmail.textContent = this.user.email;
                userEmail.setAttribute('title', this.user.email); // Tooltip with full email
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            
            // Show Admin Panel button if user is admin
            if (adminPanelBtn && window.userManager && window.userManager.isAdmin()) {
                adminPanelBtn.style.display = 'block';
            } else if (adminPanelBtn) {
                adminPanelBtn.style.display = 'none';
            }
        } else {
            if (userEmailWidget) {
                userEmailWidget.style.display = 'none';
            }
            if (userEmail) {
                userEmail.textContent = '';
                userEmail.removeAttribute('title');
            }
            if (loginBtn) loginBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (adminPanelBtn) adminPanelBtn.style.display = 'none';
        }

        // Update project manager UI for write operations
        if (window.projectManager) {
            window.projectManager.checkAuthForWrites();
            window.projectManager.renderProjects(); // Re-render to update button states
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

// Setup login form and buttons
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtn');
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
            } else {
                // Close login modal on successful login
                if (window.authHandler) {
                    window.authHandler.hideLogin();
                }
            }
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.showLogin();
            }
        });
    }
    
    // Close login modal button
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.hideLogin();
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

    // Registration form handling
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const closeRegisterBtn = document.getElementById('closeRegisterBtn');
    const showLoginFromRegisterBtn = document.getElementById('showLoginFromRegisterBtn');
    const registerError = document.getElementById('registerError');
    const registerSuccess = document.getElementById('registerSuccess');

    // Show registration modal
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.hideLogin();
                window.authHandler.showRegister();
            }
        });
    }

    // Close registration modal
    if (closeRegisterBtn) {
        closeRegisterBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.hideRegister();
            }
        });
    }

    // Show login from register modal
    if (showLoginFromRegisterBtn) {
        showLoginFromRegisterBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.hideRegister();
                window.authHandler.showLogin();
            }
        });
    }

    // Also handle the "showLoginBtn" in the register screen (if it exists)
    const showLoginBtn = document.getElementById('showLoginBtn');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            if (window.authHandler) {
                window.authHandler.hideRegister();
                window.authHandler.showLogin();
            }
        });
    }

    // Handle registration form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

            // Clear previous errors
            if (registerError) {
                registerError.style.display = 'none';
                registerError.textContent = '';
            }
            if (registerSuccess) {
                registerSuccess.style.display = 'none';
                registerSuccess.textContent = '';
            }

            // Validate passwords match
            if (password !== passwordConfirm) {
                if (registerError) {
                    registerError.textContent = 'Passwords do not match.';
                    registerError.style.display = 'block';
                }
                return;
            }

            // Validate password length
            if (password.length < 6) {
                if (registerError) {
                    registerError.textContent = 'Password must be at least 6 characters long.';
                    registerError.style.display = 'block';
                }
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            // Register user via UserManager
            if (window.userManager) {
                const result = await window.userManager.registerUser(email, password, name);
                
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;

                if (result.success) {
                    // Show success message
                    if (registerSuccess) {
                        registerSuccess.textContent = result.message || 'Registration successful! Your account is pending admin approval.';
                        registerSuccess.style.display = 'block';
                    }
                    // Clear form
                    registerForm.reset();
                    // Close registration modal after a delay
                    setTimeout(() => {
                        if (window.authHandler) {
                            window.authHandler.hideRegister();
                        }
                    }, 2000);
                } else {
                    // Show error message
                    if (registerError) {
                        registerError.textContent = result.error || 'Registration failed. Please try again.';
                        registerError.style.display = 'block';
                    }
                }
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                if (registerError) {
                    registerError.textContent = 'User manager not available. Please refresh the page and try again.';
                    registerError.style.display = 'block';
                }
            }
        });
    }
});

