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
        // Handle project type change
        this.projectTypeSelect.addEventListener('change', () => {
            this.handleProjectTypeChange();
        });

        // Handle review comments type change
        this.reviewCommentsTypeSelect.addEventListener('change', () => {
            this.handleReviewCommentsTypeChange();
        });

        // Handle approval reason type change
        this.approvalReasonTypeSelect.addEventListener('change', () => {
            this.handleApprovalReasonTypeChange();
        });

        // Handle form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateForm()) {
                this.handleSubmit();
            }
        });

        // Real-time validation
        this.setupRealTimeValidation();
    }

    handleProjectTypeChange() {
        const selectedType = this.projectTypeSelect.value;
        if (selectedType === 'Other') {
            this.otherProjectTypeGroup.style.display = 'block';
            this.otherProjectTypeInput.required = true;
        } else {
            this.otherProjectTypeGroup.style.display = 'none';
            this.otherProjectTypeInput.required = false;
            this.otherProjectTypeInput.value = '';
            this.clearError('otherProjectType');
        }
    }

    handleReviewCommentsTypeChange() {
        const selectedType = this.reviewCommentsTypeSelect.value;
        if (selectedType === 'other') {
            this.otherReviewCommentsGroup.style.display = 'block';
            this.reviewCommentsInput.required = true;
        } else {
            this.otherReviewCommentsGroup.style.display = 'none';
            this.reviewCommentsInput.required = false;
            this.reviewCommentsInput.value = '';
            this.clearError('reviewComments');
        }
    }

    handleApprovalReasonTypeChange() {
        const selectedType = this.approvalReasonTypeSelect.value;
        if (selectedType === 'other') {
            this.otherApprovalReasonGroup.style.display = 'block';
            this.approvalReasonInput.required = true;
        } else {
            this.otherApprovalReasonGroup.style.display = 'none';
            this.approvalReasonInput.required = false;
            this.approvalReasonInput.value = '';
            this.clearError('approvalReason');
        }
    }

    setupRealTimeValidation() {
        const fields = ['address', 'lot', 'projectType', 'reviewCommentsType', 'approvalReasonType'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(fieldId);
                });
            }
        });

        // Special handling for conditional fields
        this.otherProjectTypeInput.addEventListener('blur', () => {
            if (this.projectTypeSelect.value === 'Other') {
                this.validateField('otherProjectType');
            }
        });

        this.reviewCommentsInput.addEventListener('blur', () => {
            if (this.reviewCommentsTypeSelect.value === 'other') {
                this.validateField('reviewComments');
            }
        });

        this.approvalReasonInput.addEventListener('blur', () => {
            if (this.approvalReasonTypeSelect.value === 'other') {
                this.validateField('approvalReason');
            }
        });
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
        if (fieldId === 'otherProjectType' && this.projectTypeSelect.value === 'Other') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Please specify the project type';
            }
        }

        // Special validation for "Other" review comments
        if (fieldId === 'reviewComments' && this.reviewCommentsTypeSelect.value === 'other') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Please specify the review comments';
            }
        }

        // Special validation for "Other" approval reason
        if (fieldId === 'approvalReason' && this.approvalReasonTypeSelect.value === 'other') {
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
        const fields = ['address', 'lot', 'projectType', 'reviewCommentsType', 'approvalReasonType'];
        
        // Validate all standard fields
        fields.forEach(fieldId => {
            if (!this.validateField(fieldId)) {
                isValid = false;
            }
        });

        // Validate "Other" project type if selected
        if (this.projectTypeSelect.value === 'Other') {
            if (!this.validateField('otherProjectType')) {
                isValid = false;
            }
        }

        // Validate "Other" review comments if selected
        if (this.reviewCommentsTypeSelect.value === 'other') {
            if (!this.validateField('reviewComments')) {
                isValid = false;
            }
        }

        // Validate "Other" approval reason if selected
        if (this.approvalReasonTypeSelect.value === 'other') {
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
        const reviewComments = this.reviewCommentsTypeSelect.value === 'other'
            ? this.reviewCommentsInput.value.trim()
            : 'The plan was reviewed for Sanctuary Setback Requirements';

        // Get approval reason - use default or custom
        const approvalReason = this.approvalReasonTypeSelect.value === 'other'
            ? this.approvalReasonInput.value.trim()
            : 'The project meets Sanctuary Setback Requirements. No variances are required. Approved.';

        return {
            address: document.getElementById('address').value.trim(),
            lot: document.getElementById('lot').value.trim(),
            projectType: projectType,
            reviewComments: reviewComments,
            approvalReason: approvalReason
        };
    }

    handleSubmit() {
        const formData = this.getFormData();
        const files = window.fileHandler ? window.fileHandler.getFiles() : [];
        
        // Trigger PDF generation
        if (window.pdfGenerator) {
            window.pdfGenerator.generatePDF(formData, files);
        } else {
            console.error('PDF Generator not initialized');
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

