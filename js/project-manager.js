// Project Manager - Handles project tracking and storage

class ProjectManager {
    constructor() {
        this.storageKey = 'shoa_projects';
        this.projects = [];
        this.currentFilter = 'all';
        this.firestoreEnabled = false;
        this.collectionName = 'projects';
        this.init();
    }

    async init() {
        // Setup tab switching
        this.setupTabs();
        
        // Setup filters
        this.setupFilters();
        
        // Setup add project form
        this.setupAddProjectForm();
        
        // Initialize Firebase/Firestore
        await this.initializeFirestore();
        
        // Load projects (from Firestore or localStorage fallback)
        await this.loadProjects();
        
        // Render projects
        this.renderProjects();
    }

    async initializeFirestore() {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !window.firestore) {
            console.warn('Firebase not available, using localStorage fallback');
            this.firestoreEnabled = false;
            return;
        }

        try {
            this.db = window.firestore;
            this.firestoreEnabled = true;
            console.log('Firestore initialized successfully');
            
            // Set up real-time listener for projects
            this.setupRealtimeListener();
        } catch (error) {
            console.error('Error initializing Firestore:', error);
            this.firestoreEnabled = false;
        }
    }

    setupRealtimeListener() {
        if (!this.firestoreEnabled || !this.db) return;

        try {
            // Try with orderBy, fallback to without if index doesn't exist
            let query = this.db.collection(this.collectionName);
            
            try {
                query = query.orderBy('dateApproved', 'desc');
            } catch (error) {
                console.warn('OrderBy not available, using basic query:', error);
            }

            this.unsubscribe = query.onSnapshot((snapshot) => {
                const changes = snapshot.docChanges();
                changes.forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const project = this.convertFirestoreToProject(change.doc.data(), change.doc.id);
                        const index = this.projects.findIndex(p => p.id === change.doc.id);
                        if (index >= 0) {
                            this.projects[index] = project;
                        } else {
                            this.projects.push(project);
                        }
                    } else if (change.type === 'removed') {
                        this.projects = this.projects.filter(p => p.id !== change.doc.id);
                    }
                });
                // Sort by date approved (newest first)
                this.projects.sort((a, b) => {
                    const dateA = this.parseDate(a.dateApproved);
                    const dateB = this.parseDate(b.dateApproved);
                    return dateB - dateA;
                });
                this.renderProjects();
            }, (error) => {
                console.error('Error in real-time listener:', error);
                // If orderBy fails, try without it
                if (error.code === 'failed-precondition') {
                    console.log('Retrying without orderBy...');
                    this.setupRealtimeListenerWithoutOrderBy();
                }
            });
        } catch (error) {
            console.error('Error setting up real-time listener:', error);
            // Fallback to listener without orderBy
            this.setupRealtimeListenerWithoutOrderBy();
        }
    }

    setupRealtimeListenerWithoutOrderBy() {
        if (!this.firestoreEnabled || !this.db) return;

        try {
            this.unsubscribe = this.db.collection(this.collectionName)
                .onSnapshot((snapshot) => {
                    const changes = snapshot.docChanges();
                    changes.forEach((change) => {
                        if (change.type === 'added' || change.type === 'modified') {
                            const project = this.convertFirestoreToProject(change.doc.data(), change.doc.id);
                            const index = this.projects.findIndex(p => p.id === change.doc.id);
                            if (index >= 0) {
                                this.projects[index] = project;
                            } else {
                                this.projects.push(project);
                            }
                        } else if (change.type === 'removed') {
                            this.projects = this.projects.filter(p => p.id !== change.doc.id);
                        }
                    });
                    // Sort by date approved (newest first)
                    this.projects.sort((a, b) => {
                        const dateA = this.parseDate(a.dateApproved);
                        const dateB = this.parseDate(b.dateApproved);
                        return dateB - dateA;
                    });
                    this.renderProjects();
                }, (error) => {
                    console.error('Error in real-time listener (fallback):', error);
                });
        } catch (error) {
            console.error('Error setting up fallback real-time listener:', error);
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
        } else if (data.hasLargePdf) {
            // For large PDFs, try to get from localStorage as fallback
            const localStorageKey = `project_pdf_${id}`;
            const storedBase64 = localStorage.getItem(localStorageKey);
            if (storedBase64) {
                try {
                    const binaryString = atob(storedBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    approvalLetterBlob = bytes.buffer;
                    console.log('Large PDF loaded from localStorage');
                } catch (error) {
                    console.error('Error loading large PDF from localStorage:', error);
                }
            } else {
                console.warn('Large PDF detected but not found in localStorage for project:', id);
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
            depositAmountReceived: data.depositAmountReceived || null,
            dateDepositReceived: data.dateDepositReceived || '',
            depositAmountReturned: data.depositAmountReturned || null,
            dateDepositReturned: data.dateDepositReturned || ''
        };
    }

    convertProjectToFirestore(project) {
        // Check PDF size - Firestore has 1MB limit per field
        // For large PDFs, we'll store a reference and keep the blob in localStorage
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
                console.warn(`PDF too large for Firestore (${approvalLetterSize} bytes). Storing reference only.`);
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
            approvalLetterBlobBase64: approvalLetterBlobBase64, // null if too large
            approvalLetterFilename: project.approvalLetterFilename || '',
            approvalLetterSize: approvalLetterSize,
            hasLargePdf: approvalLetterSize > 800000, // Flag for large PDFs
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
                // Set default date to today when opening
                if (!isVisible) {
                    const dateApproved = document.getElementById('addDateApproved');
                    if (dateApproved && !dateApproved.value) {
                        const today = new Date().toISOString().split('T')[0];
                        dateApproved.value = today;
                    }
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
        });
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
        if (form && typeof form.reset === 'function') {
            form.reset();
            // Clear error messages
            const errorMessages = form.querySelectorAll('.error-message');
            errorMessages.forEach(msg => msg.textContent = '');
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
            const errorMessages = document.querySelectorAll('#addProjectForm .error-message');
            errorMessages.forEach(msg => msg.textContent = '');
        }
    }

    async handleAddProject() {
        const homeownerName = document.getElementById('addHomeownerName')?.value.trim();
        const address = document.getElementById('addAddress')?.value.trim();
        const lot = document.getElementById('addLot')?.value.trim();
        const projectType = document.getElementById('addProjectType')?.value.trim();
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

        if (!dateApproved) {
            this.showError('addDateApproved', 'Date approved is required');
            return;
        }

        if (!approvalLetterFile) {
            this.showError('addApprovalLetter', 'Approval letter PDF is required');
            return;
        }

        if (approvalLetterFile.type !== 'application/pdf') {
            this.showError('addApprovalLetter', 'Please upload a PDF file');
            return;
        }

        try {
            // Read the PDF file as ArrayBuffer
            const arrayBuffer = await this.readFileAsArrayBuffer(approvalLetterFile);
            
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
                approvalLetterFilename: approvalLetterFile.name,
                depositAmountReceived: depositAmountReceived ? parseFloat(depositAmountReceived) : null,
                dateDepositReceived: formattedDateDepositReceived,
                depositAmountReturned: depositAmountReturned ? parseFloat(depositAmountReturned) : null,
                dateDepositReturned: formattedDateDepositReturned
            };

            if (this.firestoreEnabled && this.db) {
                try {
                    const firestoreData = this.convertProjectToFirestore(project);
                    const docRef = await this.db.collection(this.collectionName).add(firestoreData);
                    project.id = docRef.id; // Use Firestore document ID
                    
                    // If PDF is too large for Firestore, store it in localStorage as fallback
                    if (project.approvalLetterBlob && project.approvalLetterBlob.byteLength > 800000) {
                        const localStorageKey = `project_pdf_${project.id}`;
                        try {
                            // Convert ArrayBuffer to base64 for localStorage
                            const bytes = new Uint8Array(project.approvalLetterBlob);
                            let binary = '';
                            for (let i = 0; i < bytes.length; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            const base64 = btoa(binary);
                            localStorage.setItem(localStorageKey, base64);
                            console.log('Large PDF stored in localStorage as fallback');
                        } catch (storageError) {
                            console.error('Error storing large PDF in localStorage:', storageError);
                        }
                    }
                    
                    this.projects.unshift(project);
                    console.log('Project added to Firestore:', docRef.id);
                } catch (error) {
                    console.error('Error adding project to Firestore:', error);
                    // Fallback to localStorage
                    this.projects.unshift(project);
                    this.saveProjects();
                }
            } else {
                this.projects.unshift(project);
                this.saveProjects();
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
        if (this.firestoreEnabled && this.db) {
            try {
                // Try to get projects ordered by dateApproved
                let snapshot;
                try {
                    snapshot = await this.db.collection(this.collectionName)
                        .orderBy('dateApproved', 'desc')
                        .get();
                } catch (orderError) {
                    // If ordering fails (no index), get all and sort in memory
                    console.warn('OrderBy failed, fetching all and sorting:', orderError);
                    snapshot = await this.db.collection(this.collectionName).get();
                }
                
                this.projects = snapshot.docs.map(doc => 
                    this.convertFirestoreToProject(doc.data(), doc.id)
                );
                
                // Sort by dateApproved if we couldn't use orderBy
                this.projects.sort((a, b) => {
                    const dateA = this.parseDate(a.dateApproved);
                    const dateB = this.parseDate(b.dateApproved);
                    return dateB - dateA; // Descending order
                });
                
                console.log(`Loaded ${this.projects.length} projects from Firestore`);
            } catch (error) {
                console.error('Error loading projects from Firestore:', error);
                // Fallback to localStorage
                this.loadProjectsFromLocalStorage();
            }
        } else {
            // Fallback to localStorage
            this.loadProjectsFromLocalStorage();
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

    loadProjectsFromLocalStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.projects = stored ? JSON.parse(stored) : [];
            console.log(`Loaded ${this.projects.length} projects from localStorage`);
        } catch (error) {
            console.error('Error loading projects from localStorage:', error);
            this.projects = [];
        }
    }

    async saveProjects() {
        // Save to Firestore if enabled
        if (this.firestoreEnabled && this.db) {
            // Note: Individual project saves are handled in addProject/updateProject/deleteProject
            // This method is kept for backward compatibility
            return;
        }
        
        // Fallback to localStorage
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.projects));
        } catch (error) {
            console.error('Error saving projects to localStorage:', error);
        }
    }

    async addProject(projectData) {
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

        if (this.firestoreEnabled && this.db) {
            try {
                const firestoreData = this.convertProjectToFirestore(project);
                const docRef = await this.db.collection(this.collectionName).add(firestoreData);
                project.id = docRef.id; // Use Firestore document ID
                this.projects.unshift(project);
                console.log('Project added to Firestore:', docRef.id);
            } catch (error) {
                console.error('Error adding project to Firestore:', error);
                // Fallback to localStorage
                this.projects.unshift(project);
                this.saveProjects();
            }
        } else {
            this.projects.unshift(project);
            this.saveProjects();
        }
        
        this.renderProjects();
        return project;
    }

    async updateProject(projectId, updates) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        Object.assign(project, updates);

        if (this.firestoreEnabled && this.db) {
            try {
                const firestoreData = this.convertProjectToFirestore(project);
                await this.db.collection(this.collectionName).doc(projectId).update(firestoreData);
                console.log('Project updated in Firestore:', projectId);
            } catch (error) {
                console.error('Error updating project in Firestore:', error);
                // Fallback to localStorage
                this.saveProjects();
            }
        } else {
            this.saveProjects();
        }
        
        this.renderProjects();
    }

    async deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project?')) {
            if (this.firestoreEnabled && this.db) {
                try {
                    await this.db.collection(this.collectionName).doc(projectId).delete();
                    console.log('Project deleted from Firestore:', projectId);
                } catch (error) {
                    console.error('Error deleting project from Firestore:', error);
                    // Fallback to localStorage
                    this.projects = this.projects.filter(p => p.id !== projectId);
                    this.saveProjects();
                }
            } else {
                this.projects = this.projects.filter(p => p.id !== projectId);
                this.saveProjects();
            }
            
            this.renderProjects();
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

        projectList.innerHTML = filteredProjects.map(project => `
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
                    <button type="button" class="btn-small btn-primary" onclick="window.projectManager.downloadLetter('${project.id}')">
                        Download Letter
                    </button>
                    <button type="button" class="btn-small btn-secondary" onclick="window.projectManager.editProject('${project.id}')">
                        Edit
                    </button>
                    <button type="button" class="btn-small btn-danger" onclick="window.projectManager.deleteProject('${project.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    downloadLetter(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project || !project.approvalLetterBlob) {
            alert('Approval letter not available for this project.');
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

