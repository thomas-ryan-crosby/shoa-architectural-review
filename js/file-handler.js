// File Handler - Handles file uploads, preview, and management for multiple upload areas

class FileHandler {
    constructor() {
        // Separate file lists for each upload area
        this.siteConditionsFiles = [];
        this.projectFiles = [];
        
        // Site Conditions upload area
        this.siteConditionsInput = document.getElementById('siteConditionsInput');
        this.siteConditionsUploadArea = document.getElementById('siteConditionsUploadArea');
        this.siteConditionsFileList = document.getElementById('siteConditionsFileList');
        
        // Project Files upload area
        this.projectFilesInput = document.getElementById('projectFilesInput');
        this.projectFilesUploadArea = document.getElementById('projectFilesUploadArea');
        this.projectFilesFileList = document.getElementById('projectFilesFileList');
        
        this.init();
    }

    init() {
        // Check if elements exist before initializing
        if (!this.siteConditionsInput || !this.siteConditionsUploadArea || !this.siteConditionsFileList) {
            console.warn('Site Conditions file input elements not found. They may be in a hidden tab.');
            return;
        }
        
        if (!this.projectFilesInput || !this.projectFilesUploadArea || !this.projectFilesFileList) {
            console.warn('Project Files input elements not found. They may be in a hidden tab.');
            return;
        }
        
        // Initialize Site Conditions upload area
        this.initUploadArea(
            'siteConditions',
            this.siteConditionsInput,
            this.siteConditionsUploadArea,
            this.siteConditionsFileList,
            ['.pdf', '.jpg', '.jpeg', '.png'] // Only images and PDFs for site conditions
        );

        // Initialize Project Files upload area
        this.initUploadArea(
            'projectFiles',
            this.projectFilesInput,
            this.projectFilesUploadArea,
            this.projectFilesFileList,
            ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'] // All file types for project files
        );
    }

    initUploadArea(areaName, fileInput, uploadArea, fileListElement, allowedExtensions) {
        if (!fileInput || !uploadArea || !fileListElement) {
            console.warn(`${areaName} upload area elements not found`);
            return;
        }

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFiles(e.target.files, areaName, allowedExtensions);
            }
        }, false);

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files, areaName, allowedExtensions);
            }
        });

        // Click to upload
        uploadArea.addEventListener('click', (e) => {
            if (e.target === uploadArea || e.target.closest('.upload-prompt')) {
                e.preventDefault();
                fileInput.click();
            }
        });
    }

    handleFiles(fileList, areaName, allowedExtensions) {
        if (!fileList || fileList.length === 0) {
            return;
        }
        
        // Process files sequentially to avoid race conditions
        Array.from(fileList).forEach(file => {
            if (this.isValidFileType(file, allowedExtensions)) {
                this.addFile(file, areaName);
            } else {
                this.showError(`File "${file.name}" is not a supported type for ${areaName === 'siteConditions' ? 'Current Site Conditions' : 'Submitted Project Files'}.`);
            }
        });
        
        // Reset file input to allow selecting the same file again
        const fileInput = areaName === 'siteConditions' ? this.siteConditionsInput : this.projectFilesInput;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    isValidFileType(file, allowedExtensions) {
        const validTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        // Check if file type is valid
        const hasValidType = validTypes.includes(file.type);
        // Check if extension is in allowed list
        const hasValidExtension = allowedExtensions.includes(fileExtension);
        
        return hasValidType || hasValidExtension;
    }

    async addFile(file, areaName) {
        const fileList = areaName === 'siteConditions' ? this.siteConditionsFiles : this.projectFiles;
        
        // Check if file already exists (by name and size)
        const existingFile = fileList.find(f => f.name === file.name && f.size === file.size);
        if (existingFile) {
            console.log(`File "${file.name}" is already added to ${areaName}, skipping.`);
            return;
        }

        try {
            const fileDataResult = await this.readFile(file);
            
            // Add file to appropriate list
            fileList.push({
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                data: fileDataResult.data,
                format: fileDataResult.format
            });
            
            this.renderFileList(areaName);
            console.log(`File "${file.name}" added successfully to ${areaName}`);
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

    removeFile(index, areaName) {
        const fileList = areaName === 'siteConditions' ? this.siteConditionsFiles : this.projectFiles;
        fileList.splice(index, 1);
        this.renderFileList(areaName);
    }

    renderFileList(areaName) {
        const fileList = areaName === 'siteConditions' ? this.siteConditionsFiles : this.projectFiles;
        const fileListElement = areaName === 'siteConditions' ? this.siteConditionsFileList : this.projectFilesFileList;
        
        if (!fileListElement) return;
        
        if (fileList.length === 0) {
            fileListElement.innerHTML = '';
            return;
        }

        fileListElement.innerHTML = fileList.map((fileItem, index) => {
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
                    <button type="button" class="file-remove" onclick="window.fileHandler.removeFile(${index}, '${areaName}')" aria-label="Remove file">
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

    // Get all files from both areas combined
    getFiles() {
        return [...this.siteConditionsFiles, ...this.projectFiles];
    }

    // Get files from a specific area
    getSiteConditionsFiles() {
        return this.siteConditionsFiles;
    }

    getProjectFiles() {
        return this.projectFiles;
    }

    clearFiles() {
        this.siteConditionsFiles = [];
        this.projectFiles = [];
        if (this.siteConditionsInput) this.siteConditionsInput.value = '';
        if (this.projectFilesInput) this.projectFilesInput.value = '';
        this.renderFileList('siteConditions');
        this.renderFileList('projectFiles');
    }

    showError(message) {
        // Simple error display - could be enhanced with a toast notification
        alert(message);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit to ensure all elements are rendered (especially if in hidden tabs)
        setTimeout(() => {
            try {
                window.fileHandler = new FileHandler();
            } catch (error) {
                console.error('Error initializing FileHandler:', error);
            }
        }, 100);
    });
} else {
    // Wait a bit to ensure all elements are rendered
    setTimeout(() => {
        try {
            window.fileHandler = new FileHandler();
        } catch (error) {
            console.error('Error initializing FileHandler:', error);
        }
    }, 100);
}
