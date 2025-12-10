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
        // Verify all components are loaded
        if (!window.formHandler) {
            console.error('FormHandler not initialized');
        }
        if (!window.fileHandler) {
            console.error('FileHandler not initialized');
        }
        if (!window.pdfGenerator) {
            console.error('PDFGenerator not initialized');
        }

        // Check for required libraries
        if (typeof window.jspdf === 'undefined') {
            console.error('jsPDF library not loaded');
        }
        if (typeof PDFLib === 'undefined') {
            console.error('PDFLib library not loaded');
        }

        console.log('Sanctuary HOA Architectural Review Generator initialized');
    }
}

// Initialize the application
window.app = new App();

