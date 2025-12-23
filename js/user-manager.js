// User Manager - Handles user registration and admin management

class UserManager {
    constructor() {
        this.currentUserRole = null;
        this.currentUserStatus = null;
        this.db = null;
        this.init();
    }

    async init() {
        if (!window.firestore || !window.firebaseAuth) {
            console.error('Firestore or Auth not available');
            return;
        }

        this.db = window.firestore;
        
        // Listen for auth state changes to update user role/status
        window.firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                await this.loadUserData(user.email);
            } else {
                this.currentUserRole = null;
                this.currentUserStatus = null;
            }
        });
    }

    async loadUserData(email) {
        if (!this.db) return;

        try {
            const userDoc = await this.db.collection('users').doc(email).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                this.currentUserRole = data.role || 'member';
                this.currentUserStatus = data.status || 'pending';
            } else {
                // Check if this is the initial admin
                if (email === 'ryan@crosbydevelopment.com') {
                    // Initialize as admin
                    await this.initializeAdmin(email);
                    this.currentUserRole = 'admin';
                    this.currentUserStatus = 'approved';
                } else {
                    this.currentUserRole = null;
                    this.currentUserStatus = null;
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async initializeAdmin(email) {
        if (!this.db) return;

        try {
            await this.db.collection('users').doc(email).set({
                email: email,
                role: 'admin',
                status: 'approved',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: 'system',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Admin initialized:', email);
        } catch (error) {
            console.error('Error initializing admin:', error);
        }
    }

    async registerUser(email, password, name) {
        try {
            // Create Firebase Auth user
            const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
            
            // Create user document in Firestore with pending status
            await this.db.collection('users').doc(email).set({
                email: email,
                name: name || '',
                role: 'member',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: null,
                approvedAt: null
            });

            // Sign out the newly created user (they need admin approval)
            await window.firebaseAuth.signOut();

            return { success: true, message: 'Registration successful! Your account is pending admin approval. You will be notified once approved.' };
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    async approveUser(email, role = 'member') {
        if (!this.isAdmin()) {
            return { success: false, error: 'Only admins can approve users.' };
        }

        try {
            await this.db.collection('users').doc(email).update({
                status: 'approved',
                role: role,
                approvedBy: window.firebaseAuth.currentUser.email,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error approving user:', error);
            return { success: false, error: error.message };
        }
    }

    async rejectUser(email) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Only admins can reject users.' };
        }

        try {
            await this.db.collection('users').doc(email).update({
                status: 'rejected',
                approvedBy: window.firebaseAuth.currentUser.email,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error rejecting user:', error);
            return { success: false, error: error.message };
        }
    }

    async updateUserRole(email, role) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Only admins can update user roles.' };
        }

        try {
            await this.db.collection('users').doc(email).update({
                role: role,
                updatedBy: window.firebaseAuth.currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating user role:', error);
            return { success: false, error: error.message };
        }
    }

    async getPendingUsers() {
        if (!this.isAdmin() || !this.db) {
            return [];
        }

        try {
            const snapshot = await this.db.collection('users')
                .where('status', '==', 'pending')
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting pending users:', error);
            return [];
        }
    }

    async getAllUsers() {
        if (!this.isAdmin() || !this.db) {
            return [];
        }

        try {
            const snapshot = await this.db.collection('users')
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }

    isAdmin() {
        return this.currentUserRole === 'admin' && this.currentUserStatus === 'approved';
    }

    isApproved() {
        return this.currentUserStatus === 'approved';
    }

    canAccess() {
        // Users can view projects without approval, but need approval for writes
        return true;
    }

    canWrite() {
        return this.isApproved();
    }
}

// Initialize user manager
window.userManager = new UserManager();

