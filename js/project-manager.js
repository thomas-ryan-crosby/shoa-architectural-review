// Project Manager - Handles project tracking and storage

class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentFilter = 'all';
        this.viewMode = 'compact'; // 'detailed' or 'compact' - compact is default
        this.firestoreEnabled = false;
        this.collectionName = 'projects';
        this.init();
    }

    async init() {
        // Initialize UI components (no auth required for viewing)
        this.setupFilters();
        this.setupViewToggle();
        this.setupAddProjectForm();
        this.setupFilePreviewDelegation();
        
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
                // Not authenticated - show sign in prompt
                addProjectBtn.innerHTML = 'Sign In to Add Project';
                // Remove existing listeners and add new one
                const newBtn = addProjectBtn.cloneNode(true);
                addProjectBtn.parentNode.replaceChild(newBtn, addProjectBtn);
                newBtn.addEventListener('click', () => this.promptLogin('add project'));
            } else {
                // User is authenticated - restore button with span and toggle functionality
                addProjectBtn.innerHTML = '<span id="toggleAddProjectText">+ Add Existing Project</span>';
                // Remove existing listeners and restore toggle functionality
                const newBtn = addProjectBtn.cloneNode(true);
                addProjectBtn.parentNode.replaceChild(newBtn, addProjectBtn);
                const form = document.getElementById('addProjectForm');
                if (form) {
                    newBtn.addEventListener('click', () => {
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
                            // Clear any existing error messages
                            this.clearError('addApprovalLetter');
                            this.clearError('addDateApproved');
                        }
                    });
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

    updateStorageStatus() {
        const statusElement = document.getElementById('storageStatusText');
        if (!statusElement) return;
        
        if (!this.firestoreEnabled) {
            statusElement.textContent = '✗ Firebase Required';
            statusElement.style.color = 'var(--error-color)';
            return;
        }
        
        if (this.projects.length === 0) {
            statusElement.textContent = 'Loading...';
            statusElement.style.color = 'var(--text-light)';
        } else {
            statusElement.textContent = `✓ ${this.projects.length} project${this.projects.length === 1 ? '' : 's'}`;
            statusElement.style.color = 'var(--success-color, #4caf50)';
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
            contractorName: data.contractorName || '',
            approvedBy: data.approvedBy || '',
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
            dateDepositReturned: data.dateDepositReturned || '',
            depositWaived: data.depositWaived || false,
            depositWaiverReason: data.depositWaiverReason || '',
            reviewComments: data.reviewComments || '',
            approvalReason: data.approvalReason || '',
            siteConditionsFiles: (data.siteConditionsFiles || []).map(file => ({
                name: file.name || file,
                type: file.type || '',
                storageUrl: file.storageUrl || null
            })),
            submittedPlansFiles: (data.submittedPlansFiles || []).map(file => ({
                name: file.name || file,
                type: file.type || '',
                storageUrl: file.storageUrl || null
            }))
        };
    }

    async uploadFileToStorage(fileData, fileName, fileType, projectId, folder) {
        const storage = window.firebaseStorage;
        if (!storage) {
            throw new Error('Firebase Storage not available');
        }
        
        // Generate unique filename
        const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${folder}/${projectId}/${sanitizedFilename}`;
        
        // Create storage reference
        const storageRef = storage.ref().child(storagePath);
        
        // Determine MIME type
        let mimeType = fileType;
        if (!mimeType) {
            if (fileName.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
            else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
            else if (fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            else if (fileName.toLowerCase().match(/\.(doc|docx)$/i)) mimeType = 'application/msword';
            else mimeType = 'application/octet-stream';
        }
        
        // Create blob from data
        const blob = new Blob([fileData], { type: mimeType });
        
        // Upload the blob
        const uploadTask = storageRef.put(blob);
        
        // Wait for upload to complete
        const snapshot = await new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    // Progress tracking (optional)
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload progress for ${fileName}: ${progress.toFixed(0)}%`);
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
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log(`File uploaded to Firebase Storage: ${fileName} -> ${downloadURL}`);
        return downloadURL;
    }

    async convertProjectToFirestore(project) {
        // Use Firebase Storage for all files (supports files up to 5GB)
        let approvalLetterStorageUrl = null;
        let approvalLetterSize = 0;
        
        if (project.approvalLetterBlob) {
            approvalLetterSize = project.approvalLetterBlob.byteLength || 0;
            
            // Upload to Firebase Storage
            try {
                const filename = project.approvalLetterFilename || `approval-letter-${Date.now()}.pdf`;
                approvalLetterStorageUrl = await this.uploadFileToStorage(
                    project.approvalLetterBlob,
                    filename,
                    'application/pdf',
                    project.id || Date.now().toString(),
                    'approval-letters'
                );
            } catch (error) {
                console.error('Error uploading PDF to Firebase Storage:', error);
                throw new Error(`Failed to upload PDF: ${error.message}`);
            }
        }

        // Upload site conditions files to Firebase Storage
        const siteConditionsFilesWithUrls = [];
        if (project.siteConditionsFiles && project.siteConditionsFiles.length > 0) {
            for (const file of project.siteConditionsFiles) {
                if (file.data && (file.data instanceof ArrayBuffer || file.data instanceof Uint8Array)) {
                    try {
                        const fileData = file.data instanceof ArrayBuffer ? file.data : file.data.buffer;
                        const fileName = file.name || `site-condition-${Date.now()}.png`;
                        const storageUrl = await this.uploadFileToStorage(
                            fileData,
                            fileName,
                            file.type,
                            project.id || Date.now().toString(),
                            'site-conditions'
                        );
                        siteConditionsFilesWithUrls.push({
                            name: file.name || fileName,
                            type: file.type || '',
                            storageUrl: storageUrl
                        });
                    } catch (error) {
                        console.error('Error uploading site conditions file:', error);
                        // Continue with other files even if one fails
                        siteConditionsFilesWithUrls.push({
                            name: file.name || file,
                            type: file.type || ''
                        });
                    }
                } else if (file.storageUrl) {
                    // Already has a storage URL, keep it
                    siteConditionsFilesWithUrls.push({
                        name: file.name || file,
                        type: file.type || '',
                        storageUrl: file.storageUrl
                    });
                } else {
                    // No data, just metadata
                    siteConditionsFilesWithUrls.push({
                        name: file.name || file,
                        type: file.type || ''
                    });
                }
            }
        }

        // Upload submitted plans files to Firebase Storage
        const submittedPlansFilesWithUrls = [];
        if (project.submittedPlansFiles && project.submittedPlansFiles.length > 0) {
            for (const file of project.submittedPlansFiles) {
                if (file.data && (file.data instanceof ArrayBuffer || file.data instanceof Uint8Array)) {
                    try {
                        const fileData = file.data instanceof ArrayBuffer ? file.data : file.data.buffer;
                        const fileName = file.name || `submitted-plan-${Date.now()}.pdf`;
                        const storageUrl = await this.uploadFileToStorage(
                            fileData,
                            fileName,
                            file.type,
                            project.id || Date.now().toString(),
                            'submitted-plans'
                        );
                        submittedPlansFilesWithUrls.push({
                            name: file.name || fileName,
                            type: file.type || '',
                            storageUrl: storageUrl
                        });
                    } catch (error) {
                        console.error('Error uploading submitted plans file:', error);
                        // Continue with other files even if one fails
                        submittedPlansFilesWithUrls.push({
                            name: file.name || file,
                            type: file.type || ''
                        });
                    }
                } else if (file.storageUrl) {
                    // Already has a storage URL, keep it
                    submittedPlansFilesWithUrls.push({
                        name: file.name || file,
                        type: file.type || '',
                        storageUrl: file.storageUrl
                    });
                } else {
                    // No data, just metadata
                    submittedPlansFilesWithUrls.push({
                        name: file.name || file,
                        type: file.type || ''
                    });
                }
            }
        }

        return {
            homeownerName: project.homeownerName || '',
            address: project.address || '',
            lot: project.lot || '',
            projectType: project.projectType || '',
            contractorName: project.contractorName || '',
            approvedBy: project.approvedBy || '',
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
            depositWaived: project.depositWaived || false,
            depositWaiverReason: project.depositWaiverReason || '',
            reviewComments: project.reviewComments || '',
            approvalReason: project.approvalReason || '',
            siteConditionsFiles: siteConditionsFilesWithUrls,
            submittedPlansFiles: submittedPlansFilesWithUrls,
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

        // Handle "Deposit Waived" checkbox
        const depositWaivedCheckbox = document.getElementById('addDepositWaived');
        const depositWaiverReasonGroup = document.getElementById('addDepositWaiverReasonGroup');
        const depositWaiverReasonInput = document.getElementById('addDepositWaiverReason');
        if (depositWaivedCheckbox && depositWaiverReasonGroup) {
            depositWaivedCheckbox.addEventListener('change', () => {
                if (depositWaivedCheckbox.checked) {
                    depositWaiverReasonGroup.style.display = 'block';
                    if (depositWaiverReasonInput) {
                        depositWaiverReasonInput.required = true;
                    }
                } else {
                    depositWaiverReasonGroup.style.display = 'none';
                    if (depositWaiverReasonInput) {
                        depositWaiverReasonInput.required = false;
                        depositWaiverReasonInput.value = '';
                        this.clearError('addDepositWaiverReason');
                    }
                }
            });
            // Also set initial state
            if (depositWaivedCheckbox.checked) {
                depositWaiverReasonGroup.style.display = 'block';
                if (depositWaiverReasonInput) {
                    depositWaiverReasonInput.required = true;
                }
            }
        }

        // Handle Review Comments dropdown
        const reviewCommentsTypeSelect = document.getElementById('addReviewCommentsType');
        const otherReviewCommentsGroup = document.getElementById('addOtherReviewCommentsGroup');
        const reviewCommentsInput = document.getElementById('addReviewComments');
        if (reviewCommentsTypeSelect && otherReviewCommentsGroup) {
            reviewCommentsTypeSelect.addEventListener('change', () => {
                if (reviewCommentsTypeSelect.value === 'other') {
                    otherReviewCommentsGroup.style.display = 'block';
                    if (reviewCommentsInput) {
                        reviewCommentsInput.required = true;
                    }
                } else {
                    otherReviewCommentsGroup.style.display = 'none';
                    if (reviewCommentsInput) {
                        reviewCommentsInput.required = false;
                        reviewCommentsInput.value = '';
                        this.clearError('addReviewComments');
                    }
                }
            });
        }

        // Handle Approval Reason dropdown
        const approvalReasonTypeSelect = document.getElementById('addApprovalReasonType');
        const otherApprovalReasonGroup = document.getElementById('addOtherApprovalReasonGroup');
        const approvalReasonInput = document.getElementById('addApprovalReason');
        if (approvalReasonTypeSelect && otherApprovalReasonGroup) {
            approvalReasonTypeSelect.addEventListener('change', () => {
                if (approvalReasonTypeSelect.value === 'other') {
                    otherApprovalReasonGroup.style.display = 'block';
                    if (approvalReasonInput) {
                        approvalReasonInput.required = true;
                    }
                } else {
                    otherApprovalReasonGroup.style.display = 'none';
                    if (approvalReasonInput) {
                        approvalReasonInput.required = false;
                        approvalReasonInput.value = '';
                        this.clearError('addApprovalReason');
                    }
                }
            });
        }

        // Handle generate letter button in add form
        const addGenerateLetterBtn = document.getElementById('addGenerateLetterBtn');
        if (addGenerateLetterBtn) {
            addGenerateLetterBtn.addEventListener('click', async () => {
                // Require authentication
                if (!this.requireAuth()) {
                    return;
                }

                // Collect form data
                const homeownerName = document.getElementById('addHomeownerName')?.value.trim();
                const address = document.getElementById('addAddress')?.value.trim();
                const lot = document.getElementById('addLot')?.value.trim();
                const projectTypeSelect = document.getElementById('addProjectType')?.value;
                const otherProjectType = document.getElementById('addOtherProjectType')?.value.trim();
                const projectType = projectTypeSelect === 'Other' ? otherProjectType : projectTypeSelect;
                const contractorName = document.getElementById('addContractorName')?.value.trim();
                const approvedBy = document.getElementById('addApprovedBy')?.value.trim();
                const noApprovalOnRecord = document.getElementById('noApprovalOnRecord')?.checked;
                const dateApproved = noApprovalOnRecord ? null : document.getElementById('addDateApproved')?.value;
                
                // Review comments
                const reviewCommentsType = document.getElementById('addReviewCommentsType')?.value;
                const reviewComments = reviewCommentsType === 'other' 
                    ? document.getElementById('addReviewComments')?.value.trim() 
                    : 'The plan was reviewed for Sanctuary Setback Requirements.';
                
                // Approval reason
                const approvalReasonType = document.getElementById('addApprovalReasonType')?.value;
                const approvalReason = approvalReasonType === 'other'
                    ? document.getElementById('addApprovalReason')?.value.trim()
                    : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
                
                const siteConditionsFiles = document.getElementById('addSiteConditions')?.files || [];

                // Validate required fields
                if (!homeownerName || !address || !lot || !projectTypeSelect) {
                    alert('Please fill in all required fields (Homeowner Name, Address, Lot, Project Type) before generating the letter.');
                    return;
                }
                if (reviewCommentsType === 'other' && !reviewComments) {
                    alert('Please specify the review comments');
                    return;
                }
                if (approvalReasonType === 'other' && !approvalReason) {
                    alert('Please specify the approval reason');
                    return;
                }

                // Prepare form data for PDF generation
                const formData = {
                    ownerLastName: homeownerName.split(' ').pop() || homeownerName,
                    address: address,
                    lot: lot,
                    projectType: projectType,
                    contractorName: contractorName,
                    reviewComments: reviewComments,
                    approvalReason: approvalReason,
                    approvedBy: approvedBy,
                    approvedOn: noApprovalOnRecord ? null : (dateApproved || new Date().toISOString().split('T')[0])
                };

                // Convert site conditions files to File objects
                const siteConditionsFileArray = [];
                if (siteConditionsFiles.length > 0) {
                    for (const file of Array.from(siteConditionsFiles)) {
                        siteConditionsFileArray.push(file);
                    }
                }

                // Convert submitted plans files to File objects
                const submittedPlansFileArray = [];
                if (submittedPlansFiles.length > 0) {
                    for (const file of Array.from(submittedPlansFiles)) {
                        submittedPlansFileArray.push(file);
                    }
                }

                // Generate PDF
                try {
                    if (!window.pdfGenerator) {
                        window.pdfGenerator = new PDFGenerator();
                    }
                    
                    await window.pdfGenerator.generatePDF(formData, siteConditionsFileArray, submittedPlansFileArray);
                    
                    // After PDF is generated, it will be saved to the project automatically
                    // Close the form and refresh projects
                    const form = document.getElementById('addProjectForm');
                    if (form) {
                        form.style.display = 'none';
                    }
                    const toggleText = document.getElementById('toggleAddProjectText');
                    if (toggleText) {
                        toggleText.textContent = '+ Add Existing Project';
                    }
                    this.resetAddProjectForm();
                    this.renderProjects();
                } catch (error) {
                    console.error('Error generating approval letter:', error);
                    alert('Error generating approval letter: ' + error.message);
                }
            });
        }

        // Setup drag and drop for file upload in add project form
        this.setupAddProjectDragAndDrop();
        this.setupSiteConditionsDragAndDrop();
        this.setupSubmittedPlansDragAndDrop();
    }

    setupAddProjectDragAndDrop() {
        const fileDropZone = document.getElementById('addFileDropZone');
        const fileInput = document.getElementById('addApprovalLetter');
        const fileDropZoneContent = document.getElementById('addFileDropZoneContent');
        const fileDropZoneFileName = document.getElementById('addFileDropZoneFileName');

        if (fileDropZone && fileInput) {
            // Click to browse
            fileDropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, () => {
                    fileDropZone.style.borderColor = '#2c5530';
                    fileDropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, () => {
                    fileDropZone.style.borderColor = '#ddd';
                    fileDropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            fileDropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        
                        // Update UI to show file name
                        if (fileDropZoneContent) {
                            fileDropZoneContent.style.display = 'none';
                        }
                        if (fileDropZoneFileName) {
                            fileDropZoneFileName.textContent = file.name;
                            fileDropZoneFileName.style.display = 'block';
                        }
                        
                        // Clear any error messages
                        this.clearError('addApprovalLetter');
                        
                        // Trigger change event for any listeners
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        alert('Please upload a PDF file.');
                    }
                }
            });

            // Handle file selection via click
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                        // Update UI to show file name
                        if (fileDropZoneContent) {
                            fileDropZoneContent.style.display = 'none';
                        }
                        if (fileDropZoneFileName) {
                            fileDropZoneFileName.textContent = file.name;
                            fileDropZoneFileName.style.display = 'block';
                        }
                        
                        // Clear any error messages
                        this.clearError('addApprovalLetter');
                    } else {
                        alert('Please upload a PDF file.');
                        fileInput.value = '';
                        if (fileDropZoneContent) {
                            fileDropZoneContent.style.display = 'block';
                        }
                        if (fileDropZoneFileName) {
                            fileDropZoneFileName.style.display = 'none';
                        }
                    }
                }
            });
        }
    }

    setupSiteConditionsDragAndDrop() {
        const dropZone = document.getElementById('addSiteConditionsDropZone');
        const fileInput = document.getElementById('addSiteConditions');
        const dropZoneContent = document.getElementById('addSiteConditionsDropZoneContent');
        const fileList = document.getElementById('addSiteConditionsDropZoneFileList');

        if (dropZone && fileInput) {
            // Click to browse
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#2c5530';
                    dropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#ddd';
                    dropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    const validFiles = files.filter(file => 
                        file.type === 'application/pdf' || 
                        file.type.startsWith('image/') ||
                        file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png)$/i)
                    );
                    
                    if (validFiles.length > 0) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        validFiles.forEach(file => dataTransfer.items.add(file));
                        fileInput.files = dataTransfer.files;
                        
                        // Update UI to show file names
                        this.updateSiteConditionsFileList(validFiles, dropZoneContent, fileList);
                    } else {
                        alert('Please upload PDF or image files (JPG, PNG).');
                    }
                }
            });

            // Handle file selection via click
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    this.updateSiteConditionsFileList(files, dropZoneContent, fileList);
                } else {
                    this.updateSiteConditionsFileList([], dropZoneContent, fileList);
                }
            });
        }
    }

    updateSiteConditionsFileList(files, dropZoneContent, fileList) {
        if (files.length > 0) {
            if (dropZoneContent) {
                dropZoneContent.style.display = 'none';
            }
            if (fileList) {
                fileList.innerHTML = files.map(file => 
                    `<div style="padding: 4px 0; font-size: 0.85rem; color: #2c5530;">✓ ${file.name}</div>`
                ).join('');
                fileList.style.display = 'block';
            }
        } else {
            if (dropZoneContent) {
                dropZoneContent.style.display = 'block';
            }
            if (fileList) {
                fileList.style.display = 'none';
                fileList.innerHTML = '';
            }
        }
    }

    updateSubmittedPlansFileList(files, dropZoneContent, fileList) {
        if (files.length > 0) {
            if (dropZoneContent) {
                dropZoneContent.style.display = 'none';
            }
            if (fileList) {
                fileList.innerHTML = files.map(file => 
                    `<div style="padding: 4px 0; font-size: 0.85rem; color: #2c5530;">✓ ${file.name}</div>`
                ).join('');
                fileList.style.display = 'block';
            }
        } else {
            if (dropZoneContent) {
                dropZoneContent.style.display = 'block';
            }
            if (fileList) {
                fileList.style.display = 'none';
                fileList.innerHTML = '';
            }
        }
    }

    setupSubmittedPlansDragAndDrop() {
        const dropZone = document.getElementById('addSubmittedPlansDropZone');
        const fileInput = document.getElementById('addSubmittedPlans');
        const dropZoneContent = document.getElementById('addSubmittedPlansDropZoneContent');
        const fileList = document.getElementById('addSubmittedPlansDropZoneFileList');

        if (dropZone && fileInput) {
            // Click to browse
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#2c5530';
                    dropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#ddd';
                    dropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    const validFiles = files.filter(file => 
                        file.type === 'application/pdf' || 
                        file.type.startsWith('image/') ||
                        file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|doc|docx)$/i)
                    );
                    
                    if (validFiles.length > 0) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        validFiles.forEach(file => dataTransfer.items.add(file));
                        fileInput.files = dataTransfer.files;
                        
                        // Update UI to show file names
                        this.updateSubmittedPlansFileList(validFiles, dropZoneContent, fileList);
                    } else {
                        alert('Please upload PDF, image, or document files (JPG, PNG, DOC, DOCX).');
                    }
                }
            });

            // Handle file selection via click
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    this.updateSubmittedPlansFileList(files, dropZoneContent, fileList);
                } else {
                    this.updateSubmittedPlansFileList([], dropZoneContent, fileList);
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

        // Reset drag-and-drop UI
        const fileDropZoneContent = document.getElementById('addFileDropZoneContent');
        const fileDropZoneFileName = document.getElementById('addFileDropZoneFileName');
        if (fileDropZoneContent) {
            fileDropZoneContent.style.display = 'block';
        }
        if (fileDropZoneFileName) {
            fileDropZoneFileName.style.display = 'none';
            fileDropZoneFileName.textContent = '';
        }

        // Reset deposit waiver fields
        const depositWaivedCheckbox = document.getElementById('addDepositWaived');
        const depositWaiverReasonGroup = document.getElementById('addDepositWaiverReasonGroup');
        const depositWaiverReasonInput = document.getElementById('addDepositWaiverReason');
        if (depositWaivedCheckbox) {
            depositWaivedCheckbox.checked = false;
        }
        if (depositWaiverReasonGroup) {
            depositWaiverReasonGroup.style.display = 'none';
        }
        if (depositWaiverReasonInput) {
            depositWaiverReasonInput.value = '';
            depositWaiverReasonInput.required = false;
            this.clearError('addDepositWaiverReason');
        }

        // Reset review comments fields
        const reviewCommentsTypeSelect = document.getElementById('addReviewCommentsType');
        const otherReviewCommentsGroup = document.getElementById('addOtherReviewCommentsGroup');
        const reviewCommentsInput = document.getElementById('addReviewComments');
        if (reviewCommentsTypeSelect) {
            reviewCommentsTypeSelect.value = 'default';
        }
        if (otherReviewCommentsGroup) {
            otherReviewCommentsGroup.style.display = 'none';
        }
        if (reviewCommentsInput) {
            reviewCommentsInput.value = '';
            reviewCommentsInput.required = false;
            this.clearError('addReviewComments');
        }

        // Reset approval reason fields
        const approvalReasonTypeSelect = document.getElementById('addApprovalReasonType');
        const otherApprovalReasonGroup = document.getElementById('addOtherApprovalReasonGroup');
        const approvalReasonInput = document.getElementById('addApprovalReason');
        if (approvalReasonTypeSelect) {
            approvalReasonTypeSelect.value = 'default';
        }
        if (otherApprovalReasonGroup) {
            otherApprovalReasonGroup.style.display = 'none';
        }
        if (approvalReasonInput) {
            approvalReasonInput.value = '';
            approvalReasonInput.required = false;
            this.clearError('addApprovalReason');
        }

        // Reset site conditions files
        const siteConditionsInput = document.getElementById('addSiteConditions');
        const siteConditionsDropZoneContent = document.getElementById('addSiteConditionsDropZoneContent');
        const siteConditionsFileList = document.getElementById('addSiteConditionsDropZoneFileList');
        if (siteConditionsInput) {
            siteConditionsInput.value = '';
        }
        if (siteConditionsDropZoneContent) {
            siteConditionsDropZoneContent.style.display = 'block';
        }
        if (siteConditionsFileList) {
            siteConditionsFileList.style.display = 'none';
            siteConditionsFileList.innerHTML = '';
        }

        // Reset submitted plans files
        const submittedPlansInput = document.getElementById('addSubmittedPlans');
        const submittedPlansDropZoneContent = document.getElementById('addSubmittedPlansDropZoneContent');
        const submittedPlansFileList = document.getElementById('addSubmittedPlansDropZoneFileList');
        if (submittedPlansInput) {
            submittedPlansInput.value = '';
        }
        if (submittedPlansDropZoneContent) {
            submittedPlansDropZoneContent.style.display = 'block';
        }
        if (submittedPlansFileList) {
            submittedPlansFileList.style.display = 'none';
            submittedPlansFileList.innerHTML = '';
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
        const contractorName = document.getElementById('addContractorName')?.value.trim();
        const approvedBy = document.getElementById('addApprovedBy')?.value.trim();
        const noApprovalOnRecord = document.getElementById('noApprovalOnRecord')?.checked;
        const dateApproved = noApprovalOnRecord ? null : document.getElementById('addDateApproved')?.value;
        const dateConstructionStarted = document.getElementById('addDateConstructionStarted')?.value;
        const status = document.getElementById('addProjectStatus')?.value;
        const approvalLetterFile = document.getElementById('addApprovalLetter')?.files[0];
        const siteConditionsFiles = document.getElementById('addSiteConditions')?.files || [];
        const submittedPlansFiles = document.getElementById('addSubmittedPlans')?.files || [];
        
        // Review comments
        const reviewCommentsType = document.getElementById('addReviewCommentsType')?.value;
        const reviewComments = reviewCommentsType === 'other' 
            ? document.getElementById('addReviewComments')?.value.trim() 
            : 'The plan was reviewed for Sanctuary Setback Requirements.';
        
        // Approval reason
        const approvalReasonType = document.getElementById('addApprovalReasonType')?.value;
        const approvalReason = approvalReasonType === 'other'
            ? document.getElementById('addApprovalReason')?.value.trim()
            : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
        
        const depositAmountReceived = document.getElementById('addDepositAmountReceived')?.value;
        const dateDepositReceived = document.getElementById('addDateDepositReceived')?.value;
        const depositAmountReturned = document.getElementById('addDepositAmountReturned')?.value;
        const dateDepositReturned = document.getElementById('addDateDepositReturned')?.value;
        const depositWaived = document.getElementById('addDepositWaived')?.checked || false;
        const depositWaiverReason = document.getElementById('addDepositWaiverReason')?.value.trim() || '';

        // Validation
        if (!homeownerName) {
            this.showError('addHomeownerName', 'Homeowner name is required');
            return;
        }
        if (!address) {
            this.showError('addAddress', 'Property address is required');
            return;
        }
        if (!lot) {
            this.showError('addLot', 'Lot number is required');
            return;
        }
        if (!projectTypeSelect) {
            this.showError('addProjectType', 'Project type is required');
            return;
        }
        if (reviewCommentsType === 'other' && !reviewComments) {
            this.showError('addReviewComments', 'Please specify the review comments');
            return;
        }
        if (approvalReasonType === 'other' && !approvalReason) {
            this.showError('addApprovalReason', 'Please specify the approval reason');
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

        // Validate waiver reason if deposit is waived
        if (depositWaived && !depositWaiverReason) {
            this.showError('addDepositWaiverReason', 'Waiver reason is required when deposit is waived');
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

            // Read site conditions files as ArrayBuffers
            const siteConditionsArrayBuffers = [];
            if (siteConditionsFiles.length > 0) {
                for (const file of Array.from(siteConditionsFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        siteConditionsArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading site conditions file:', error);
                    }
                }
            }

            // Read submitted plans files as ArrayBuffers
            const submittedPlansArrayBuffers = [];
            if (submittedPlansFiles.length > 0) {
                for (const file of Array.from(submittedPlansFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        submittedPlansArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading submitted plans file:', error);
                    }
                }
            }

            // Create project
            const project = {
                id: Date.now().toString(),
                homeownerName: homeownerName,
                address: address || '',
                lot: lot || '',
                projectType: projectType || '',
                contractorName: contractorName || '',
                approvedBy: approvedBy || '',
                dateApproved: formattedDateApproved,
                noApprovalOnRecord: noApprovalOnRecord || false,
                dateConstructionStarted: formattedDateStarted,
                status: status || 'open',
                approvalLetterBlob: arrayBuffer,
                approvalLetterFilename: approvalLetterFilename,
                hasApprovalLetter: !!arrayBuffer, // Flag to track if letter exists
                reviewComments: reviewComments || '',
                approvalReason: approvalReason || '',
                siteConditionsFiles: siteConditionsArrayBuffers,
                submittedPlansFiles: submittedPlansArrayBuffers,
                depositAmountReceived: depositAmountReceived ? parseFloat(depositAmountReceived) : null,
                dateDepositReceived: formattedDateDepositReceived,
                depositAmountReturned: depositAmountReturned ? parseFloat(depositAmountReturned) : null,
                dateDepositReturned: formattedDateDepositReturned,
                depositWaived: depositWaived,
                depositWaiverReason: depositWaiverReason
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

    setupViewToggle() {
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        const viewToggleText = document.getElementById('viewToggleText');
        
        if (viewToggleBtn && viewToggleText) {
            // Update button text based on current view mode
            this.updateViewToggleText(viewToggleText);
            
            viewToggleBtn.addEventListener('click', () => {
                this.viewMode = this.viewMode === 'detailed' ? 'compact' : 'detailed';
                this.updateViewToggleText(viewToggleText);
                this.renderProjects();
            });
        }
    }

    updateViewToggleText(element) {
        if (this.viewMode === 'compact') {
            element.textContent = '📄 Compact';
        } else {
            element.textContent = '📋 Detailed';
        }
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

        // Format dateApproved from approvedOn if provided, otherwise use today's date
        let dateApproved;
        if (projectData.approvedOn) {
            // approvedOn is a Date object, format it to MM/DD/YYYY
            const date = projectData.approvedOn instanceof Date ? projectData.approvedOn : new Date(projectData.approvedOn);
            dateApproved = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        } else {
            // Fall back to today's date if not provided
            dateApproved = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }

        const project = {
            id: Date.now().toString(),
            homeownerName: projectData.ownerLastName || 'Unknown',
            address: projectData.address || '',
            lot: projectData.lot || '',
            projectType: projectData.projectType || '',
            contractorName: projectData.contractorName || '',
            approvedBy: projectData.approvedBy || '',
            dateApproved: dateApproved,
            dateConstructionStarted: '',
            status: 'open', // 'open' or 'previous'
            approvalLetterBlob: projectData.approvalLetterBlob || null,
            approvalLetterFilename: projectData.approvalLetterFilename || '',
            depositAmountReceived: null,
            dateDepositReceived: '',
            depositAmountReturned: null,
            dateDepositReturned: '',
            depositWaived: false,
            depositWaiverReason: ''
        };

        try {
            const firestoreData = await this.convertProjectToFirestore(project);
            const docRef = await this.db.collection(this.collectionName).add(firestoreData);
            project.id = docRef.id; // Use Firestore document ID
            // Update project with storage URL if PDF was uploaded
            if (firestoreData.approvalLetterStorageUrl) {
                project.approvalLetterStorageUrl = firestoreData.approvalLetterStorageUrl;
            }
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
            const firestoreData = await this.convertProjectToFirestore(project);
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
            return this.projects.filter(p => p.status === 'open' || p.status === 'under_review');
        } else if (this.currentFilter === 'previous') {
            return this.projects.filter(p => p.status === 'previous');
        }
        return this.projects;
    }

    calculateTotalDeposits() {
        let totalReceived = 0;
        let totalReturned = 0;

        this.projects.forEach(project => {
            // Skip waived deposits in the calculation
            if (project.depositWaived) {
                return;
            }
            if (project.depositAmountReceived !== null && project.depositAmountReceived !== undefined) {
                totalReceived += project.depositAmountReceived;
            }
            if (project.depositAmountReturned !== null && project.depositAmountReturned !== undefined) {
                totalReturned += project.depositAmountReturned;
            }
        });

        return totalReceived - totalReturned;
    }

    updateDepositSummary() {
        const totalDepositElement = document.getElementById('totalDepositAmount');
        if (totalDepositElement) {
            const total = this.calculateTotalDeposits();
            totalDepositElement.textContent = '$' + total.toFixed(2);
        }
    }

    renderProjects() {
        const projectList = document.getElementById('projectList');
        const noProjects = document.getElementById('noProjects');
        
        if (!projectList) return;

        // Update deposit summary
        this.updateDepositSummary();

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
        
        // Render based on view mode
        if (this.viewMode === 'compact') {
            // Add header row for compact view and wrap in table-like container
            const headerRow = this.renderCompactHeader();
            const dataRows = filteredProjects.map(project => this.renderProjectCompact(project, isAuthenticated)).join('');
            projectList.innerHTML = `
                <div style="background: #ffffff; border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
                    ${headerRow}
                    ${dataRows}
                </div>
            `;
        } else {
            projectList.innerHTML = filteredProjects.map(project => this.renderProjectDetailed(project, isAuthenticated)).join('');
        }
    }

    renderCompactHeader() {
        return `
            <div class="compact-project-header" style="display: grid; grid-template-columns: 70px 1.6fr 0.9fr 0.9fr 1.1fr 95px 100px 75px 120px; gap: 10px; padding: 10px 14px; background: #2c5530; color: white; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #1e3d22;">
                <div style="text-align: center;">Status</div>
                <div>Homeowner / Address</div>
                <div>Lot</div>
                <div>Project Type</div>
                <div>Contractor</div>
                <div style="text-align: center;">Date Approved</div>
                <div style="text-align: center;">Deposit</div>
                <div style="text-align: center;">Letter</div>
                <div style="text-align: center;">Actions</div>
            </div>
        `;
    }

    renderProjectDetailed(project, isAuthenticated) {
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
                    <div class="project-status-badge ${project.status}">${project.status === 'open' ? 'Open' : project.status === 'under_review' ? 'Under Architectural Review' : 'Previous'}</div>
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
                            <span class="info-label">Contractor:</span>
                            <span class="info-value">${project.contractorName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Approved By:</span>
                            <span class="info-value">${project.approvedBy || 'N/A'}</span>
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
                        ${project.depositWaived ? `
                            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px;">
                                <div style="font-weight: bold; color: #856404; margin-bottom: 8px;">⚠️ Deposit Waived</div>
                                <div style="color: #856404; font-size: 0.9rem;">${project.depositWaiverReason || 'No reason provided'}</div>
                            </div>
                        ` : (!project.depositAmountReceived && !project.depositWaived) ? `
                            <div style="color: #d32f2f; font-weight: bold; font-size: 1rem; padding: 8px 0;">
                                Deposit Needed
                            </div>
                        ` : `
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
                        `}
                    </div>
                    
                    <div class="file-info" style="margin-top: 20px;">
                        <h4>Current Site Conditions</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                            ${project.siteConditionsFiles && project.siteConditionsFiles.length > 0 ? 
                                project.siteConditionsFiles.map((file, index) => {
                                    const fileName = file.name || file;
                                    const fileType = file.type || '';
                                    const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(fileName);
                                    const isPDF = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
                                    const fileId = `site-conditions-${project.id}-${index}`;
                                    return `
                                        <div class="file-badge-with-remove" data-file-id="${fileId}" data-project-id="${project.id}" data-file-index="${index}" data-file-type="siteConditions" style="display: flex; align-items: center; gap: 4px; padding: 6px 8px 6px 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;">
                                            <div class="file-badge-clickable" style="display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; transition: all 0.2s ease;" onmouseover="this.style.color='#2c5530';" onmouseout="this.style.color='#333';">
                                                <span style="font-size: 1rem;">${isImage ? '🖼️' : isPDF ? '📄' : '📎'}</span>
                                                <span style="color: #333;">${fileName}</span>
                                            </div>
                                            ${isAuthenticated ? `
                                                <button type="button" class="file-remove-btn" data-project-id="${project.id}" data-file-index="${index}" data-file-type="siteConditions" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: all 0.2s ease;" onmouseover="this.style.background='#c82333'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#dc3545'; this.style.transform='scale(1)';" title="Remove file">×</button>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('') :
                                `<div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.85rem;">
                                    <span style="font-size: 1rem;">⚠️</span>
                                    <span style="color: #856404; font-weight: 500;">File Needed</span>
                                </div>`
                            }
                        </div>
                    </div>
                    
                    <div class="file-info" style="margin-top: 20px;">
                        <h4>Submitted Plans</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                            ${project.submittedPlansFiles && project.submittedPlansFiles.length > 0 ? 
                                project.submittedPlansFiles.map((file, index) => {
                                    const fileName = file.name || file;
                                    const fileType = file.type || '';
                                    const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(fileName);
                                    const isPDF = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
                                    const isDoc = /\.(doc|docx)$/i.test(fileName);
                                    const fileId = `submitted-plans-${project.id}-${index}`;
                                    return `
                                        <div class="file-badge-with-remove" data-file-id="${fileId}" data-project-id="${project.id}" data-file-index="${index}" data-file-type="submittedPlans" style="display: flex; align-items: center; gap: 4px; padding: 6px 8px 6px 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;">
                                            <div class="file-badge-clickable" style="display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; transition: all 0.2s ease;" onmouseover="this.style.color='#2c5530';" onmouseout="this.style.color='#333';">
                                                <span style="font-size: 1rem;">${isImage ? '🖼️' : isPDF ? '📄' : isDoc ? '📝' : '📎'}</span>
                                                <span style="color: #333;">${fileName}</span>
                                            </div>
                                            ${isAuthenticated ? `
                                                <button type="button" class="file-remove-btn" data-project-id="${project.id}" data-file-index="${index}" data-file-type="submittedPlans" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: all 0.2s ease;" onmouseover="this.style.background='#c82333'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#dc3545'; this.style.transform='scale(1)';" title="Remove file">×</button>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('') :
                                `<div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.85rem;">
                                    <span style="font-size: 1rem;">⚠️</span>
                                    <span style="color: #856404; font-weight: 500;">File Needed</span>
                                </div>`
                            }
                        </div>
                    </div>
                    
                    <div class="file-info" style="margin-top: 20px;">
                        <h4>Architectural Approval Letter</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                            ${project.approvalLetterFilename || project.approvalLetterStorageUrl || project.hasApprovalLetter ? `
                                <div class="file-badge-with-remove" data-project-id="${project.id}" data-file-type="approvalLetter" style="display: flex; align-items: center; gap: 4px; padding: 6px 8px 6px 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; font-size: 0.85rem;">
                                    <div class="file-badge-clickable" style="display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; transition: all 0.2s ease;" onmouseover="this.style.color='#1e3d22';" onmouseout="this.style.color='#2c5530';">
                                        <span style="font-size: 1rem;">📋</span>
                                        <span style="color: #2c5530; font-weight: 500;">${project.approvalLetterFilename || 'Approval Letter.pdf'}</span>
                                    </div>
                                    ${isAuthenticated ? `
                                        <button type="button" class="file-remove-btn" data-project-id="${project.id}" data-file-type="approvalLetter" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: all 0.2s ease;" onmouseover="this.style.background='#c82333'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#dc3545'; this.style.transform='scale(1)';" title="Remove file">×</button>
                                    ` : ''}
                                </div>
                            ` : `
                                <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.85rem;">
                                    <span style="font-size: 1rem;">⚠️</span>
                                    <span style="color: #856404; font-weight: 500;">File Needed</span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                <div class="project-card-actions">
                    ${downloadButton}
                    ${editDeleteButtons}
                </div>
            </div>
        `;
        
        // Attach click handlers for file previews and remove buttons after rendering
        setTimeout(() => {
            this.attachFileRemoveHandlers(project);
        }, 0);
    }
    
    attachFileRemoveHandlers(project) {
        // Attach remove handlers to all file remove buttons
        const removeButtons = document.querySelectorAll(`[data-project-id="${project.id}"].file-remove-btn`);
        console.log(`Attaching remove handlers for project ${project.id}, found ${removeButtons.length} buttons`);
        
        removeButtons.forEach((btn, index) => {
            const fileType = btn.getAttribute('data-file-type');
            const fileIndex = btn.getAttribute('data-file-index');
            console.log(`Remove button ${index}:`, { fileType, fileIndex, element: btn });
            
            // Remove any existing listeners first
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Remove button clicked:', { fileType, fileIndex, projectId: project.id });
                
                if (confirm(`Are you sure you want to remove this file? You'll need to save the project for the change to take effect.`)) {
                    // Mark file for removal (will be handled when saving)
                    if (!project.filesToRemove) {
                        project.filesToRemove = { siteConditions: [], submittedPlans: [], approvalLetter: false };
                    }
                    
                    if (fileType === 'approvalLetter') {
                        project.filesToRemove.approvalLetter = true;
                    } else if (fileType === 'siteConditions' && fileIndex !== null) {
                        project.filesToRemove.siteConditions.push(parseInt(fileIndex));
                    } else if (fileType === 'submittedPlans' && fileIndex !== null) {
                        project.filesToRemove.submittedPlans.push(parseInt(fileIndex));
                    }
                    
                    console.log('Files to remove:', project.filesToRemove);
                    
                    // Remove from display immediately
                    const badgeContainer = newBtn.closest('.file-badge-with-remove');
                    if (badgeContainer) {
                        badgeContainer.style.opacity = '0.5';
                        badgeContainer.style.textDecoration = 'line-through';
                        newBtn.style.display = 'none';
                    }
                }
            });
        });
    }
    
    setupFilePreviewDelegation() {
        // Use event delegation on the projects container
        // Wait for DOM to be ready
        setTimeout(() => {
            const projectsContainer = document.getElementById('projectList');
            if (!projectsContainer) {
                console.warn('Projects container not found for file preview delegation, will retry...');
                // Retry after a short delay
                setTimeout(() => this.setupFilePreviewDelegation(), 500);
                return;
            }
            
            console.log('Setting up file preview delegation on projectList');
            
            projectsContainer.addEventListener('click', (e) => {
                const badge = e.target.closest('.file-badge-clickable');
                if (!badge) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                const projectId = badge.getAttribute('data-project-id');
                const fileType = badge.getAttribute('data-file-type');
                const fileIndex = badge.getAttribute('data-file-index');
                
                console.log('File preview clicked:', { projectId, fileType, fileIndex, badge });
                
                const project = this.projects.find(p => p.id === projectId);
                if (!project) {
                    console.error('Project not found:', projectId);
                    alert('Project not found');
                    return;
                }
                
                this.previewFile(project, fileType, fileIndex);
            });
        }, 100);
    }
    
    async previewFile(project, fileType, fileIndex) {
        try {
            let fileData = null;
            let fileName = '';
            let fileMimeType = '';
            
            if (fileType === 'approvalLetter') {
                // Handle approval letter
                fileName = project.approvalLetterFilename || 'Approval Letter.pdf';
                fileMimeType = 'application/pdf';
                
                console.log('Previewing approval letter:', {
                    projectId: project.id,
                    hasStorageUrl: !!project.approvalLetterStorageUrl,
                    hasBlob: !!project.approvalLetterBlob,
                    hasApprovalLetter: project.hasApprovalLetter,
                    storageUrl: project.approvalLetterStorageUrl,
                    filename: project.approvalLetterFilename
                });
                
                if (project.approvalLetterStorageUrl) {
                    // Get download URL from Firebase Storage
                    const storage = window.firebaseStorage;
                    if (storage) {
                        try {
                            // Check if it's already a full download URL
                            if (project.approvalLetterStorageUrl.startsWith('http')) {
                                // Try to use it directly first
                                fileData = project.approvalLetterStorageUrl;
                                console.log('Using storage URL directly:', fileData);
                            } else {
                                // It's a path, need to get download URL
                                const storageRef = storage.ref(project.approvalLetterStorageUrl);
                                fileData = await storageRef.getDownloadURL();
                                console.log('Got download URL from Storage:', fileData);
                            }
                        } catch (error) {
                            console.error('Error getting download URL:', error);
                            // Try to extract path from URL if it's a full URL
                            try {
                                const url = new URL(project.approvalLetterStorageUrl);
                                const pathMatch = url.pathname.match(/\/o\/(.+)/);
                                if (pathMatch) {
                                    const encodedPath = pathMatch[1];
                                    const decodedPath = decodeURIComponent(encodedPath);
                                    const storageRef = storage.ref(decodedPath);
                                    fileData = await storageRef.getDownloadURL();
                                    console.log('Got download URL from extracted path:', fileData);
                                } else {
                                    throw new Error('Could not extract path from URL');
                                }
                            } catch (retryError) {
                                console.error('Retry error:', retryError);
                                alert('Error loading file from storage. Please try again or re-upload the file.');
                                return;
                            }
                        }
                    } else {
                        alert('Firebase Storage not available.');
                        return;
                    }
                } else if (project.approvalLetterBlob) {
                    // Create blob URL from ArrayBuffer
                    try {
                        const blob = new Blob([project.approvalLetterBlob], { type: 'application/pdf' });
                        fileData = URL.createObjectURL(blob);
                        console.log('Created blob URL from ArrayBuffer');
                    } catch (error) {
                        console.error('Error creating blob:', error);
                        alert('Error loading file data. Please try again.');
                        return;
                    }
                } else {
                    console.warn('No approval letter data available:', project);
                    alert(`File preview is not available. The approval letter data is not stored. Please re-upload the approval letter or use the download button if available.`);
                    return;
                }
            } else if (fileType === 'siteConditions' || fileType === 'submittedPlans') {
                // Handle site conditions or submitted plans
                const files = fileType === 'siteConditions' ? project.siteConditionsFiles : project.submittedPlansFiles;
                console.log('Preview file:', { fileType, fileIndex, filesLength: files?.length, file: files?.[fileIndex] });
                
                if (!files || files.length === 0 || !files[fileIndex]) {
                    console.error('File not found:', { files, fileIndex });
                    alert('File not found.');
                    return;
                }
                
                const file = files[fileIndex];
                fileName = file.name || file;
                fileMimeType = file.type || '';
                
                console.log('File object:', { fileName, fileMimeType, hasData: !!file.data, hasStorageUrl: !!file.storageUrl, fileKeys: Object.keys(file) });
                
                // Check if file has data (ArrayBuffer)
                if (file.data && (file.data instanceof ArrayBuffer || file.data instanceof Uint8Array)) {
                    // Create blob URL from ArrayBuffer
                    try {
                        const dataArray = file.data instanceof ArrayBuffer ? [file.data] : [file.data.buffer];
                        const blob = new Blob(dataArray, { type: fileMimeType || 'application/octet-stream' });
                        fileData = URL.createObjectURL(blob);
                        console.log('Created blob URL from ArrayBuffer');
                    } catch (error) {
                        console.error('Error creating blob from ArrayBuffer:', error);
                        alert('Error loading file data. The file may need to be re-uploaded.');
                        return;
                    }
                } else if (file.storageUrl) {
                    // Get download URL from Firebase Storage (if files are stored there)
                    const storage = window.firebaseStorage;
                    if (storage) {
                        try {
                            const url = new URL(file.storageUrl);
                            const pathMatch = url.pathname.match(/\/o\/(.+)/);
                            if (pathMatch) {
                                const encodedPath = pathMatch[1];
                                const decodedPath = decodeURIComponent(encodedPath);
                                const storageRef = storage.ref(decodedPath);
                                fileData = await storageRef.getDownloadURL();
                                console.log('Got download URL from Storage');
                            } else {
                                fileData = file.storageUrl;
                                console.log('Using storage URL directly');
                            }
                        } catch (error) {
                            console.error('Error getting download URL:', error);
                            alert('Error loading file from storage. Please try again.');
                            return;
                        }
                    } else {
                        alert('Firebase Storage not available.');
                        return;
                    }
                } else {
                    // File data not available - this happens when files are loaded from Firestore
                    // which only stores metadata, not the actual file data
                    console.warn('File data not available for preview:', { fileName, file });
                    alert(`File preview is not available for "${fileName}". The file data is not stored in the database. Files need to be uploaded to Firebase Storage to enable preview. Please re-upload the file.`);
                    return;
                }
            } else {
                alert('Unknown file type.');
                return;
            }
            
            // Show preview modal
            this.showFilePreview(fileName, fileData, fileMimeType);
        } catch (error) {
            console.error('Error previewing file:', error);
            alert('Error loading file: ' + error.message);
        }
    }
    
    showFilePreview(fileName, fileData, fileMimeType) {
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        modal.id = 'filePreviewModal';
        
        const isImage = fileMimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
        const isPDF = fileMimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
        const isDocument = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(fileName);
        
        let content = '';
        
        if (isImage) {
            content = `
                <div style="max-width: 90vw; max-height: 90vh; position: relative;">
                    <img src="${fileData}" alt="${fileName}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                </div>
            `;
        } else if (isPDF) {
            content = `
                <div style="width: 90vw; height: 90vh; position: relative;">
                    <iframe src="${fileData}" style="width: 100%; height: 100%; border: none; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);"></iframe>
                </div>
            `;
        } else {
            // For other file types, show download option
            content = `
                <div style="background: white; padding: 40px; border-radius: 8px; text-align: center; max-width: 500px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">📄</div>
                    <h3 style="margin: 0 0 20px 0; color: #333;">${fileName}</h3>
                    <p style="color: #666; margin-bottom: 30px;">This file type cannot be previewed in the browser.</p>
                    <a href="${fileData}" download="${fileName}" style="display: inline-block; padding: 12px 24px; background: #2c5530; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Download File</a>
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                ${content}
                <button id="closePreviewBtn" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.2s ease;" onmouseover="this.style.background='white'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.transform='scale(1)';">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Store fileData for cleanup
        const cleanup = () => {
            if (fileData && fileData.startsWith('blob:')) {
                URL.revokeObjectURL(fileData);
            }
        };
        
        // Close on button click
        const closeBtn = document.getElementById('closePreviewBtn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            cleanup();
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                cleanup();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                cleanup();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    renderProjectCompact(project, isAuthenticated) {
        // Status badge - smaller and more refined
        const statusText = project.status === 'open' ? 'Open' : project.status === 'under_review' ? 'Under Review' : 'Previous';
        const statusBadge = `<span class="project-status-badge ${project.status}" style="padding: 3px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; display: inline-block; white-space: nowrap; text-align: center; min-width: 50px;">${statusText}</span>`;
        
        // Homeowner and address - tighter spacing
        const homeownerAddress = `
            <div style="font-weight: 600; color: #2c5530; font-size: 0.85rem; margin-bottom: 1px; line-height: 1.3;">${project.homeownerName || 'N/A'}</div>
            ${project.address ? `<div style="color: #666; font-size: 0.75rem; line-height: 1.2;">${project.address}</div>` : ''}
        `;
        
        // Lot - smaller font
        const lot = `<span style="font-size: 0.8rem; color: #333; font-weight: 500;">${project.lot || 'N/A'}</span>`;
        
        // Project type - smaller font
        const projectType = `<span style="font-size: 0.8rem; color: #333;">${project.projectType || 'N/A'}</span>`;
        
        // Contractor - smaller font
        const contractor = `<span style="font-size: 0.8rem; color: #333;">${project.contractorName || 'N/A'}</span>`;
        
        // Date approved - centered, smaller
        const dateApproved = project.noApprovalOnRecord ? 
            '<span style="color: #d32f2f; font-weight: 600; font-size: 0.75rem;">No Record</span>' :
            `<span style="font-size: 0.8rem; color: #333; font-weight: 500;">${project.dateApproved || 'N/A'}</span>`;
        
        // Deposit status - refined styling
        let depositStatus = '';
        if (project.depositWaived) {
            depositStatus = '<span style="color: #856404; font-size: 0.75rem; font-weight: 600;">⚠ Waived</span>';
        } else if (!project.depositAmountReceived) {
            depositStatus = '<span style="color: #d32f2f; font-size: 0.75rem; font-weight: 700;">Needed</span>';
        } else {
            const netDeposit = (project.depositAmountReceived || 0) - (project.depositAmountReturned || 0);
            depositStatus = `<span style="color: #2c5530; font-size: 0.8rem; font-weight: 600;">$${netDeposit.toFixed(2)}</span>`;
        }
        
        // Approval letter status - refined
        const hasLetter = project.approvalLetterBlob || project.approvalLetterStorageUrl || (project.hasApprovalLetter !== false && project.approvalLetterFilename);
        const approvalStatus = hasLetter ? 
            '<span style="color: #4caf50; font-size: 0.8rem; font-weight: 600;">✓</span>' : 
            '<span style="color: #d32f2f; font-size: 0.75rem; font-weight: 700;">✗</span>';
        
        // Download button - smaller, more compact, with overflow protection
        const downloadButton = hasLetter && isAuthenticated ? `
            <button type="button" class="btn-small btn-primary" onclick="window.projectManager.downloadLetter('${project.id}')" style="padding: 3px 8px; font-size: 0.7rem; white-space: nowrap; border-radius: 3px; font-weight: 500; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">Download</button>
        ` : '';
        
        // Edit button - only show if authenticated
        const editButton = isAuthenticated ? `
            <button type="button" class="btn-small btn-secondary" onclick="window.projectManager.editProject('${project.id}')" style="padding: 3px 8px; font-size: 0.7rem; white-space: nowrap; border-radius: 3px; font-weight: 500; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">Edit</button>
        ` : '';
        
        const actionsContent = (downloadButton || editButton) ? `
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                ${downloadButton}
                ${editButton}
            </div>
        ` : '<span style="color: #999; font-size: 0.7rem;">—</span>';
        
        return `
            <div class="compact-project-row" data-project-id="${project.id}" style="display: grid; grid-template-columns: 70px 1.6fr 0.9fr 0.9fr 1.1fr 95px 100px 75px 120px; gap: 10px; padding: 10px 14px; background: #ffffff; border-bottom: 1px solid #e8e8e8; align-items: center; transition: background-color 0.15s ease; font-size: 0.8rem;">
                <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">${statusBadge}</div>
                <div style="line-height: 1.4; overflow: hidden; text-overflow: ellipsis;">${homeownerAddress}</div>
                <div style="display: flex; align-items: center; overflow: hidden;">${lot}</div>
                <div style="display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis;">${projectType}</div>
                <div style="display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis;">${contractor}</div>
                <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">${dateApproved}</div>
                <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">${depositStatus}</div>
                <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">${approvalStatus}</div>
                <div style="display: flex; align-items: center; justify-content: center; overflow: hidden; min-width: 0;">${actionsContent}</div>
            </div>
        `;
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
                // Download from Firebase Storage using Storage SDK
                const storage = window.firebaseStorage;
                if (!storage) {
                    throw new Error('Firebase Storage not available');
                }

                try {
                    // Extract storage path from the download URL
                    // Firebase Storage download URLs have format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
                    const url = new URL(project.approvalLetterStorageUrl);
                    const pathMatch = url.pathname.match(/\/o\/(.+)/);
                    
                    if (pathMatch) {
                        const encodedPath = pathMatch[1];
                        const decodedPath = decodeURIComponent(encodedPath);
                        const storageRef = storage.ref(decodedPath);
                        
                        // Get a fresh download URL with authentication token
                        const downloadURL = await storageRef.getDownloadURL();
                        
                        // Use direct link download to avoid CORS issues
                        // Open in new window/tab - this bypasses CORS restrictions
                        const link = document.createElement('a');
                        link.href = downloadURL;
                        link.download = project.approvalLetterFilename || `approval-letter-${project.id}.pdf`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Return early since we're using direct download
                        return;
                    } else {
                        // Fallback: use stored URL directly
                        const link = document.createElement('a');
                        link.href = project.approvalLetterStorageUrl;
                        link.download = project.approvalLetterFilename || `approval-letter-${project.id}.pdf`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        return;
                    }
                } catch (storageError) {
                    console.error('Error getting download URL:', storageError);
                    // Fallback: try using stored URL directly
                    try {
                        const link = document.createElement('a');
                        link.href = project.approvalLetterStorageUrl;
                        link.download = project.approvalLetterFilename || `approval-letter-${project.id}.pdf`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        return;
                    } catch (error) {
                        throw new Error(`Failed to download approval letter: ${storageError.message || error.message}. Please ensure you are signed in.`);
                    }
                }
            } else {
                throw new Error('No approval letter available');
            }
            
            if (!blob) {
                throw new Error('Failed to retrieve approval letter');
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

        // Format date for input (YYYY-MM-DD from MM/DD/YYYY)
        const formatDateForInput = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
            return dateStr;
        };

        // Create edit form HTML with all fields
        const editForm = `
            <div style="padding: 20px;">
                <h3>Edit Project: ${project.homeownerName}</h3>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Homeowner Name:</strong></label><br>
                    <input type="text" id="editHomeownerName" value="${project.homeownerName || ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Property Address:</strong></label><br>
                    <input type="text" id="editAddress" value="${project.address || ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Lot Number:</strong></label><br>
                    <input type="text" id="editLot" value="${project.lot || ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Project Type:</strong></label><br>
                    <select id="editProjectType" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="">Select a project type...</option>
                        <option value="New Home" ${project.projectType === 'New Home' ? 'selected' : ''}>New Home</option>
                        <option value="Renovation/Extension" ${project.projectType === 'Renovation/Extension' ? 'selected' : ''}>Renovation/Extension</option>
                        <option value="Accessory Structure" ${project.projectType === 'Accessory Structure' ? 'selected' : ''}>Accessory Structure</option>
                        <option value="Pool" ${project.projectType === 'Pool' ? 'selected' : ''}>Pool</option>
                        <option value="Other" ${project.projectType && !['New Home', 'Renovation/Extension', 'Accessory Structure', 'Pool'].includes(project.projectType) ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px; display: ${project.projectType && !['New Home', 'Renovation/Extension', 'Accessory Structure', 'Pool'].includes(project.projectType) ? 'block' : 'none'};" id="editOtherProjectTypeGroup">
                    <label><strong>Specify Project Type:</strong></label><br>
                    <input type="text" id="editOtherProjectType" value="${project.projectType && !['New Home', 'Renovation/Extension', 'Accessory Structure', 'Pool'].includes(project.projectType) ? project.projectType : ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Contractor Name:</strong></label><br>
                    <input type="text" id="editContractorName" value="${project.contractorName || ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Approved By:</strong></label><br>
                    <input type="text" id="editApprovedBy" value="${project.approvedBy || ''}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Date Approved:</strong></label><br>
                    <input type="date" id="editDateApproved" value="${formatDateForInput(project.dateApproved)}" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                    <div style="margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer;">
                            <input type="checkbox" id="editNoApprovalOnRecord" ${project.noApprovalOnRecord ? 'checked' : ''}>
                            <span>No Approval on Record</span>
                        </label>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Construction Start Date:</strong></label><br>
                    <input type="text" id="editDateStarted" value="${project.dateConstructionStarted || ''}" placeholder="MM/DD/YYYY" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Status:</strong></label><br>
                    <select id="editStatus" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="open" ${project.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="under_review" ${project.status === 'under_review' ? 'selected' : ''}>Under Architectural Review</option>
                        <option value="previous" ${project.status === 'previous' ? 'selected' : ''}>Previous</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Deposit Amount Received ($):</strong></label><br>
                    <input type="number" id="editDepositReceived" value="${project.depositAmountReceived || ''}" step="0.01" min="0" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Date Deposit Received:</strong></label><br>
                    <input type="text" id="editDateDepositReceived" value="${project.dateDepositReceived || ''}" placeholder="MM/DD/YYYY" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Deposit Amount Returned ($):</strong></label><br>
                    <input type="number" id="editDepositReturned" value="${project.depositAmountReturned !== null ? project.depositAmountReturned : ''}" step="0.01" min="0" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label><strong>Date Deposit Returned:</strong></label><br>
                    <input type="text" id="editDateDepositReturned" value="${project.dateDepositReturned || ''}" placeholder="MM/DD/YYYY" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="editDepositWaived" ${project.depositWaived ? 'checked' : ''} style="width: auto;">
                        <span><strong>Deposit Waived</strong></span>
                    </label>
                    <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 4px;">Check this if the deposit requirement was waived for this project</small>
                </div>
                
                <div style="margin-bottom: 15px; display: ${project.depositWaived ? 'block' : 'none'};" id="editDepositWaiverReasonGroup">
                    <label><strong>Waiver Reason:</strong></label><br>
                    <textarea id="editDepositWaiverReason" rows="3" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Enter the reason why the deposit was waived...">${project.depositWaiverReason || ''}</textarea>
                </div>
                
                <div style="margin-bottom: 20px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c5530;">Review Information</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label><strong>Review Comments:</strong></label><br>
                        <select id="editReviewCommentsType" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="default" ${!project.reviewComments || project.reviewComments === 'The plan was reviewed for Sanctuary Setback Requirements.' ? 'selected' : ''}>The plan was reviewed for Sanctuary Setback Requirements.</option>
                            <option value="other" ${project.reviewComments && project.reviewComments !== 'The plan was reviewed for Sanctuary Setback Requirements.' ? 'selected' : ''}>Other (specify below)</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 15px; display: ${project.reviewComments && project.reviewComments !== 'The plan was reviewed for Sanctuary Setback Requirements.' ? 'block' : 'none'};" id="editOtherReviewCommentsGroup">
                        <label><strong>Specify Review Comments:</strong></label><br>
                        <textarea id="editReviewComments" rows="4" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Enter your review comments">${project.reviewComments && project.reviewComments !== 'The plan was reviewed for Sanctuary Setback Requirements.' ? project.reviewComments : ''}</textarea>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label><strong>Approval Reason:</strong></label><br>
                        <select id="editApprovalReasonType" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="default" ${!project.approvalReason || project.approvalReason === 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.' ? 'selected' : ''}>The project meets Sanctuary Setback Requirements. No variances are required. Approved.</option>
                            <option value="other" ${project.approvalReason && project.approvalReason !== 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.' ? 'selected' : ''}>Other (specify below)</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 15px; display: ${project.approvalReason && project.approvalReason !== 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.' ? 'block' : 'none'};" id="editOtherApprovalReasonGroup">
                        <label><strong>Specify Approval Reason:</strong></label><br>
                        <textarea id="editApprovalReason" rows="4" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Enter your approval reason">${project.approvalReason && project.approvalReason !== 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.' ? project.approvalReason : ''}</textarea>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c5530;">Current Site Conditions</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label><strong>Upload Current Site Conditions (Optional):</strong></label><br>
                        <div id="editSiteConditionsDropZone" style="border: 2px dashed #ddd; border-radius: 8px; padding: 30px; text-align: center; margin-top: 8px; background: #fafafa; cursor: pointer; transition: all 0.3s ease;">
                            <div id="editSiteConditionsDropZoneContent">
                                <div style="font-size: 2rem; margin-bottom: 10px;">📷</div>
                                <div style="font-weight: 500; margin-bottom: 5px;">Drag and drop files here</div>
                                <div style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">or</div>
                                <div style="display: inline-block; padding: 8px 16px; background: #2c5530; color: white; border-radius: 4px; font-size: 0.9rem;">Click to browse</div>
                                <div style="font-size: 0.85rem; color: #666; margin-top: 8px;">PDF, JPG, PNG</div>
                            </div>
                            <div id="editSiteConditionsDropZoneFileList" style="display: none; margin-top: 10px;"></div>
                        </div>
                        <input type="file" id="editSiteConditions" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
                        <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 5px;">Attach image of Google Maps or site picture (optional but recommended)</small>
                        ${project.siteConditionsFiles && project.siteConditionsFiles.length > 0 ? `
                            <div style="margin-top: 8px; font-size: 0.85rem; color: #666;">
                                Current files: ${project.siteConditionsFiles.map(f => f.name || f).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c5530;">Submitted Plans</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label><strong>Upload Submitted Plans (Optional):</strong></label><br>
                        <div id="editSubmittedPlansDropZone" style="border: 2px dashed #ddd; border-radius: 8px; padding: 30px; text-align: center; margin-top: 8px; background: #fafafa; cursor: pointer; transition: all 0.3s ease;">
                            <div id="editSubmittedPlansDropZoneContent">
                                <div style="font-size: 2rem; margin-bottom: 10px;">📐</div>
                                <div style="font-weight: 500; margin-bottom: 5px;">Drag and drop files here</div>
                                <div style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">or</div>
                                <div style="display: inline-block; padding: 8px 16px; background: #2c5530; color: white; border-radius: 4px; font-size: 0.9rem;">Click to browse</div>
                                <div style="font-size: 0.85rem; color: #666; margin-top: 8px;">PDF, JPG, PNG, DOC, DOCX</div>
                            </div>
                            <div id="editSubmittedPlansDropZoneFileList" style="display: none; margin-top: 10px;"></div>
                        </div>
                        <input type="file" id="editSubmittedPlans" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display: none;">
                        <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 5px;">Upload project documents, plans, or drawings (optional but recommended)</small>
                        ${project.submittedPlansFiles && project.submittedPlansFiles.length > 0 ? `
                            <div style="margin-top: 8px; font-size: 0.85rem; color: #666;">
                                Current files: ${project.submittedPlansFiles.map(f => f.name || f).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c5530;">Approval Letter</h4>
                    <div style="margin-bottom: 15px;">
                        <label><strong>Upload Approval Letter PDF (Optional):</strong></label><br>
                        <div id="editFileDropZone" style="border: 2px dashed #ddd; border-radius: 8px; padding: 30px; text-align: center; margin-top: 8px; background: #fafafa; cursor: pointer; transition: all 0.3s ease;">
                            <div id="editFileDropZoneContent">
                                <div style="font-size: 2rem; margin-bottom: 10px;">📄</div>
                                <div style="font-weight: 500; margin-bottom: 5px;">Drag and drop PDF here</div>
                                <div style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">or</div>
                                <div style="display: inline-block; padding: 8px 16px; background: #2c5530; color: white; border-radius: 4px; font-size: 0.9rem;">Click to browse</div>
                            </div>
                            <div id="editFileDropZoneFileName" style="display: none; margin-top: 10px; font-weight: 500; color: #2c5530;"></div>
                        </div>
                        <input type="file" id="editApprovalLetter" accept=".pdf" style="display: none;">
                        <div style="margin-top: 5px; font-size: 0.9rem; color: #666;">
                            ${project.approvalLetterFilename ? `Current file: ${project.approvalLetterFilename}` : 'No approval letter on file'}
                        </div>
                    </div>
                    <div style="text-align: center; padding: 10px; color: #666; font-size: 0.9rem;">
                        <strong>OR</strong>
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <button type="button" id="editGenerateLetterBtnInline" style="padding: 10px 20px; background: #4a90e2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">Generate Approval Letter from Form Data</button>
                    </div>
                    <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 8px; text-align: center;">Generate a new approval letter using the information in this form</small>
                </div>
            </div>
        `;

        // Show form in a dialog
        const dialog = document.createElement('div');
        dialog.id = 'editProjectDialog';
        dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: white; padding: 0; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;';
        modalContent.innerHTML = editForm;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'padding: 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end;';
        buttonContainer.innerHTML = `
            <button id="editGenerateLetterBtn" style="padding: 10px 20px; background: #4a90e2; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: auto;">Generate Approval Letter</button>
            <button id="editCancelBtn" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="editSaveBtn" style="padding: 10px 20px; background: #2c5530; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
        `;
        
        modalContent.appendChild(buttonContainer);
        dialog.appendChild(modalContent);
        document.body.appendChild(dialog);
        
        // Wait a moment for DOM to be ready before attaching event listeners
        setTimeout(() => {
            this.setupEditModalHandlers(dialog, modalContent, projectId, project);
        }, 0);
        
        // Close dialog when clicking outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });

        // Setup drag and drop for file upload
        const fileDropZone = document.getElementById('editFileDropZone');
        const fileInput = document.getElementById('editApprovalLetter');
        const fileDropZoneContent = document.getElementById('editFileDropZoneContent');
        const fileDropZoneFileName = document.getElementById('editFileDropZoneFileName');

        if (fileDropZone && fileInput) {
            // Click to browse
            fileDropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, () => {
                    fileDropZone.style.borderColor = '#2c5530';
                    fileDropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                fileDropZone.addEventListener(eventName, () => {
                    fileDropZone.style.borderColor = '#ddd';
                    fileDropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            fileDropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        fileDropZoneFileName.textContent = `Selected: ${file.name}`;
                        fileDropZoneFileName.style.display = 'block';
                    } else {
                        alert('Please drop a PDF file.');
                    }
                }
            });

            // Handle file input change (when browsing)
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    fileDropZoneFileName.textContent = `Selected: ${file.name}`;
                    fileDropZoneFileName.style.display = 'block';
                }
            });
        }

        // Handle project type change to show/hide "Other" field
        const projectTypeSelect = document.getElementById('editProjectType');
        const otherProjectTypeGroup = document.getElementById('editOtherProjectTypeGroup');
        if (projectTypeSelect && otherProjectTypeGroup) {
            projectTypeSelect.addEventListener('change', () => {
                if (projectTypeSelect.value === 'Other') {
                    otherProjectTypeGroup.style.display = 'block';
                } else {
                    otherProjectTypeGroup.style.display = 'none';
                }
            });
        }

        // Handle "Deposit Waived" checkbox
        const editDepositWaivedCheckbox = document.getElementById('editDepositWaived');
        const editDepositWaiverReasonGroup = document.getElementById('editDepositWaiverReasonGroup');
        const editDepositWaiverReasonInput = document.getElementById('editDepositWaiverReason');
        if (editDepositWaivedCheckbox && editDepositWaiverReasonGroup) {
            editDepositWaivedCheckbox.addEventListener('change', () => {
                if (editDepositWaivedCheckbox.checked) {
                    editDepositWaiverReasonGroup.style.display = 'block';
                    if (editDepositWaiverReasonInput) {
                        editDepositWaiverReasonInput.required = true;
                    }
                } else {
                    editDepositWaiverReasonGroup.style.display = 'none';
                    if (editDepositWaiverReasonInput) {
                        editDepositWaiverReasonInput.required = false;
                        editDepositWaiverReasonInput.value = '';
                    }
                }
            });
        }

        // Handle Review Comments dropdown
        const editReviewCommentsTypeSelect = document.getElementById('editReviewCommentsType');
        const editOtherReviewCommentsGroup = document.getElementById('editOtherReviewCommentsGroup');
        const editReviewCommentsInput = document.getElementById('editReviewComments');
        if (editReviewCommentsTypeSelect && editOtherReviewCommentsGroup) {
            editReviewCommentsTypeSelect.addEventListener('change', () => {
                if (editReviewCommentsTypeSelect.value === 'other') {
                    editOtherReviewCommentsGroup.style.display = 'block';
                    if (editReviewCommentsInput) {
                        editReviewCommentsInput.required = true;
                    }
                } else {
                    editOtherReviewCommentsGroup.style.display = 'none';
                    if (editReviewCommentsInput) {
                        editReviewCommentsInput.required = false;
                        editReviewCommentsInput.value = '';
                    }
                }
            });
        }

        // Handle Approval Reason dropdown
        const editApprovalReasonTypeSelect = document.getElementById('editApprovalReasonType');
        const editOtherApprovalReasonGroup = document.getElementById('editOtherApprovalReasonGroup');
        const editApprovalReasonInput = document.getElementById('editApprovalReason');
        if (editApprovalReasonTypeSelect && editOtherApprovalReasonGroup) {
            editApprovalReasonTypeSelect.addEventListener('change', () => {
                if (editApprovalReasonTypeSelect.value === 'other') {
                    editOtherApprovalReasonGroup.style.display = 'block';
                    if (editApprovalReasonInput) {
                        editApprovalReasonInput.required = true;
                    }
                } else {
                    editOtherApprovalReasonGroup.style.display = 'none';
                    if (editApprovalReasonInput) {
                        editApprovalReasonInput.required = false;
                        editApprovalReasonInput.value = '';
                    }
                }
            });
        }

        // Setup drag and drop for site conditions in edit modal
        this.setupEditSiteConditionsDragAndDrop();
        this.setupEditSubmittedPlansDragAndDrop();
    }

    setupEditModalHandlers(dialog, modalContent, projectId, project) {
        // Helper function to close dialog
        const closeDialog = () => {
            if (dialog && dialog.parentNode) {
                document.body.removeChild(dialog);
            }
        };

        // Handle generate letter button (both inline and in footer)
        const generateLetterBtn = document.getElementById('editGenerateLetterBtn');
        const generateLetterBtnInline = document.getElementById('editGenerateLetterBtnInline');
        
        const handleGenerateLetter = async () => {
            // Require authentication
            if (!this.requireAuth()) {
                return;
            }

            // Collect form data
            const homeownerName = document.getElementById('editHomeownerName')?.value.trim();
            const address = document.getElementById('editAddress')?.value.trim();
            const lot = document.getElementById('editLot')?.value.trim();
            const projectTypeSelect = document.getElementById('editProjectType');
            const projectType = projectTypeSelect?.value === 'Other' 
                ? document.getElementById('editOtherProjectType')?.value.trim() 
                : projectTypeSelect?.value;
            const contractorName = document.getElementById('editContractorName')?.value.trim();
            const approvedBy = document.getElementById('editApprovedBy')?.value.trim();
            const dateApprovedInput = document.getElementById('editDateApproved');
            const dateApproved = dateApprovedInput?.value ? this.formatDateFromInput(dateApprovedInput.value) : '';
            const noApprovalOnRecord = document.getElementById('editNoApprovalOnRecord')?.checked;
            
            // Review comments
            const reviewCommentsType = document.getElementById('editReviewCommentsType')?.value;
            const reviewComments = reviewCommentsType === 'other' 
                ? document.getElementById('editReviewComments')?.value.trim() 
                : 'The plan was reviewed for Sanctuary Setback Requirements.';
            
            // Approval reason
            const approvalReasonType = document.getElementById('editApprovalReasonType')?.value;
            const approvalReason = approvalReasonType === 'other'
                ? document.getElementById('editApprovalReason')?.value.trim()
                : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
            
            const siteConditionsFiles = document.getElementById('editSiteConditions')?.files || [];
            const submittedPlansFiles = document.getElementById('editSubmittedPlans')?.files || [];

            // Validate required fields
            if (!homeownerName || !address || !lot || !projectType) {
                alert('Please fill in all required fields (Homeowner Name, Address, Lot, Project Type) before generating the letter.');
                return;
            }

            // Prepare form data for PDF generation
            const formData = {
                ownerLastName: homeownerName.split(' ').pop() || homeownerName,
                address: address,
                lot: lot,
                projectType: projectType,
                contractorName: contractorName,
                reviewComments: reviewComments,
                approvalReason: approvalReason,
                approvedBy: approvedBy,
                approvedOn: noApprovalOnRecord ? null : (dateApproved || new Date().toISOString().split('T')[0])
            };

            // Convert site conditions files to File objects
            const siteConditionsFileArray = [];
            if (siteConditionsFiles.length > 0) {
                for (const file of Array.from(siteConditionsFiles)) {
                    siteConditionsFileArray.push(file);
                }
            }

            // Convert submitted plans files to File objects
            const submittedPlansFileArray = [];
            if (submittedPlansFiles.length > 0) {
                for (const file of Array.from(submittedPlansFiles)) {
                    submittedPlansFileArray.push(file);
                }
            }

            // Generate PDF
            try {
                if (!window.pdfGenerator) {
                    window.pdfGenerator = new PDFGenerator();
                }
                
                await window.pdfGenerator.generatePDF(formData, siteConditionsFileArray, submittedPlansFileArray);
                
                // After PDF is generated, it will be saved to the project automatically
                // Close the dialog and refresh projects
                closeDialog();
                this.renderProjects();
            } catch (error) {
                console.error('Error generating approval letter:', error);
                alert('Error generating approval letter: ' + error.message);
            }
        };

        if (generateLetterBtn) {
            generateLetterBtn.addEventListener('click', handleGenerateLetter);
        }
        if (generateLetterBtnInline) {
            generateLetterBtnInline.addEventListener('click', handleGenerateLetter);
        }

        // Handle cancel
        const cancelBtn = document.getElementById('editCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeDialog();
            });
        } else {
            console.error('Cancel button not found in edit modal');
        }

        // Handle save
        const saveBtn = document.getElementById('editSaveBtn');
        if (!saveBtn) {
            console.error('Save button not found in edit modal');
            return;
        }
        
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const homeownerName = document.getElementById('editHomeownerName').value.trim();
            const address = document.getElementById('editAddress').value.trim();
            const lot = document.getElementById('editLot').value.trim();
            const projectTypeSelect = document.getElementById('editProjectType');
            const projectType = projectTypeSelect.value === 'Other' 
                ? document.getElementById('editOtherProjectType').value.trim() 
                : projectTypeSelect.value;
            const contractorName = document.getElementById('editContractorName').value.trim();
            const approvedBy = document.getElementById('editApprovedBy').value.trim();
            const dateApprovedInput = document.getElementById('editDateApproved');
            const dateApproved = dateApprovedInput.value ? this.formatDateFromInput(dateApprovedInput.value) : '';
            const noApprovalOnRecord = document.getElementById('editNoApprovalOnRecord').checked;
            const dateStarted = document.getElementById('editDateStarted').value.trim();
            const status = document.getElementById('editStatus').value;
            const depositReceived = document.getElementById('editDepositReceived').value.trim();
            const dateDepositReceived = document.getElementById('editDateDepositReceived').value.trim();
            const depositReturned = document.getElementById('editDepositReturned').value.trim();
            const dateDepositReturned = document.getElementById('editDateDepositReturned').value.trim();
            const depositWaived = document.getElementById('editDepositWaived').checked;
            const depositWaiverReason = document.getElementById('editDepositWaiverReason').value.trim();
            const approvalLetterFile = document.getElementById('editApprovalLetter').files[0];
            
            // Review comments
            const reviewCommentsType = document.getElementById('editReviewCommentsType')?.value;
            const reviewComments = reviewCommentsType === 'other' 
                ? document.getElementById('editReviewComments')?.value.trim() 
                : 'The plan was reviewed for Sanctuary Setback Requirements.';
            
            // Approval reason
            const approvalReasonType = document.getElementById('editApprovalReasonType')?.value;
            const approvalReason = approvalReasonType === 'other'
                ? document.getElementById('editApprovalReason')?.value.trim()
                : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
            
            const siteConditionsFiles = document.getElementById('editSiteConditions')?.files || [];
            const submittedPlansFiles = document.getElementById('editSubmittedPlans')?.files || [];

            // Validate waiver reason if deposit is waived
            if (depositWaived && !depositWaiverReason) {
                alert('Waiver reason is required when deposit is waived');
                return;
            }
            if (reviewCommentsType === 'other' && !reviewComments) {
                alert('Please specify the review comments');
                return;
            }
            if (approvalReasonType === 'other' && !approvalReason) {
                alert('Please specify the approval reason');
                return;
            }

            // Handle file removals
            const filesToRemove = project.filesToRemove || { siteConditions: [], submittedPlans: [], approvalLetter: false };
            
            // Read site conditions files - filter out removed ones and add new ones
            let siteConditionsArrayBuffers = (project.siteConditionsFiles || []).filter((file, index) => {
                // Keep files that are not marked for removal
                return !filesToRemove.siteConditions.includes(index);
            });
            
            // Add new files
            if (siteConditionsFiles.length > 0) {
                for (const file of Array.from(siteConditionsFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        siteConditionsArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading site conditions file:', error);
                    }
                }
            }

            // Read submitted plans files - filter out removed ones and add new ones
            let submittedPlansArrayBuffers = (project.submittedPlansFiles || []).filter((file, index) => {
                // Keep files that are not marked for removal
                return !filesToRemove.submittedPlans.includes(index);
            });
            
            // Add new files
            if (submittedPlansFiles.length > 0) {
                for (const file of Array.from(submittedPlansFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        submittedPlansArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading submitted plans file:', error);
                    }
                }
            }
            
            // Handle approval letter removal or new upload
            let approvalLetterBlob = null;
            let approvalLetterFilename = '';
            if (filesToRemove.approvalLetter) {
                // Approval letter is marked for removal
                approvalLetterBlob = null;
                approvalLetterFilename = '';
            } else if (approvalLetterFile) {
                // New approval letter file uploaded
                try {
                    approvalLetterBlob = await approvalLetterFile.arrayBuffer();
                    approvalLetterFilename = approvalLetterFile.name;
                } catch (error) {
                    console.error('Error reading approval letter file:', error);
                    alert('Error reading approval letter file: ' + error.message);
                    return;
                }
            } else {
                // Keep existing approval letter
                approvalLetterBlob = project.approvalLetterBlob || null;
                approvalLetterFilename = project.approvalLetterFilename || '';
            }

            const updates = {
                homeownerName: homeownerName,
                address: address,
                lot: lot,
                projectType: projectType,
                contractorName: contractorName,
                approvedBy: approvedBy,
                dateApproved: noApprovalOnRecord ? '' : dateApproved,
                noApprovalOnRecord: noApprovalOnRecord,
                dateConstructionStarted: dateStarted,
                status: status,
                reviewComments: reviewComments,
                approvalReason: approvalReason,
                siteConditionsFiles: siteConditionsArrayBuffers,
                submittedPlansFiles: submittedPlansArrayBuffers,
                depositAmountReceived: depositReceived ? parseFloat(depositReceived) : null,
                dateDepositReceived: dateDepositReceived,
                depositAmountReturned: depositReturned ? parseFloat(depositReturned) : null,
                dateDepositReturned: dateDepositReturned,
                depositWaived: depositWaived,
                depositWaiverReason: depositWaiverReason
            };

            // Handle approval letter
            if (approvalLetterBlob !== null) {
                updates.approvalLetterBlob = approvalLetterBlob;
                updates.approvalLetterFilename = approvalLetterFilename;
            } else if (filesToRemove.approvalLetter) {
                // Approval letter is being removed
                updates.approvalLetterBlob = null;
                updates.approvalLetterFilename = '';
                updates.hasApprovalLetter = false;
            }

            try {
                await this.updateProject(projectId, updates);
                // Clear filesToRemove after successful save
                if (project.filesToRemove) {
                    project.filesToRemove = { siteConditions: [], submittedPlans: [], approvalLetter: false };
                }
                closeDialog();
                // Refresh projects to show updated file list
                this.renderProjects();
            } catch (error) {
                console.error('Error updating project:', error);
                alert('Failed to update project: ' + error.message);
            }
        });
    }

    setupEditModalHandlers(dialog, modalContent, projectId, project) {
        // Helper function to close dialog
        const closeDialog = () => {
            if (dialog && dialog.parentNode) {
                document.body.removeChild(dialog);
            }
        };

        // Handle generate letter button (both inline and in footer)
        const generateLetterBtn = document.getElementById('editGenerateLetterBtn');
        const generateLetterBtnInline = document.getElementById('editGenerateLetterBtnInline');
        
        const handleGenerateLetter = async () => {
            // Require authentication
            if (!this.requireAuth()) {
                return;
            }

            // Collect form data
            const homeownerName = document.getElementById('editHomeownerName')?.value.trim();
            const address = document.getElementById('editAddress')?.value.trim();
            const lot = document.getElementById('editLot')?.value.trim();
            const projectTypeSelect = document.getElementById('editProjectType');
            const projectType = projectTypeSelect?.value === 'Other' 
                ? document.getElementById('editOtherProjectType')?.value.trim() 
                : projectTypeSelect?.value;
            const contractorName = document.getElementById('editContractorName')?.value.trim();
            const approvedBy = document.getElementById('editApprovedBy')?.value.trim();
            const dateApprovedInput = document.getElementById('editDateApproved');
            const dateApproved = dateApprovedInput?.value ? this.formatDateFromInput(dateApprovedInput.value) : '';
            const noApprovalOnRecord = document.getElementById('editNoApprovalOnRecord')?.checked;
            
            // Review comments
            const reviewCommentsType = document.getElementById('editReviewCommentsType')?.value;
            const reviewComments = reviewCommentsType === 'other' 
                ? document.getElementById('editReviewComments')?.value.trim() 
                : 'The plan was reviewed for Sanctuary Setback Requirements.';
            
            // Approval reason
            const approvalReasonType = document.getElementById('editApprovalReasonType')?.value;
            const approvalReason = approvalReasonType === 'other'
                ? document.getElementById('editApprovalReason')?.value.trim()
                : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
            
            const siteConditionsFiles = document.getElementById('editSiteConditions')?.files || [];
            const submittedPlansFiles = document.getElementById('editSubmittedPlans')?.files || [];

            // Validate required fields
            if (!homeownerName || !address || !lot || !projectType) {
                alert('Please fill in all required fields (Homeowner Name, Address, Lot, Project Type) before generating the letter.');
                return;
            }

            // Prepare form data for PDF generation
            const formData = {
                ownerLastName: homeownerName.split(' ').pop() || homeownerName,
                address: address,
                lot: lot,
                projectType: projectType,
                contractorName: contractorName,
                reviewComments: reviewComments,
                approvalReason: approvalReason,
                approvedBy: approvedBy,
                approvedOn: noApprovalOnRecord ? null : (dateApproved || new Date().toISOString().split('T')[0])
            };

            // Convert site conditions files to File objects
            const siteConditionsFileArray = [];
            if (siteConditionsFiles.length > 0) {
                for (const file of Array.from(siteConditionsFiles)) {
                    siteConditionsFileArray.push(file);
                }
            }

            // Convert submitted plans files to File objects
            const submittedPlansFileArray = [];
            if (submittedPlansFiles.length > 0) {
                for (const file of Array.from(submittedPlansFiles)) {
                    submittedPlansFileArray.push(file);
                }
            }

            // Generate PDF
            try {
                if (!window.pdfGenerator) {
                    window.pdfGenerator = new PDFGenerator();
                }
                
                await window.pdfGenerator.generatePDF(formData, siteConditionsFileArray, submittedPlansFileArray);
                
                // After PDF is generated, it will be saved to the project automatically
                // Close the dialog and refresh projects
                closeDialog();
                this.renderProjects();
            } catch (error) {
                console.error('Error generating approval letter:', error);
                alert('Error generating approval letter: ' + error.message);
            }
        };

        if (generateLetterBtn) {
            generateLetterBtn.addEventListener('click', handleGenerateLetter);
        }
        if (generateLetterBtnInline) {
            generateLetterBtnInline.addEventListener('click', handleGenerateLetter);
        }

        // Handle cancel
        const cancelBtn = document.getElementById('editCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeDialog();
            });
        } else {
            console.error('Cancel button not found in edit modal');
        }

        // Handle save
        const saveBtn = document.getElementById('editSaveBtn');
        if (!saveBtn) {
            console.error('Save button not found in edit modal');
            return;
        }
        
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const homeownerName = document.getElementById('editHomeownerName')?.value.trim();
            const address = document.getElementById('editAddress')?.value.trim();
            const lot = document.getElementById('editLot')?.value.trim();
            const projectTypeSelect = document.getElementById('editProjectType');
            const projectType = projectTypeSelect?.value === 'Other' 
                ? document.getElementById('editOtherProjectType')?.value.trim() 
                : projectTypeSelect?.value;
            const contractorName = document.getElementById('editContractorName')?.value.trim();
            const approvedBy = document.getElementById('editApprovedBy')?.value.trim();
            const dateApprovedInput = document.getElementById('editDateApproved');
            const dateApproved = dateApprovedInput?.value ? this.formatDateFromInput(dateApprovedInput.value) : '';
            const noApprovalOnRecord = document.getElementById('editNoApprovalOnRecord')?.checked;
            const dateStarted = document.getElementById('editDateStarted')?.value.trim();
            const status = document.getElementById('editStatus')?.value;
            const depositReceived = document.getElementById('editDepositReceived')?.value.trim();
            const dateDepositReceived = document.getElementById('editDateDepositReceived')?.value.trim();
            const depositReturned = document.getElementById('editDepositReturned')?.value.trim();
            const dateDepositReturned = document.getElementById('editDateDepositReturned')?.value.trim();
            const depositWaived = document.getElementById('editDepositWaived')?.checked;
            const depositWaiverReason = document.getElementById('editDepositWaiverReason')?.value.trim();
            const approvalLetterFile = document.getElementById('editApprovalLetter')?.files[0];
            
            // Review comments
            const reviewCommentsType = document.getElementById('editReviewCommentsType')?.value;
            const reviewComments = reviewCommentsType === 'other' 
                ? document.getElementById('editReviewComments')?.value.trim() 
                : 'The plan was reviewed for Sanctuary Setback Requirements.';
            
            // Approval reason
            const approvalReasonType = document.getElementById('editApprovalReasonType')?.value;
            const approvalReason = approvalReasonType === 'other'
                ? document.getElementById('editApprovalReason')?.value.trim()
                : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';
            
            const siteConditionsFiles = document.getElementById('editSiteConditions')?.files || [];
            const submittedPlansFiles = document.getElementById('editSubmittedPlans')?.files || [];

            // Validate waiver reason if deposit is waived
            if (depositWaived && !depositWaiverReason) {
                alert('Waiver reason is required when deposit is waived');
                return;
            }
            if (reviewCommentsType === 'other' && !reviewComments) {
                alert('Please specify the review comments');
                return;
            }
            if (approvalReasonType === 'other' && !approvalReason) {
                alert('Please specify the approval reason');
                return;
            }

            // Read site conditions files if provided
            let siteConditionsArrayBuffers = project.siteConditionsFiles || [];
            if (siteConditionsFiles.length > 0) {
                siteConditionsArrayBuffers = [];
                for (const file of Array.from(siteConditionsFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        siteConditionsArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading site conditions file:', error);
                    }
                }
            }

            // Read submitted plans files if provided
            let submittedPlansArrayBuffers = project.submittedPlansFiles || [];
            if (submittedPlansFiles.length > 0) {
                submittedPlansArrayBuffers = [];
                for (const file of Array.from(submittedPlansFiles)) {
                    try {
                        const arrayBuffer = await this.readFileAsArrayBuffer(file);
                        submittedPlansArrayBuffers.push({
                            name: file.name,
                            type: file.type,
                            data: arrayBuffer
                        });
                    } catch (error) {
                        console.error('Error reading submitted plans file:', error);
                    }
                }
            }

            const updates = {
                homeownerName: homeownerName,
                address: address,
                lot: lot,
                projectType: projectType,
                contractorName: contractorName,
                approvedBy: approvedBy,
                dateApproved: noApprovalOnRecord ? '' : dateApproved,
                noApprovalOnRecord: noApprovalOnRecord,
                dateConstructionStarted: dateStarted,
                status: status,
                reviewComments: reviewComments,
                approvalReason: approvalReason,
                siteConditionsFiles: siteConditionsArrayBuffers,
                submittedPlansFiles: submittedPlansArrayBuffers,
                depositAmountReceived: depositReceived ? parseFloat(depositReceived) : null,
                dateDepositReceived: dateDepositReceived,
                depositAmountReturned: depositReturned ? parseFloat(depositReturned) : null,
                dateDepositReturned: dateDepositReturned,
                depositWaived: depositWaived,
                depositWaiverReason: depositWaiverReason
            };

            // Handle file upload if provided
            if (approvalLetterFile) {
                try {
                    const arrayBuffer = await approvalLetterFile.arrayBuffer();
                    updates.approvalLetterBlob = arrayBuffer;
                    updates.approvalLetterFilename = approvalLetterFile.name;
                } catch (error) {
                    console.error('Error reading file:', error);
                    alert('Error reading approval letter file: ' + error.message);
                    return;
                }
            }

            try {
                await this.updateProject(projectId, updates);
                closeDialog();
            } catch (error) {
                console.error('Error updating project:', error);
                alert('Failed to update project: ' + error.message);
            }
        });
    }

    formatDateFromInput(dateStr) {
        // Convert YYYY-MM-DD to MM/DD/YYYY
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return dateStr;
    }

    setupEditSiteConditionsDragAndDrop() {
        const dropZone = document.getElementById('editSiteConditionsDropZone');
        const fileInput = document.getElementById('editSiteConditions');
        const dropZoneContent = document.getElementById('editSiteConditionsDropZoneContent');
        const fileList = document.getElementById('editSiteConditionsDropZoneFileList');

        if (dropZone && fileInput) {
            // Click to browse
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#2c5530';
                    dropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#ddd';
                    dropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    const validFiles = files.filter(file => 
                        file.type === 'application/pdf' || 
                        file.type.startsWith('image/') ||
                        file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png)$/i)
                    );
                    
                    if (validFiles.length > 0) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        validFiles.forEach(file => dataTransfer.items.add(file));
                        fileInput.files = dataTransfer.files;
                        
                        // Update UI to show file names
                        this.updateSiteConditionsFileList(validFiles, dropZoneContent, fileList);
                    } else {
                        alert('Please upload PDF or image files (JPG, PNG).');
                    }
                }
            });

            // Handle file selection via click
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    this.updateSiteConditionsFileList(files, dropZoneContent, fileList);
                } else {
                    this.updateSiteConditionsFileList([], dropZoneContent, fileList);
                }
            });
        }
    }

    setupEditSubmittedPlansDragAndDrop() {
        const dropZone = document.getElementById('editSubmittedPlansDropZone');
        const fileInput = document.getElementById('editSubmittedPlans');
        const dropZoneContent = document.getElementById('editSubmittedPlansDropZoneContent');
        const fileList = document.getElementById('editSubmittedPlansDropZoneFileList');

        if (dropZone && fileInput) {
            // Click to browse
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when dragging over
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#2c5530';
                    dropZone.style.background = '#e8f5e9';
                });
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = '#ddd';
                    dropZone.style.background = '#fafafa';
                });
            });

            // Handle dropped files
            dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    const validFiles = files.filter(file => 
                        file.type === 'application/pdf' || 
                        file.type.startsWith('image/') ||
                        file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|doc|docx)$/i)
                    );
                    
                    if (validFiles.length > 0) {
                        // Create a new FileList using DataTransfer
                        const dataTransfer = new DataTransfer();
                        validFiles.forEach(file => dataTransfer.items.add(file));
                        fileInput.files = dataTransfer.files;
                        
                        // Update UI to show file names
                        this.updateSubmittedPlansFileList(validFiles, dropZoneContent, fileList);
                    } else {
                        alert('Please upload PDF, image, or document files (JPG, PNG, DOC, DOCX).');
                    }
                }
            });

            // Handle file selection via click
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    this.updateSubmittedPlansFileList(files, dropZoneContent, fileList);
                } else {
                    this.updateSubmittedPlansFileList([], dropZoneContent, fileList);
                }
            });
        }
    }
}

// Initialize project manager
window.projectManager = new ProjectManager();

