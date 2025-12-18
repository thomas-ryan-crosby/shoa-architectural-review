// Main Application - Initializes and coordinates all components

class App {
    constructor() {
        this.init();
    }

    init() {
        // Wait for all components to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupApp();
            });
        } else {
            this.setupApp();
        }
    }

    setupApp() {
        // Verify all components are loaded (with delay to allow async initialization)
        setTimeout(() => {
            if (!window.formHandler) {
                console.warn('FormHandler not initialized');
            }
            if (!window.fileHandler) {
                console.warn('FileHandler not initialized - this may be normal if elements are in hidden tabs');
            }
            if (!window.pdfGenerator) {
                console.warn('PDFGenerator not initialized');
            }
        }, 500);

        // Check for required libraries
        if (typeof window.jspdf === 'undefined') {
            console.error('jsPDF library not loaded');
        }
        if (typeof PDFLib === 'undefined') {
            console.error('PDFLib library not loaded');
        }

        // Setup standards modal
        this.setupStandardsModal();

        console.log('Sanctuary HOA Architectural Review Generator initialized');
    }

    setupStandardsModal() {
        const standardsButton = document.getElementById('standardsButton');
        const standardsModal = document.getElementById('standardsModal');
        const closeModal = document.getElementById('closeStandardsModal');
        const closeModalBtn = document.getElementById('closeStandardsModalBtn');

        if (standardsButton && standardsModal) {
            standardsButton.addEventListener('click', () => {
                standardsModal.style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            });

            const closeModalHandler = () => {
                standardsModal.style.display = 'none';
                document.body.style.overflow = ''; // Restore scrolling
            };

            if (closeModal) {
                closeModal.addEventListener('click', closeModalHandler);
            }

            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', closeModalHandler);
            }

            // Close modal when clicking outside
            standardsModal.addEventListener('click', (e) => {
                if (e.target === standardsModal) {
                    closeModalHandler();
                }
            });

            // Close modal with Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && standardsModal.style.display === 'flex') {
                    closeModalHandler();
                }
            });
        }
    }
}

// Initialize the application
window.app = new App();


