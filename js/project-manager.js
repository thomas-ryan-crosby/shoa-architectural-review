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
        
        // Note: Real-time listener in initializeFirestore() will handle initial load
        // No need to call loadProjects() separately - the listener will populate projects
        
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
        if (!this.firestoreEnabled || !this.db) {
            console.error('Cannot set up real-time listener: Firestore not enabled or db not available');
            return;
        }

        try {
            console.log('Setting up real-time listener for collection:', this.collectionName);
            
            // Start with basic query (no orderBy) to avoid index issues
            // We'll sort in memory instead
            this.unsubscribe = this.db.collection(this.collectionName)
                .onSnapshot(async (snapshot) => {
                    console.log('Real-time listener snapshot received');
                    
                    if (!snapshot) {
                        console.warn('Invalid snapshot in real-time listener');
                        return;
                    }

                    // Check if this is the initial snapshot (all docs will be "added")
                    const isInitialLoad = this.projects.length === 0;
                    const changes = snapshot.docChanges();
                    const allDocs = snapshot.docs || [];
                    
                    console.log(`Snapshot: ${allDocs.length} total docs, ${changes.length} changes, isInitialLoad: ${isInitialLoad}`);
                    
                    let hasChanges = false;

                    // On initial load, process all documents from snapshot.docs
                    // For subsequent updates, use docChanges()
                    const docsToProcess = isInitialLoad ? allDocs : changes.map(c => c.doc);
                    
                    if (isInitialLoad && allDocs.length > 0) {
                        console.log(`Processing ${allDocs.length} documents on initial load`);
                    }

                    // Process documents asynchronously
                    for (const doc of docsToProcess) {
                        try {
                            const data = doc.data();
                            const docId = doc.id;
                            const project = await this.convertFirestoreToProject(data, docId);
                            
                            const index = this.projects.findIndex(p => p.id === docId);
                            if (index >= 0) {
                                this.projects[index] = project;
                                console.log(`Updated project: ${project.homeownerName} (${docId})`);
                            } else {
                                this.projects.push(project);
                                console.log(`Added project: ${project.homeownerName} (${docId})`);
                            }
                            hasChanges = true;
                        } catch (error) {
                            console.error(`Error processing project ${doc.id}:`, error);
                        }
                    }
                    
                    // Process removals from changes
                    for (const change of changes) {
                        if (change.type === 'removed') {
                            this.projects = this.projects.filter(p => p.id !== change.doc.id);
                            hasChanges = true;
                            console.log(`Removed project: ${change.doc.id}`);
                        }
                    }
                    
                    // Always render on initial load (even if no projects) or if we have changes
                    if (hasChanges || isInitialLoad) {
                        // Sort by date approved (newest first)
                        this.projects.sort((a, b) => {
                            const dateA = this.parseDate(a.dateApproved);
                            const dateB = this.parseDate(b.dateApproved);
                            return dateB - dateA; // Descending order
                        });
                        
                        console.log(`Rendering ${this.projects.length} projects (initial load: ${isInitialLoad}, hasChanges: ${hasChanges})`);
                        this.renderProjects();
                        this.updateStorageStatus();
                    }
                }, (error) => {
                    console.error('Error in real-time listener:', error);
                    this.updateStorageStatus();
                    // Listener will continue to work, just log the error
                });
            
            console.log('Real-time listener set up successfully');
        } catch (error) {
            console.error('Error setting up real-time listener:', error);
            this.updateStorageStatus();
        }
    }


    async convertFirestoreToProject(data, id) {
        // Load approval letter from Firebase Storage or base64 (for backward compatibility)
        let approvalLetterBlob = null;
        let approvalLetterStorageUrl = null;
        
        if (data.approvalLetterStorageUrl) {
            // New method: Store URL, download on-demand
            approvalLetterStorageUrl = data.approvalLetterStorageUrl;
            // Don't download immediately - download when needed (in downloadLetter)
        } else if (data.approvalLetterBlobBase64) {
            // Legacy method: Convert base64 back to ArrayBuffer (for old projects)
            try {
                const binaryString = atob(data.approvalLetterBlobBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                approvalLetterBlob = bytes.buffer;
                console.log('PDF loaded from base64 (legacy)');
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
            approvalLetterStorageUrl: approvalLetterStorageUrl,
            approvalLetterFilename: data.approvalLetterFilename || '',
            hasApprovalLetter: data.hasApprovalLetter !== undefined ? data.hasApprovalLetter : (!!approvalLetterBlob || !!approvalLetterStorageUrl),
            noApprovalOnRecord: data.noApprovalOnRecord || false,
            depositAmountReceived: data.depositAmountReceived || null,
            dateDepositReceived: data.dateDepositReceived || '',
            depositAmountReturned: data.depositAmountReturned || null,
            dateDepositReturned: data.dateDepositReturned || ''
        };
    }

    async convertProjectToFirestore(project) {
        // Use Firebase Storage for PDFs (supports files up to 5GB)
        let approvalLetterStorageUrl = null;
        let approvalLetterSize = 0;
        
        if (project.approvalLetterBlob) {
            approvalLetterSize = project.approvalLetterBlob.byteLength || 0;
            
            // Upload to Firebase Storage
            try {
                const storage = window.firebaseStorage;
                if (!storage) {
                    throw new Error('Firebase Storage not available');
                }
                
                // Generate unique filename
                const timestamp = Date.now();
                const filename = project.approvalLetterFilename || `approval-letter-${timestamp}.pdf`;
                const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `approval-letters/${project.id || timestamp}/${sanitizedFilename}`;
                
                // Create storage reference
                const storageRef = storage.ref().child(storagePath);
                
                // Upload the blob
                const uploadTask = storageRef.put(new Blob([project.approvalLetterBlob], { type: 'application/pdf' }));
                
                // Wait for upload to complete
                const snapshot = await new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            // Progress tracking (optional)
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log(`Upload progress: ${progress.toFixed(0)}%`);
                        },
                        (error) => {
                            console.error('Upload error:', error);
                            reject(error);
                        },
                        () => {
                            resolve(uploadTask.snapshot);
                        }
                    );
                });
                
                // Get download URL
                approvalLetterStorageUrl = await snapshot.ref.getDownloadURL();
                console.log('PDF uploaded to Firebase Storage:', approvalLetterStorageUrl);
                
            } catch (error) {
                console.error('Error uploading PDF to Firebase Storage:', error);
                throw new Error(`Failed to upload PDF: ${error.message}`);
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
            approvalLetterStorageUrl: approvalLetterStorageUrl, // URL from Firebase Storage
            approvalLetterFilename: project.approvalLetterFilename || '',
            approvalLetterSize: approvalLetterSize,
            hasApprovalLetter: project.hasApprovalLetter !== undefined ? project.hasApprovalLetter : !!approvalLetterStorageUrl,
            noApprovalOnRecord: project.noApprovalOnRecord || false,
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

        // Handle "No Approval on Record" checkbox
        const noApprovalCheckbox = document.getElementById('noApprovalOnRecord');
        const dateApprovedInput = document.getElementById('addDateApproved');
        if (noApprovalCheckbox && dateApprovedInput) {
            noApprovalCheckbox.addEventListener('change', () => {
                if (noApprovalCheckbox.checked) {
                    dateApprovedInput.disabled = true;
                    dateApprovedInput.value = '';
                } else {
                    dateApprovedInput.disabled = false;
                }
            });
            // Also disable date input when checkbox is checked on load
            if (noApprovalCheckbox.checked) {
                dateApprovedInput.disabled = true;
            }
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
        
        // Reset "No Approval on Record" checkbox and enable date input
        const noApprovalCheckbox = document.getElementById('noApprovalOnRecord');
        const dateApprovedInput = document.getElementById('addDateApproved');
        if (noApprovalCheckbox) {
            noApprovalCheckbox.checked = false;
        }
        if (dateApprovedInput) {
            dateApprovedInput.disabled = false;
        }
        
        if (form && typeof form.reset === 'function') {
            form.reset();
            // Hide "Other" project type field
            const otherProjectTypeGroup = document.getElementById('addOtherProjectTypeGroup');
            if (otherProjectTypeGroup) {
                otherProjectTypeGroup.style.display = 'none';
            }
            // Re-enable date input after reset
            if (dateApprovedInput) {
                dateApprovedInput.disabled = false;
            }
        } else {
            // Manual reset if form.reset() doesn't work
            const inputs = document.querySelectorAll('#addProjectForm input, #addProjectForm select, #addProjectForm textarea');
            inputs.forEach(input => {
                if (input.type === 'file') {
                    input.value = '';
                } else if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
            // Hide "Other" project type field
            const otherProjectTypeGroup = document.getElementById('addOtherProjectTypeGroup');
            if (otherProjectTypeGroup) {
                otherProjectTypeGroup.style.display = 'none';
            }
            // Re-enable date input after reset
            if (dateApprovedInput) {
                dateApprovedInput.disabled = false;
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
        const noApprovalOnRecord = document.getElementById('noApprovalOnRecord')?.checked;
        const dateApproved = noApprovalOnRecord ? null : document.getElementById('addDateApproved')?.value;
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

        // Date approved handling
        let formattedDateApproved = '';
        if (noApprovalOnRecord) {
            formattedDateApproved = 'No Approval on Record';
        } else if (dateApproved) {
            formattedDateApproved = this.formatDate(dateApproved);
        } else {
            // Use today's date if not provided and not marked as "No Approval on Record"
            const today = new Date();
            formattedDateApproved = this.formatDate(today.toISOString().split('T')[0]);
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
                noApprovalOnRecord: noApprovalOnRecord || false,
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
                // Show loading indicator for PDF upload
                if (project.approvalLetterBlob) {
                    const loadingMsg = document.createElement('div');
                    loadingMsg.id = 'pdfUploadLoading';
                    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;';
                    loadingMsg.innerHTML = '<p>Uploading PDF to storage...</p><div style="text-align: center;"><div class="spinner-large"></div></div>';
                    document.body.appendChild(loadingMsg);
                }

                const firestoreData = await this.convertProjectToFirestore(project);
                const docRef = await this.db.collection(this.collectionName).add(firestoreData);
                project.id = docRef.id; // Use Firestore document ID
                
                // Update project with storage URL for display
                if (firestoreData.approvalLetterStorageUrl) {
                    project.approvalLetterStorageUrl = firestoreData.approvalLetterStorageUrl;
                }
                
                this.projects.unshift(project);
                console.log('Project added to Firestore:', docRef.id);
                
                // Remove loading indicator
                const loadingMsg = document.getElementById('pdfUploadLoading');
                if (loadingMsg) {
                    loadingMsg.remove();
                }
            } catch (error) {
                console.error('Error adding project to Firestore:', error);
                
                // Remove loading indicator on error
                const loadingMsg = document.getElementById('pdfUploadLoading');
                if (loadingMsg) {
                    loadingMsg.remove();
                }
                
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
                console.log(`Found ${snapshot.docs.length} documents in Firestore`);
                
                // Convert all projects (async conversion for Storage URLs)
                const projectPromises = snapshot.docs.map(async (doc) => {
                    try {
                        const project = await this.convertFirestoreToProject(doc.data(), doc.id);
                        console.log(`Converted project: ${project.homeownerName} (${doc.id})`);
                        return project;
                    } catch (error) {
                        console.error(`Error converting project ${doc.id}:`, error);
                        return null;
                    }
                });
                
                this.projects = (await Promise.all(projectPromises)).filter(p => p !== null);
                console.log(`Successfully converted ${this.projects.length} projects`);
                
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
            
            // Check if approval letter exists (either in memory, Storage URL, or legacy base64)
            const hasLetter = project.approvalLetterBlob || project.approvalLetterStorageUrl || (project.hasApprovalLetter !== false && project.approvalLetterFilename);
            const downloadButton = hasLetter ? `
                <button type="button" class="btn-small btn-primary" onclick="window.projectManager.downloadLetter('${project.id}')" title="${isAuthenticated ? 'Download approval letter' : 'Sign in to download'}">
                    Download Letter
                </button>
            ` : `
                <span style="color: #d32f2f; font-size: 0.9rem; font-weight: bold; padding: 8px 0;">Approval not on file</span>
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
                            <span class="info-value" ${project.noApprovalOnRecord || (!project.dateApproved && !project.approvalLetterBlob && project.hasApprovalLetter === false) ? 'style="color: #d32f2f; font-weight: bold;"' : ''}>
                                ${project.noApprovalOnRecord ? 'No Approval on Record' : (project.dateApproved || 'N/A')}
                            </span>
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

    async downloadLetter(projectId) {
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
        if (!project.approvalLetterBlob && !project.approvalLetterStorageUrl) {
            if (project.hasApprovalLetter === false) {
                alert('Approval not on file for this project.');
            } else {
                alert('Approval letter not available for this project.');
            }
            return;
        }

        try {
            let blob;
            
            if (project.approvalLetterBlob) {
                // Use in-memory blob (legacy base64)
                blob = new Blob([project.approvalLetterBlob], { type: 'application/pdf' });
            } else if (project.approvalLetterStorageUrl) {
                // Download from Firebase Storage
                const response = await fetch(project.approvalLetterStorageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download: ${response.statusText}`);
                }
                blob = await response.blob();
            } else {
                throw new Error('No approval letter available');
            }
            
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
            alert('Error downloading approval letter: ' + (error.message || 'Unknown error'));
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

