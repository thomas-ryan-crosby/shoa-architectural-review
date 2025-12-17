// Project Manager - Handles project tracking and storage

class ProjectManager {
    constructor() {
        this.storageKey = 'shoa_projects';
        this.projects = this.loadProjects();
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        // Setup tab switching
        this.setupTabs();
        
        // Setup filters
        this.setupFilters();
        
        // Setup add project form
        this.setupAddProjectForm();
        
        // Render projects
        this.renderProjects();
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
        if (form) {
            form.reset();
            // Clear error messages
            const errorMessages = form.querySelectorAll('.error-message');
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
            
            // Format date for display
            const formattedDateApproved = this.formatDate(dateApproved);
            const formattedDateStarted = dateConstructionStarted ? this.formatDate(dateConstructionStarted) : '';

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
                approvalLetterFilename: approvalLetterFile.name
            };

            this.projects.unshift(project);
            this.saveProjects();
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

    loadProjects() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading projects:', error);
            return [];
        }
    }

    saveProjects() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.projects));
        } catch (error) {
            console.error('Error saving projects:', error);
        }
    }

    addProject(projectData) {
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
            approvalLetterFilename: projectData.approvalLetterFilename || ''
        };

        this.projects.unshift(project); // Add to beginning
        this.saveProjects();
        this.renderProjects();
        
        return project;
    }

    updateProject(projectId, updates) {
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            Object.assign(project, updates);
            this.saveProjects();
            this.renderProjects();
        }
    }

    deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project?')) {
            this.projects = this.projects.filter(p => p.id !== projectId);
            this.saveProjects();
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

        const dateStarted = prompt('Enter construction start date (MM/DD/YYYY) or leave blank:', project.dateConstructionStarted || '');
        if (dateStarted !== null) {
            const status = prompt('Status (open/previous):', project.status || 'open');
            if (status !== null) {
                this.updateProject(projectId, {
                    dateConstructionStarted: dateStarted.trim(),
                    status: status.trim().toLowerCase() === 'previous' ? 'previous' : 'open'
                });
            }
        }
    }
}

// Initialize project manager
window.projectManager = new ProjectManager();

