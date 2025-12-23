// Form Handler - Handles form validation and submission

class FormHandler {
    constructor() {
        this.form = document.getElementById('reviewForm');
        this.projectTypeSelect = document.getElementById('projectType');
        this.otherProjectTypeGroup = document.getElementById('otherProjectTypeGroup');
        this.otherProjectTypeInput = document.getElementById('otherProjectType');
        
        // Review Comments dropdown
        this.reviewCommentsTypeSelect = document.getElementById('reviewCommentsType');
        this.otherReviewCommentsGroup = document.getElementById('otherReviewCommentsGroup');
        this.reviewCommentsInput = document.getElementById('reviewComments');
        
        // Approval Reason dropdown
        this.approvalReasonTypeSelect = document.getElementById('approvalReasonType');
        this.otherApprovalReasonGroup = document.getElementById('otherApprovalReasonGroup');
        this.approvalReasonInput = document.getElementById('approvalReason');
        
        this.init();
    }

    init() {
        // Check if form exists (it may not exist if Generate Letter tab was removed)
        if (!this.form) {
            console.warn('FormHandler: reviewForm not found. Form may have been removed.');
            return;
        }

        // Handle project type change
        if (this.projectTypeSelect) {
            this.projectTypeSelect.addEventListener('change', () => {
                this.handleProjectTypeChange();
            });
        }

        // Handle review comments type change
        if (this.reviewCommentsTypeSelect) {
            this.reviewCommentsTypeSelect.addEventListener('change', () => {
            this.handleReviewCommentsTypeChange();
        });

        // Handle approval reason type change
        if (this.approvalReasonTypeSelect) {
            this.approvalReasonTypeSelect.addEventListener('change', () => {
                this.handleApprovalReasonTypeChange();
            });
        }

        // Handle form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.validateForm()) {
                    this.handleSubmit();
                }
            });
        }

        // Real-time validation
        this.setupRealTimeValidation();
    }

    handleProjectTypeChange() {
        if (!this.projectTypeSelect) return;
        const selectedType = this.projectTypeSelect.value;
        if (selectedType === 'Other') {
            if (this.otherProjectTypeGroup) this.otherProjectTypeGroup.style.display = 'block';
            if (this.otherProjectTypeInput) this.otherProjectTypeInput.required = true;
        } else {
            if (this.otherProjectTypeGroup) this.otherProjectTypeGroup.style.display = 'none';
            if (this.otherProjectTypeInput) {
                this.otherProjectTypeInput.required = false;
                this.otherProjectTypeInput.value = '';
            }
            this.clearError('otherProjectType');
        }
    }

    handleReviewCommentsTypeChange() {
        if (!this.reviewCommentsTypeSelect) return;
        const selectedType = this.reviewCommentsTypeSelect.value;
        if (selectedType === 'other') {
            if (this.otherReviewCommentsGroup) this.otherReviewCommentsGroup.style.display = 'block';
            if (this.reviewCommentsInput) this.reviewCommentsInput.required = true;
        } else {
            if (this.otherReviewCommentsGroup) this.otherReviewCommentsGroup.style.display = 'none';
            if (this.reviewCommentsInput) {
                this.reviewCommentsInput.required = false;
                this.reviewCommentsInput.value = '';
            }
            this.clearError('reviewComments');
        }
    }

    handleApprovalReasonTypeChange() {
        if (!this.approvalReasonTypeSelect) return;
        const selectedType = this.approvalReasonTypeSelect.value;
        if (selectedType === 'other') {
            if (this.otherApprovalReasonGroup) this.otherApprovalReasonGroup.style.display = 'block';
            if (this.approvalReasonInput) this.approvalReasonInput.required = true;
        } else {
            if (this.otherApprovalReasonGroup) this.otherApprovalReasonGroup.style.display = 'none';
            if (this.approvalReasonInput) {
                this.approvalReasonInput.required = false;
                this.approvalReasonInput.value = '';
            }
            this.clearError('approvalReason');
        }
    }

    setupRealTimeValidation() {
        const fields = ['ownerLastName', 'address', 'lot', 'projectType', 'reviewCommentsType', 'approvalReasonType'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(fieldId);
                });
            }
        });

        // Special handling for conditional fields
        if (this.otherProjectTypeInput) {
            this.otherProjectTypeInput.addEventListener('blur', () => {
                if (this.projectTypeSelect && this.projectTypeSelect.value === 'Other') {
                    this.validateField('otherProjectType');
                }
            });
        }

        if (this.reviewCommentsInput) {
            this.reviewCommentsInput.addEventListener('blur', () => {
                if (this.reviewCommentsTypeSelect && this.reviewCommentsTypeSelect.value === 'other') {
                    this.validateField('reviewComments');
                }
            });
        }

        if (this.approvalReasonInput) {
            this.approvalReasonInput.addEventListener('blur', () => {
                if (this.approvalReasonTypeSelect && this.approvalReasonTypeSelect.value === 'other') {
                    this.validateField('approvalReason');
                }
            });
        }
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (!field) return true;

        let isValid = true;
        let errorMessage = '';

        // Check if required field is empty
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Special validation for "Other" project type
        if (fieldId === 'otherProjectType' && this.projectTypeSelect && this.projectTypeSelect.value === 'Other') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Please specify the project type';
            }
        }

        // Special validation for "Other" review comments
        if (fieldId === 'reviewComments' && this.reviewCommentsTypeSelect && this.reviewCommentsTypeSelect.value === 'other') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Please specify the review comments';
            }
        }

        // Special validation for "Other" approval reason
        if (fieldId === 'approvalReason' && this.approvalReasonTypeSelect && this.approvalReasonTypeSelect.value === 'other') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Please specify the approval reason';
            }
        }

        // Update UI
        if (isValid) {
            field.classList.remove('error');
            if (errorElement) errorElement.textContent = '';
        } else {
            field.classList.add('error');
            if (errorElement) errorElement.textContent = errorMessage;
        }

        return isValid;
    }

    validateForm() {
        let isValid = true;
        const fields = ['ownerLastName', 'address', 'lot', 'projectType', 'reviewCommentsType', 'approvalReasonType'];
        
        // Validate all standard fields
        fields.forEach(fieldId => {
            if (!this.validateField(fieldId)) {
                isValid = false;
            }
        });

        // Validate "Other" project type if selected
        if (this.projectTypeSelect && this.projectTypeSelect.value === 'Other') {
            if (!this.validateField('otherProjectType')) {
                isValid = false;
            }
        }

        // Validate "Other" review comments if selected
        if (this.reviewCommentsTypeSelect && this.reviewCommentsTypeSelect.value === 'other') {
            if (!this.validateField('reviewComments')) {
                isValid = false;
            }
        }

        // Validate "Other" approval reason if selected
        if (this.approvalReasonTypeSelect && this.approvalReasonTypeSelect.value === 'other') {
            if (!this.validateField('approvalReason')) {
                isValid = false;
            }
        }

        return isValid;
    }

    clearError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.remove('error');
        }
        if (errorElement) {
            errorElement.textContent = '';
        }
    }

    getFormData() {
        const projectType = this.projectTypeSelect.value === 'Other' 
            ? this.otherProjectTypeInput.value.trim()
            : this.projectTypeSelect.value;

        // Get review comments - use default or custom
        const reviewComments = (this.reviewCommentsTypeSelect && this.reviewCommentsTypeSelect.value === 'other')
            ? (this.reviewCommentsInput ? this.reviewCommentsInput.value.trim() : '')
            : 'The plan was reviewed for Sanctuary Setback Requirements.';

        // Get approval reason - use default or custom
        const approvalReason = (this.approvalReasonTypeSelect && this.approvalReasonTypeSelect.value === 'other')
            ? (this.approvalReasonInput ? this.approvalReasonInput.value.trim() : '')
            : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';

        // Get approved on date, or use today's date if not provided
        const approvedOnInput = document.getElementById('approvedOn');
        let approvedOn = '';
        if (approvedOnInput && approvedOnInput.value) {
            // Convert YYYY-MM-DD to Date object
            const date = new Date(approvedOnInput.value);
            approvedOn = date;
        } else {
            // Use today's date if not provided
            approvedOn = new Date();
        }

        return {
            address: document.getElementById('address').value.trim(),
            lot: document.getElementById('lot').value.trim(),
            ownerLastName: document.getElementById('ownerLastName').value.trim(),
            contractorName: document.getElementById('contractorName').value.trim(),
            projectType: projectType,
            reviewComments: reviewComments,
            approvalReason: approvalReason,
            approvedBy: document.getElementById('approvedBy').value.trim(),
            approvedOn: approvedOn
        };
    }

    handleSubmit() {
        // Require authentication for generating approval letters
        if (!window.authHandler || !window.authHandler.isAuthenticated()) {
            alert('Please sign in to generate approval letters.');
            if (window.authHandler) {
                window.authHandler.showLogin();
            }
            return;
        }

        const formData = this.getFormData();
        const siteConditionsFiles = window.fileHandler ? window.fileHandler.getSiteConditionsFiles() : [];
        const projectFiles = window.fileHandler ? window.fileHandler.getProjectFiles() : [];
        
        // Ensure PDF generator is initialized
        if (!window.pdfGenerator) {
            console.warn('PDF Generator not initialized, attempting to initialize...');
            // Check if PDFGenerator class is available
            if (typeof PDFGenerator !== 'undefined') {
                window.pdfGenerator = new PDFGenerator();
            } else {
                console.error('PDFGenerator class not found. Scripts may not be loaded in correct order.');
                alert('Error: PDF Generator could not be initialized. Please refresh the page and try again.');
                return;
            }
        }
        
        // Verify jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            console.error('jsPDF library not loaded');
            alert('Error: PDF library not loaded. Please refresh the page and try again.');
            return;
        }
        
        // Trigger PDF generation with separate file lists
        if (window.pdfGenerator && typeof window.pdfGenerator.generatePDF === 'function') {
            window.pdfGenerator.generatePDF(formData, siteConditionsFiles, projectFiles);
        } else {
            console.error('PDF Generator not properly initialized');
            alert('Error: PDF Generator not ready. Please refresh the page and try again.');
        }
    }

    resetForm() {
        this.form.reset();
        
        // Reset project type
        this.otherProjectTypeGroup.style.display = 'none';
        this.otherProjectTypeInput.required = false;
        
        // Reset review comments
        this.otherReviewCommentsGroup.style.display = 'none';
        this.reviewCommentsInput.required = false;
        
        // Reset approval reason
        this.otherApprovalReasonGroup.style.display = 'none';
        this.approvalReasonInput.required = false;
        
        // Clear all errors
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.textContent = '');
        
        const errorFields = document.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.formHandler = new FormHandler();
    });
} else {
    window.formHandler = new FormHandler();
}

