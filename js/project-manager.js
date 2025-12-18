// Project Manager - Handles project tracking and storage

class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentFilter = 'all';
        this.firestoreEnabled = false;
        this.collectionName = 'projects';
        this.init();
    }

    async init() {
        // Initialize UI components (no auth required for viewing)
        this.setupTabs();
        this.setupFilters();
        this.setupAddProjectForm();
        
        // Initialize Firebase/Firestore (works without auth for reads)
        await this.initializeFirestore();
        
        // Update storage status indicator
        this.updateStorageStatus();
        
        // Load projects from Firestore (read-only, no auth required)
        await this.loadProjects();
        
        // Render projects
        this.renderProjects();
        
        // Check auth status for write operations
        this.checkAuthForWrites();
    }

    checkAuthForWrites() {
        // Update UI based on auth status
        const isAuthenticated = window.authHandler && window.authHandler.isAuthenticated();
        
        // Update "Add Project" button
        const addProjectBtn = document.getElementById('toggleAddProjectBtn');
        if (addProjectBtn) {
            if (!isAuthenticated) {
                addProjectBtn.textContent = 'Sign In to Add Project';
                // Remove existing listeners and add new one
                const newBtn = addProjectBtn.cloneNode(true);
                addProjectBtn.parentNode.replaceChild(newBtn, addProjectBtn);
                newBtn.addEventListener('click', () => this.promptLogin('add project'));
            } else {
                const toggleText = document.getElementById('toggleAddProjectText');
                if (toggleText) {
                    toggleText.textContent = '+ Add Existing Project';
                }
            }
        }
        
        // Update generate button (handled in form-handler.js, but update tooltip)
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            if (!isAuthenticated) {
                generateBtn.title = 'Sign in to generate approval letters';
            } else {
                generateBtn.title = '';
            }
        }
    }

    promptLogin(action) {
        alert(`Please sign in to ${action}.`);
        // Show login screen
        if (window.authHandler) {
            window.authHandler.showLogin();
        }
    }

    requireAuth() {
        if (!window.authHandler || !window.authHandler.isAuthenticated()) {
            this.promptLogin('perform this action');
            return false;
        }
        return true;
    }

    async initializeFirestore() {
        // Check if Firebase is available - REQUIRED
        if (typeof firebase === 'undefined' || !window.firestore) {
            console.error('Firebase is required but not available. Please configure Firebase.');
            this.firestoreEnabled = false;
            this.showFirebaseError();
            return;
        }

        try {
            this.db = window.firestore;
            this.firestoreEnabled = true;
            console.log('Firestore initialized successfully');
            
            // Set up real-time listener for projects (read-only, no auth required)
            this.setupRealtimeListener();
        } catch (error) {
            console.error('Error initializing Firestore:', error);
            this.firestoreEnabled = false;
            this.showFirebaseError();
        }
    }

    showFirebaseError() {
        const statusElement = document.getElementById('storageStatusText');
        if (statusElement) {
            statusElement.textContent = '✗ Firebase Required';
            statusElement.style.color = 'var(--error-color)';
        }
        
        // Show error message in project list
        const projectList = document.getElementById('projectList');
        if (projectList) {
            projectList.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; color: #856404;">
                    <h3 style="margin-top: 0; color: #856404;">Firebase Configuration Required</h3>
                    <p>This application requires Firebase to be configured. Please:</p>
                    <ol style="text-align: left; display: inline-block;">
                        <li>Set up a Firebase project (see FIREBASE_SETUP.md)</li>
                        <li>Add your Firebase configuration to js/firebase-config.js</li>
                        <li>Enable Firestore Database in Firebase Console</li>
                        <li>Refresh this page</li>
                    </ol>
                </div>
            `;
        }
    }

    setupRealtimeListener() {
        if (!this.firestoreEnabled || !this.db) return;

        try {
            // Start with basic query (no orderBy) to avoid index issues
            // We'll sort in memory instead
            this.unsubscribe = this.db.collection(this.collectionName)
                .onSnapshot((snapshot) => {
                    if (!snapshot || !snapshot.docChanges) {
                        console.warn('Invalid snapshot in real-time listener');
                        return;
                    }

                    const changes = snapshot.docChanges();
                    let hasChanges = false;

                    changes.forEach((change) => {
                        if (change.type === 'added' || change.type === 'modified') {
                            try {
                                const project = this.convertFirestoreToProject(change.doc.data(), change.doc.id);
                                const index = this.projects.findIndex(p => p.id === change.doc.id);
                                if (index >= 0) {
                                    this.projects[index] = project;
                                } else {
                                    this.projects.push(project);
                                }
                                hasChanges = true;
                            } catch (error) {
                                console.error(`Error processing project ${change.doc.id}:`, error);
                            }
                        } else if (change.type === 'removed') {
                            this.projects = this.projects.filter(p => p.id !== change.doc.id);
                            hasChanges = true;
                        }
                    });

                    if (hasChanges || changes.length === 0) {
                        // Sort by date approved (newest first)
                        this.projects.sort((a, b) => {
                            const dateA = this.parseDate(a.dateApproved);
                            const dateB = this.parseDate(b.dateApproved);
                            return dateB - dateA;
                        });
                        this.renderProjects();
                    }
                }, (error) => {
                    console.error('Error in real-time listener:', error);
                    // Listener will continue to work, just log the error
                });
            
            console.log('Real-time listener set up successfully');
        } catch (error) {
            console.error('Error setting up real-time listener:', error);
        }
    }


    convertFirestoreToProject(data, id) {
        // Convert base64 back to ArrayBuffer for approval letter
        let approvalLetterBlob = null;
        if (data.approvalLetterBlobBase64) {
            try {
                const binaryString = atob(data.approvalLetterBlobBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                approvalLetterBlob = bytes.buffer;
            } catch (error) {
                console.error('Error converting base64 to ArrayBuffer:', error);
            }
        }

        return {
            id: id,
            homeownerName: data.homeownerName || '',
            address: data.address || '',
            lot: data.lot || '',
            projectType: data.projectType || '',
            dateApproved: data.dateApproved || '',
            dateConstructionStarted: data.dateConstructionStarted || '',
            status: data.status || 'open',
            approvalLetterBlob: approvalLetterBlob,
            approvalLetterFilename: data.approvalLetterFilename || '',
            hasApprovalLetter: data.hasApprovalLetter !== undefined ? data.hasApprovalLetter : !!approvalLetterBlob,
            depositAmountReceived: data.depositAmountReceived || null,
            dateDepositReceived: data.dateDepositReceived || '',
            depositAmountReturned: data.depositAmountReturned || null,
            dateDepositReturned: data.dateDepositReturned || ''
        };
    }

    convertProjectToFirestore(project) {
        // Check PDF size - Firestore has 1MB limit per field
        // For large PDFs, we'll need to use Firebase Storage (not implemented yet)
        let approvalLetterBlobBase64 = null;
        let approvalLetterSize = 0;
        
        if (project.approvalLetterBlob) {
            approvalLetterSize = project.approvalLetterBlob.byteLength || 0;
            const maxSize = 800000; // ~800KB to leave room (1MB = 1048576 bytes)
            
            if (approvalLetterSize <= maxSize) {
                try {
                    const bytes = new Uint8Array(project.approvalLetterBlob);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    approvalLetterBlobBase64 = btoa(binary);
                } catch (error) {
                    console.error('Error converting ArrayBuffer to base64:', error);
                }
            } else {
                console.warn(`PDF too large for Firestore (${approvalLetterSize} bytes). Maximum size is ~800KB.`);
                alert(`Warning: PDF is too large (${(approvalLetterSize / 1024).toFixed(0)}KB). Maximum size is 800KB. Please use a smaller PDF or compress it.`);
                throw new Error('PDF too large for Firestore');
            }
        }

        return {
            homeownerName: project.homeownerName || '',
            address: project.address || '',
            lot: project.lot || '',
            projectType: project.projectType || '',
            dateApproved: project.dateApproved || '',
            dateConstructionStarted: project.dateConstructionStarted || '',
            status: project.status || 'open',
            approvalLetterBlobBase64: approvalLetterBlobBase64,
            approvalLetterFilename: project.approvalLetterFilename || '',
            approvalLetterSize: approvalLetterSize,
            hasApprovalLetter: project.hasApprovalLetter !== undefined ? project.hasApprovalLetter : !!approvalLetterBlobBase64,
            depositAmountReceived: project.depositAmountReceived || null,
            dateDepositReceived: project.dateDepositReceived || '',
            depositAmountReturned: project.depositAmountReturned || null,
            dateDepositReturned: project.dateDepositReturned || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    setupAddProjectForm() {
        const toggleBtn = document.getElementById('toggleAddProjectBtn');
        const form = document.getElementById('addProjectForm');
        const cancelBtn = document.getElementById('cancelAddProjectBtn');
        const saveBtn = document.getElementById('saveProjectBtn');

        if (toggleBtn && form) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = form.style.display !== 'none';
                form.style.display = isVisible ? 'none' : 'block';
                const toggleText = document.getElementById('toggleAddProjectText');
                if (toggleText) {
                    toggleText.textContent = isVisible ? '+ Add Existing Project' : '− Hide Form';
                }
                // Set default date to today when opening and clear errors
                if (!isVisible) {
                    const dateApproved = document.getElementById('addDateApproved');
                    if (dateApproved && !dateApproved.value) {
                        const today = new Date().toISOString().split('T')[0];
                        dateApproved.value = today;
                    }
                    // Clear any existing error messages (especially for optional fields)
                    this.clearError('addApprovalLetter');
                    this.clearError('addDateApproved');
                }
            });
        }

        if (cancelBtn && form) {
            cancelBtn.addEventListener('click', () => {
                form.style.display = 'none';
                this.resetAddProjectForm();
                const toggleText = document.getElementById('toggleAddProjectText');
                if (toggleText) {
                    toggleText.textContent = '+ Add Existing Project';
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.handleAddProject();
            });
        }

        // Clear errors on input
        const formFields = form?.querySelectorAll('input, select');
        formFields?.forEach(field => {
            field.addEventListener('input', () => {
                this.clearError(field.id);
            });
            // Also clear on change for file inputs
            if (field.type === 'file') {
                field.addEventListener('change', () => {
                    this.clearError(field.id);
                });
            }
        });
        
        // Clear approval letter error on form open (since it's optional)
        const approvalLetterInput = document.getElementById('addApprovalLetter');
        if (approvalLetterInput) {
            this.clearError('addApprovalLetter');
        }

        // Handle project type dropdown change (show/hide "Other" input)
        const addProjectType = document.getElementById('addProjectType');
        const addOtherProjectTypeGroup = document.getElementById('addOtherProjectTypeGroup');
        if (addProjectType && addOtherProjectTypeGroup) {
            addProjectType.addEventListener('change', () => {
                if (addProjectType.value === 'Other') {
                    addOtherProjectTypeGroup.style.display = 'block';
                } else {
                    addOtherProjectTypeGroup.style.display = 'none';
                    const otherInput = document.getElementById('addOtherProjectType');
                    if (otherInput) otherInput.value = '';
                }
            });
        }
    }

    clearError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = '';
        }
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('error');
        }
    }

    resetAddProjectForm() {
        const form = document.getElementById('addProjectForm');
        
        // Clear all error messages first
        const errorMessages = document.querySelectorAll('#addProjectForm .error-message');
        errorMessages.forEach(msg => msg.textContent = '');
        
        // Clear specific error fields that might have been set
        this.clearError('addApprovalLetter');
        this.clearError('addDateApproved');
        this.clearError('addHomeownerName');
        
        if (form && typeof form.reset === 'function') {
            form.reset();
            // Hide "Other" project type field
            const otherProjectTypeGroup = document.getElementById('addOtherProjectTypeGroup');
            if (otherProjectTypeGroup) {
                otherProjectTypeGroup.style.display = 'none';
            }
        } else {
            // Manual reset if form.reset() doesn't work
            const inputs = document.querySelectorAll('#addProjectForm input, #addProjectForm select, #addProjectForm textarea');
            inputs.forEach(input => {
                if (input.type === 'file') {
                    input.value = '';
                } else {
                    input.value = '';
                }
            });
            // Hide "Other" project type field
            const otherProjectTypeGroup = document.getElementById('addOtherProjectTypeGroup');
            if (otherProjectTypeGroup) {
                otherProjectTypeGroup.style.display = 'none';
            }
        }
    }

    async handleAddProject() {
        // Require authentication for write operations
        if (!this.requireAuth()) {
            return;
        }

        const homeownerName = document.getElementById('addHomeownerName')?.value.trim();
        const address = document.getElementById('addAddress')?.value.trim();
        const lot = document.getElementById('addLot')?.value.trim();
        const projectTypeSelect = document.getElementById('addProjectType')?.value;
        const otherProjectType = document.getElementById('addOtherProjectType')?.value.trim();
        const projectType = projectTypeSelect === 'Other' ? otherProjectType : projectTypeSelect;
        const dateApproved = document.getElementById('addDateApproved')?.value;
        const dateConstructionStarted = document.getElementById('addDateConstructionStarted')?.value;
        const status = document.getElementById('addProjectStatus')?.value;
        const approvalLetterFile = document.getElementById('addApprovalLetter')?.files[0];
        const depositAmountReceived = document.getElementById('addDepositAmountReceived')?.value;
        const dateDepositReceived = document.getElementById('addDateDepositReceived')?.value;
        const depositAmountReturned = document.getElementById('addDepositAmountReturned')?.value;
        const dateDepositReturned = document.getElementById('addDateDepositReturned')?.value;

        // Validation
        if (!homeownerName) {
            this.showError('addHomeownerName', 'Homeowner name is required');
            return;
        }

        // Date approved is optional - use today's date if not provided
        if (!dateApproved) {
            const today = new Date();
            dateApproved = today.toISOString().split('T')[0];
        }

        // Validate project type if "Other" is selected
        if (projectTypeSelect === 'Other' && !otherProjectType) {
            this.showError('addOtherProjectType', 'Please specify the project type');
            return;
        }

        // Validate PDF if provided
        if (approvalLetterFile && approvalLetterFile.type !== 'application/pdf') {
            this.showError('addApprovalLetter', 'Please upload a PDF file');
            return;
        }

        try {
            // Read the PDF file as ArrayBuffer (if provided)
            let arrayBuffer = null;
            let approvalLetterFilename = '';
            
            if (approvalLetterFile) {
                arrayBuffer = await this.readFileAsArrayBuffer(approvalLetterFile);
                approvalLetterFilename = approvalLetterFile.name;
            }
            
            // Format dates for display
            const formattedDateApproved = this.formatDate(dateApproved);
            const formattedDateStarted = dateConstructionStarted ? this.formatDate(dateConstructionStarted) : '';
            const formattedDateDepositReceived = dateDepositReceived ? this.formatDate(dateDepositReceived) : '';
            const formattedDateDepositReturned = dateDepositReturned ? this.formatDate(dateDepositReturned) : '';

            // Create project
            const project = {
                id: Date.now().toString(),
                homeownerName: homeownerName,
                address: address || '',
                lot: lot || '',
                projectType: projectType || '',
                dateApproved: formattedDateApproved,
                dateConstructionStarted: formattedDateStarted,
                status: status || 'open',
                approvalLetterBlob: arrayBuffer,
                approvalLetterFilename: approvalLetterFilename,
                hasApprovalLetter: !!arrayBuffer, // Flag to track if letter exists
                depositAmountReceived: depositAmountReceived ? parseFloat(depositAmountReceived) : null,
                dateDepositReceived: formattedDateDepositReceived,
                depositAmountReturned: depositAmountReturned ? parseFloat(depositAmountReturned) : null,
                dateDepositReturned: formattedDateDepositReturned
            };

            if (!this.firestoreEnabled || !this.db) {
                alert('Firestore not initialized. Cannot add project. Please configure Firebase.');
                return;
            }

            try {
                const firestoreData = this.convertProjectToFirestore(project);
                const docRef = await this.db.collection(this.collectionName).add(firestoreData);
                project.id = docRef.id; // Use Firestore document ID
                this.projects.unshift(project);
                console.log('Project added to Firestore:', docRef.id);
            } catch (error) {
                console.error('Error adding project to Firestore:', error);
                alert('Error adding project: ' + (error.message || 'Unknown error'));
                throw error;
            }
            
            this.renderProjects();
            this.resetAddProjectForm();
            
            // Hide form
            const form = document.getElementById('addProjectForm');
            if (form) {
                form.style.display = 'none';
            }
            const toggleText = document.getElementById('toggleAddProjectText');
            if (toggleText) {
                toggleText.textContent = '+ Add Existing Project';
            }

            alert('Project added successfully!');
        } catch (error) {
            console.error('Error adding project:', error);
            alert('Error adding project. Please try again.');
        }
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    showError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('error');
        }
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Update active button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active content
                tabContents.forEach(content => {
                    if (content.id === `${targetTab}Tab`) {
                        content.style.display = 'block';
                        content.classList.add('active');
                    } else {
                        content.style.display = 'none';
                        content.classList.remove('active');
                    }
                });
            });
        });
    }

    setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.currentFilter = button.getAttribute('data-filter');
                this.renderProjects();
            });
        });
    }

    async loadProjects() {
        if (!this.firestoreEnabled || !this.db) {
            console.error('Cannot load projects: Firestore not initialized');
            this.projects = [];
            return;
        }

        try {
            // Try to get projects ordered by dateApproved
            let snapshot;
            try {
                snapshot = await this.db.collection(this.collectionName)
                    .orderBy('dateApproved', 'desc')
                    .get();
            } catch (orderError) {
                // If ordering fails (no index), get all and sort in memory
                console.warn('OrderBy failed (index may be needed), fetching all and sorting:', orderError.message);
                snapshot = await this.db.collection(this.collectionName).get();
            }
            
            if (snapshot && snapshot.docs) {
                this.projects = snapshot.docs.map(doc => {
                    try {
                        return this.convertFirestoreToProject(doc.data(), doc.id);
                    } catch (error) {
                        console.error(`Error converting project ${doc.id}:`, error);
                        return null;
                    }
                }).filter(p => p !== null); // Remove any failed conversions
                
                // Sort by dateApproved if we couldn't use orderBy
                if (this.projects.length > 0) {
                    this.projects.sort((a, b) => {
                        const dateA = this.parseDate(a.dateApproved);
                        const dateB = this.parseDate(b.dateApproved);
                        return dateB - dateA; // Descending order
                    });
                }
                
                console.log(`Loaded ${this.projects.length} projects from Firestore`);
            } else {
                console.warn('No snapshot or docs returned from Firestore');
                this.projects = [];
            }
        } catch (error) {
            console.error('Error loading projects from Firestore:', error);
            this.projects = [];
            alert('Error loading projects from Firestore. Please check your Firebase configuration.');
        }
    }

    parseDate(dateString) {
        if (!dateString) return new Date(0);
        // Parse MM/DD/YYYY format
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[0] - 1, parts[1]);
        }
        return new Date(dateString);
    }

    async addProject(projectData) {
        // Require authentication for write operations
        if (!this.requireAuth()) {
            throw new Error('Authentication required');
        }

        if (!this.firestoreEnabled || !this.db) {
            throw new Error('Firestore not initialized. Cannot add project.');
        }

        const project = {
            id: Date.now().toString(),
            homeownerName: projectData.ownerLastName || 'Unknown',
            address: projectData.address || '',
            lot: projectData.lot || '',
            projectType: projectData.projectType || '',
            dateApproved: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            dateConstructionStarted: '',
            status: 'open', // 'open' or 'previous'
            approvalLetterBlob: projectData.approvalLetterBlob || null,
            approvalLetterFilename: projectData.approvalLetterFilename || '',
            depositAmountReceived: null,
            dateDepositReceived: '',
            depositAmountReturned: null,
            dateDepositReturned: ''
        };

        try {
            const firestoreData = this.convertProjectToFirestore(project);
            const docRef = await this.db.collection(this.collectionName).add(firestoreData);
            project.id = docRef.id; // Use Firestore document ID
            this.projects.unshift(project);
            console.log('Project added to Firestore:', docRef.id);
            this.renderProjects();
            return project;
        } catch (error) {
            console.error('Error adding project to Firestore:', error);
            throw error; // Re-throw to let caller handle
        }
    }

    async updateProject(projectId, updates) {
        // Require authentication for write operations
        if (!this.requireAuth()) {
            throw new Error('Authentication required');
        }

        if (!this.firestoreEnabled || !this.db) {
            throw new Error('Firestore not initialized. Cannot update project.');
        }

        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        Object.assign(project, updates);

        try {
            const firestoreData = this.convertProjectToFirestore(project);
            await this.db.collection(this.collectionName).doc(projectId).update(firestoreData);
            console.log('Project updated in Firestore:', projectId);
            this.renderProjects();
        } catch (error) {
            console.error('Error updating project in Firestore:', error);
            throw error; // Re-throw to let caller handle
        }
    }

    async deleteProject(projectId) {
        // Require authentication for write operations
        if (!this.requireAuth()) {
            return;
        }

        if (!this.firestoreEnabled || !this.db) {
            alert('Firestore not initialized. Cannot delete project.');
            return;
        }

        if (confirm('Are you sure you want to delete this project?')) {
            try {
                await this.db.collection(this.collectionName).doc(projectId).delete();
                console.log('Project deleted from Firestore:', projectId);
                this.projects = this.projects.filter(p => p.id !== projectId);
                this.renderProjects();
            } catch (error) {
                console.error('Error deleting project from Firestore:', error);
                alert('Error deleting project. Please try again.');
            }
        }
    }

    getFilteredProjects() {
        if (this.currentFilter === 'all') {
            return this.projects;
        } else if (this.currentFilter === 'open') {
            return this.projects.filter(p => p.status === 'open');
        } else if (this.currentFilter === 'previous') {
            return this.projects.filter(p => p.status === 'previous');
        }
        return this.projects;
    }

    renderProjects() {
        const projectList = document.getElementById('projectList');
        const noProjects = document.getElementById('noProjects');
        
        if (!projectList) return;

        const filteredProjects = this.getFilteredProjects();

        if (filteredProjects.length === 0) {
            projectList.innerHTML = '';
            if (noProjects) {
                noProjects.style.display = 'block';
            }
            return;
        }

        if (noProjects) {
            noProjects.style.display = 'none';
        }

        const isAuthenticated = window.authHandler && window.authHandler.isAuthenticated();
        
        projectList.innerHTML = filteredProjects.map(project => {
            const editDeleteButtons = isAuthenticated ? `
                <button type="button" class="btn-small btn-secondary" onclick="window.projectManager.editProject('${project.id}')">
                    Edit
                </button>
                <button type="button" class="btn-small btn-danger" onclick="window.projectManager.deleteProject('${project.id}')">
                    Delete
                </button>
            ` : `
                <span style="color: var(--text-light); font-size: 0.85rem; font-style: italic; padding: 8px 0;">Sign in to edit or delete</span>
            `;
            
            // Check if approval letter exists
            const hasLetter = project.approvalLetterBlob || (project.hasApprovalLetter !== false && project.approvalLetterFilename);
            const downloadButton = hasLetter ? `
                <button type="button" class="btn-small btn-primary" onclick="window.projectManager.downloadLetter('${project.id}')" title="${isAuthenticated ? 'Download approval letter' : 'Sign in to download'}">
                    Download Letter
                </button>
            ` : `
                <span style="color: var(--text-light); font-size: 0.9rem; font-style: italic; padding: 8px 0;">Approval not on file</span>
            `;
            
            return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-card-header">
                    <h3>${project.homeownerName}${project.address ? ' - ' + project.address : ''}</h3>
                    <div class="project-status-badge ${project.status}">${project.status === 'open' ? 'Open' : 'Previous'}</div>
                </div>
                <div class="project-card-body">
                    <div class="project-info">
                        <div class="info-item">
                            <span class="info-label">Lot:</span>
                            <span class="info-value">${project.lot || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Project Type:</span>
                            <span class="info-value">${project.projectType || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Date Approved:</span>
                            <span class="info-value">${project.dateApproved || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Construction Started:</span>
                            <span class="info-value">
                                ${project.dateConstructionStarted || 'Not started'}
                            </span>
                        </div>
                    </div>
                    <div class="deposit-info">
                        <h4>Deposit Information</h4>
                        <div class="project-info">
                            <div class="info-item">
                                <span class="info-label">Amount Received:</span>
                                <span class="info-value">${project.depositAmountReceived ? '$' + project.depositAmountReceived.toFixed(2) : 'Not recorded'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Date Received:</span>
                                <span class="info-value">${project.dateDepositReceived || 'Not recorded'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Amount Returned:</span>
                                <span class="info-value">${project.depositAmountReturned !== null ? '$' + project.depositAmountReturned.toFixed(2) : 'Not returned'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Date Returned:</span>
                                <span class="info-value">${project.dateDepositReturned || 'Not returned'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="project-card-actions">
                    ${downloadButton}
                    ${editDeleteButtons}
                </div>
            </div>
        `;
        }).join('');
    }

    downloadLetter(projectId) {
        // Require authentication for downloading letters
        if (!this.requireAuth()) {
            return;
        }

        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            alert('Project not found.');
            return;
        }

        // Check if approval letter exists
        if (!project.approvalLetterBlob) {
            if (project.hasApprovalLetter === false) {
                alert('Approval not on file for this project.');
            } else {
                alert('Approval letter not available for this project.');
            }
            return;
        }

        try {
            const blob = new Blob([project.approvalLetterBlob], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = project.approvalLetterFilename || `approval-letter-${project.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading letter:', error);
            alert('Error downloading approval letter.');
        }
    }

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // Create edit form HTML
        const editForm = `
            <div style="padding: 20px;">
                <h3>Edit Project: ${project.homeownerName}</h3>
                <div style="margin-bottom: 15px;">
                    <label>Construction Start Date (MM/DD/YYYY):</label><br>
                    <input type="text" id="editDateStarted" value="${project.dateConstructionStarted || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Status:</label><br>
                    <select id="editStatus" style="width: 100%; padding: 8px; margin-top: 5px;">
                        <option value="open" ${project.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="previous" ${project.status === 'previous' ? 'selected' : ''}>Previous</option>
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Deposit Amount Received ($):</label><br>
                    <input type="number" id="editDepositReceived" value="${project.depositAmountReceived || ''}" step="0.01" min="0" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Date Deposit Received (MM/DD/YYYY):</label><br>
                    <input type="text" id="editDateDepositReceived" value="${project.dateDepositReceived || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Deposit Amount Returned ($):</label><br>
                    <input type="number" id="editDepositReturned" value="${project.depositAmountReturned !== null ? project.depositAmountReturned : ''}" step="0.01" min="0" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Date Deposit Returned (MM/DD/YYYY):</label><br>
                    <input type="text" id="editDateDepositReturned" value="${project.dateDepositReturned || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
            </div>
        `;

        // Show form in a dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        dialog.innerHTML = `
            <div style="background: white; padding: 0; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                ${editForm}
                <div style="padding: 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="editCancelBtn" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button id="editSaveBtn" style="padding: 10px 20px; background: #2c5530; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Handle save
        document.getElementById('editSaveBtn').addEventListener('click', () => {
            const dateStarted = document.getElementById('editDateStarted').value.trim();
            const status = document.getElementById('editStatus').value;
            const depositReceived = document.getElementById('editDepositReceived').value.trim();
            const dateDepositReceived = document.getElementById('editDateDepositReceived').value.trim();
            const depositReturned = document.getElementById('editDepositReturned').value.trim();
            const dateDepositReturned = document.getElementById('editDateDepositReturned').value.trim();

            this.updateProject(projectId, {
                dateConstructionStarted: dateStarted,
                status: status,
                depositAmountReceived: depositReceived ? parseFloat(depositReceived) : null,
                dateDepositReceived: dateDepositReceived,
                depositAmountReturned: depositReturned ? parseFloat(depositReturned) : null,
                dateDepositReturned: dateDepositReturned
            });

            document.body.removeChild(dialog);
        });

        // Handle cancel
        document.getElementById('editCancelBtn').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }
}

// Initialize project manager
window.projectManager = new ProjectManager();

