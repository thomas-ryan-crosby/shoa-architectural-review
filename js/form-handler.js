// Form Handler - Handles form validation and submission

class FormHandler {
    constructor() {
        this.form = document.getElementById('reviewForm');
        this.projectTypeSelect = document.getElementById('projectType');
        this.otherProjectTypeGroup = document.getElementById('otherProjectTypeGroup');
        this.otherProjectTypeInput = document.getElementById('otherProjectType');
        
        this.init();
    }

    init() {
        // Handle project type change
        this.projectTypeSelect.addEventListener('change', () => {
            this.handleProjectTypeChange();
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

    setupRealTimeValidation() {
        const fields = ['address', 'lot', 'projectType', 'reviewComments', 'approvalReason'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(fieldId);
                });
            }
        });

        // Special handling for other project type
        this.otherProjectTypeInput.addEventListener('blur', () => {
            if (this.projectTypeSelect.value === 'Other') {
                this.validateField('otherProjectType');
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
        const fields = ['address', 'lot', 'projectType', 'reviewComments', 'approvalReason'];
        
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

        return {
            address: document.getElementById('address').value.trim(),
            lot: document.getElementById('lot').value.trim(),
            projectType: projectType,
            reviewComments: document.getElementById('reviewComments').value.trim(),
            approvalReason: document.getElementById('approvalReason').value.trim()
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
        this.otherProjectTypeGroup.style.display = 'none';
        this.otherProjectTypeInput.required = false;
        
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

