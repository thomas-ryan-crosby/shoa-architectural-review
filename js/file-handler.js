// File Handler - Handles file uploads, preview, and management

class FileHandler {
    constructor() {
        this.files = [];
        this.fileInput = document.getElementById('fileInput');
        this.fileUploadArea = document.getElementById('fileUploadArea');
        this.fileList = document.getElementById('fileList');
        
        this.init();
    }

    init() {
        // File input change - use capture phase to ensure it fires
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFiles(e.target.files);
            }
        }, false);

        // Drag and drop
        this.fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileUploadArea.classList.add('dragover');
        });

        this.fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileUploadArea.classList.remove('dragover');
        });

        this.fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        });

        // Click to upload - prevent double-triggering
        this.fileUploadArea.addEventListener('click', (e) => {
            // Only trigger if clicking directly on the upload area, not on child elements
            if (e.target === this.fileUploadArea || e.target.closest('.upload-prompt')) {
                e.preventDefault();
                this.fileInput.click();
            }
        });
    }

    handleFiles(fileList) {
        if (!fileList || fileList.length === 0) {
            return;
        }
        
        // Process files sequentially to avoid race conditions
        Array.from(fileList).forEach(file => {
            if (this.isValidFileType(file)) {
                this.addFile(file);
            } else {
                this.showError(`File "${file.name}" is not a supported type.`);
            }
        });
        
        // Reset file input to allow selecting the same file again
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }

    isValidFileType(file) {
        const validTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    }

    async addFile(file) {
        // Check if file already exists (by name and size)
        const existingFile = this.files.find(f => f.name === file.name && f.size === file.size);
        if (existingFile) {
            console.log(`File "${file.name}" is already added, skipping.`);
            return;
        }

        try {
            // Show loading state for this file
            const tempId = `temp-${Date.now()}-${Math.random()}`;
            this.renderFileList(); // Render current state first
            
            const fileDataResult = await this.readFile(file);
            
            // Add file to list
            this.files.push({
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                data: fileDataResult.data,
                format: fileDataResult.format
            });
            
            this.renderFileList();
            console.log(`File "${file.name}" added successfully`);
        } catch (error) {
            console.error('Error reading file:', error);
            this.showError(`Error reading file "${file.name}". Please try again.`);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve({
                    data: e.target.result,
                    format: file.type === 'application/pdf' ? 'arraybuffer' : 'dataurl'
                });
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            // Read as data URL for images, array buffer for PDFs
            if (file.type === 'application/pdf') {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsDataURL(file);
            }
        });
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFileList();
    }

    renderFileList() {
        if (this.files.length === 0) {
            this.fileList.innerHTML = '';
            return;
        }

        this.fileList.innerHTML = this.files.map((fileItem, index) => {
            const fileIcon = this.getFileIcon(fileItem.type);
            const fileSize = this.formatFileSize(fileItem.size);
            
            return `
                <div class="file-item">
                    <div class="file-item-info">
                        <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${fileIcon}
                        </svg>
                        <span class="file-name" title="${fileItem.name}">${fileItem.name}</span>
                        <span class="file-size">${fileSize}</span>
                    </div>
                    <button type="button" class="file-remove" onclick="window.fileHandler.removeFile(${index})" aria-label="Remove file">
                        ×
                    </button>
                </div>
            `;
        }).join('');
    }

    getFileIcon(fileType) {
        if (fileType === 'application/pdf') {
            return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
        } else if (fileType.startsWith('image/')) {
            return '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>';
        } else {
            return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    getFiles() {
        return this.files;
    }

    clearFiles() {
        this.files = [];
        this.fileInput.value = '';
        this.renderFileList();
    }

    showError(message) {
        // Simple error display - could be enhanced with a toast notification
        alert(message);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.fileHandler = new FileHandler();
    });
} else {
    window.fileHandler = new FileHandler();
}

