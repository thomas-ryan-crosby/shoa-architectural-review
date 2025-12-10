// PDF Generator - Handles PDF creation with letterhead, content, and attachments

class PDFGenerator {
    constructor() {
        this.logoData = null;
        this.logoWidth = null;
        this.logoHeight = null;
        // Load logo asynchronously - will be ready when needed
        this.loadLogo();
    }

    async loadLogo() {
        return new Promise((resolve) => {
            try {
                const logoPath = 'assets/logo/sanctuary logo.jpg';
                const img = new Image();
                
                // Set a timeout to detect if image fails to load
                const timeout = setTimeout(() => {
                    if (!this.logoData) {
                        console.error('Logo loading timeout');
                        this.logoData = null;
                        resolve();
                    }
                }, 5000);
                
                img.onload = () => {
                    clearTimeout(timeout);
                    try {
                        // Convert image to canvas then to data URL for jsPDF
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        
                        // Draw white background first (in case logo has transparency issues)
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        ctx.drawImage(img, 0, 0);
                        this.logoData = canvas.toDataURL('image/jpeg', 0.95);
                        this.logoWidth = img.width;
                        this.logoHeight = img.height;
                        console.log('Logo loaded successfully', { 
                            width: img.width, 
                            height: img.height,
                            dataUrlLength: this.logoData.length 
                        });
                        resolve();
                    } catch (error) {
                        console.error('Error processing logo canvas:', error);
                        this.logoData = null;
                        resolve();
                    }
                };
                
                img.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('Could not load logo from:', logoPath, error);
                    console.error('Trying alternative loading method...');
                    
                    // Try alternative: use fetch if available
                    if (typeof fetch !== 'undefined') {
                        fetch(logoPath)
                            .then(response => {
                                if (response.ok) {
                                    return response.blob();
                                }
                                throw new Error('Logo fetch failed');
                            })
                            .then(blob => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    const img2 = new Image();
                                    img2.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        canvas.width = img2.width;
                                        canvas.height = img2.height;
                                        const ctx = canvas.getContext('2d');
                                        ctx.fillStyle = '#FFFFFF';
                                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                                        ctx.drawImage(img2, 0, 0);
                                        this.logoData = canvas.toDataURL('image/jpeg', 0.95);
                                        this.logoWidth = img2.width;
                                        this.logoHeight = img2.height;
                                        console.log('Logo loaded via fetch fallback');
                                        resolve();
                                    };
                                    img2.onerror = () => {
                                        console.error('Failed to load logo via fetch fallback');
                                        this.logoData = null;
                                        resolve();
                                    };
                                    img2.src = e.target.result;
                                };
                                reader.readAsDataURL(blob);
                            })
                            .catch(() => {
                                this.logoData = null;
                                resolve();
                            });
                    } else {
                        this.logoData = null;
                        resolve();
                    }
                };
                
                // Load the image - this works with both file:// and http:// protocols
                img.src = logoPath;
            } catch (error) {
                console.error('Error in loadLogo:', error);
                this.logoData = null;
                resolve();
            }
        });
    }

    async generatePDF(formData, files) {
        this.showLoading(true);
        
        try {
            // Ensure logo is loaded before generating PDF
            if (!this.logoData) {
                await this.loadLogo();
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            // Generate main letter
            await this.generateLetter(doc, formData);

            // If we have attachments, merge them
            if (files && files.length > 0) {
                const hasAttachments = await this.addAttachments(doc, files, formData);
                if (hasAttachments) {
                    // If attachments were added via pdf-lib, download already happened
                    this.showLoading(false);
                    this.showSuccess('Approval letter generated successfully!');
                    setTimeout(() => {
                        if (window.formHandler) window.formHandler.resetForm();
                        if (window.fileHandler) window.fileHandler.clearFiles();
                    }, 2000);
                    return;
                }
            }

            // Generate filename and download
            const filename = this.generateFilename(formData);
            doc.save(filename);
            
            this.showLoading(false);
            this.showSuccess('Approval letter generated successfully!');
            
            // Reset form after successful generation
            setTimeout(() => {
                if (window.formHandler) {
                    window.formHandler.resetForm();
                }
                if (window.fileHandler) {
                    window.fileHandler.clearFiles();
                }
            }, 2000);

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showLoading(false);
            this.showError('Error generating PDF. Please try again.');
        }
    }

    async generateLetter(doc, formData) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 25.4; // 1 inch in mm
        const contentWidth = pageWidth - (margin * 2);
        
        let yPos = margin;

        // Modern Letterhead Section with Logo and Branding
        // Add a subtle background color bar (light gray) for modern look
        const headerBarHeight = 35; // mm
        doc.setFillColor(245, 245, 245); // Light gray background
        doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
        
        // Add logo prominently at the top left
        if (this.logoData && this.logoWidth && this.logoHeight) {
            try {
                // Calculate logo dimensions - make it larger and more prominent
                const logoMaxWidth = 60; // mm - larger for prominence
                const logoMaxHeight = 30; // mm
                const logoAspectRatio = this.logoWidth / this.logoHeight;
                
                let logoWidth = logoMaxWidth;
                let logoHeight = logoWidth / logoAspectRatio;
                
                if (logoHeight > logoMaxHeight) {
                    logoHeight = logoMaxHeight;
                    logoWidth = logoHeight * logoAspectRatio;
                }
                
                // Position logo in header bar, centered vertically
                const logoY = (headerBarHeight - logoHeight) / 2;
                doc.addImage(this.logoData, 'JPEG', margin, logoY, logoWidth, logoHeight);
                console.log('Logo added to PDF', { logoWidth, logoHeight, logoY });
                
                // Position text to the right of logo or below if logo is large
                const textStartX = margin + logoWidth + 10;
                const textStartY = margin + 8;
                
                // Association name - modern, bold styling
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(44, 85, 48); // Dark green color similar to website
                doc.text('Sanctuary Homeowners Association', textStartX, textStartY);
                
                // Committee name - smaller, elegant
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(70, 70, 70);
                doc.text('Architectural Review Committee', textStartX, textStartY + 7);
                
                yPos = headerBarHeight + 15; // Start content below header
            } catch (error) {
                console.error('Error adding logo to PDF:', error);
                // Fallback: text-only header
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(44, 85, 48);
                doc.text('Sanctuary Homeowners Association', margin, margin + 8);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(70, 70, 70);
                doc.text('Architectural Review Committee', margin, margin + 16);
                yPos = headerBarHeight + 15;
            }
        } else {
            console.warn('Logo not available - using text-only header');
            // Text-only header if logo fails
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(44, 85, 48);
            doc.text('Sanctuary Homeowners Association', margin, margin + 8);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(70, 70, 70);
            doc.text('Architectural Review Committee', margin, margin + 16);
            yPos = headerBarHeight + 15;
        }

        // Add a subtle divider line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 12;

        // Date - modern formatting
        const today = new Date();
        const dateStr = this.formatDate(today);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${dateStr}`, margin, yPos);
        yPos += 10;

        // Property information - clean, modern formatting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(formData.address, margin, yPos);
        yPos += 7;
        doc.text(`Lot: ${formData.lot}`, margin, yPos);
        yPos += 15; // More space before subject

        // Subject line - bold, prominent, modern styling
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 85, 48); // Brand color
        doc.text(`RE: Architectural Review - ${formData.projectType}`, margin, yPos);
        yPos += 12;

        // Greeting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Dear Property Owner,', margin, yPos);
        yPos += 12;

        // Review comments - proper paragraph formatting with better spacing
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const reviewComments = doc.splitTextToSize(formData.reviewComments, contentWidth);
        doc.text(reviewComments, margin, yPos);
        yPos += (reviewComments.length * 6) + 10; // Better line spacing

        // Approval reason - proper paragraph formatting
        const approvalReason = doc.splitTextToSize(formData.approvalReason, contentWidth);
        doc.text(approvalReason, margin, yPos);
        yPos += (approvalReason.length * 6) + 15; // Better spacing

        // Closing - professional, modern formatting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Sincerely,', margin, yPos);
        yPos += 12;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 85, 48);
        doc.text('Sanctuary Homeowners Association', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Architectural Review Committee', margin, yPos);
        yPos += 18;

        // Add attachments note if there are files - modern, subtle styling
        if (window.fileHandler && window.fileHandler.getFiles().length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(120, 120, 120);
            doc.text('Attachments included on following pages.', margin, yPos);
        }
    }

    async addAttachments(mainDoc, files, formData) {
        // Use pdf-lib to merge attachments
        const { PDFDocument } = PDFLib;
        
        try {
            // Get the main PDF as bytes
            const mainPdfBytes = mainDoc.output('arraybuffer');
            const mergedPdfDoc = await PDFDocument.load(mainPdfBytes);

            // Process each attachment
            for (const fileItem of files) {
                try {
                    if (fileItem.type === 'application/pdf') {
                        // Embed PDF pages
                        const attachmentPdf = await PDFDocument.load(fileItem.data);
                        const pages = await mergedPdfDoc.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
                        pages.forEach(page => mergedPdfDoc.addPage(page));
                    } else if (fileItem.type.startsWith('image/')) {
                        // Convert image to PDF page using pdf-lib
                        try {
                            let imageBytes;
                            // fileItem.data is a data URL, need to convert to Uint8Array
                            if (fileItem.format === 'dataurl' || (typeof fileItem.data === 'string' && fileItem.data.startsWith('data:'))) {
                                // Convert data URL to Uint8Array
                                const base64 = fileItem.data.split(',')[1];
                                const binaryString = atob(base64);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                imageBytes = bytes;
                            } else {
                                imageBytes = fileItem.data;
                            }
                            
                            let image;
                            if (fileItem.type === 'image/jpeg' || fileItem.type === 'image/jpg') {
                                image = await mergedPdfDoc.embedJpg(imageBytes);
                            } else if (fileItem.type === 'image/png') {
                                image = await mergedPdfDoc.embedPng(imageBytes);
                            }
                            
                            if (image) {
                                // Use standard letter size for image pages
                                const page = mergedPdfDoc.addPage([612, 792]); // Letter size in points
                                const scale = Math.min(612 / image.width, 792 / image.height) * 0.9;
                                const width = image.width * scale;
                                const height = image.height * scale;
                                const x = (612 - width) / 2;
                                const y = (792 - height) / 2;
                                
                                page.drawImage(image, {
                                    x: x,
                                    y: y,
                                    width: width,
                                    height: height,
                                });
                            }
                        } catch (error) {
                            console.error(`Error embedding image ${fileItem.name}:`, error);
                        }
                    } else {
                        // DOC/DOCX files - skip with note
                        console.warn(`File type ${fileItem.type} not supported for embedding`);
                    }
                } catch (error) {
                    console.error(`Error processing file ${fileItem.name}:`, error);
                    // Continue with other files
                }
            }

            // Save the merged PDF
            const mergedPdfBytes = await mergedPdfDoc.save();
            
            // Generate filename and download
            const filename = this.generateFilename(formData);
            
            // Create a blob and trigger download
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            return true; // Indicate that download already happened
            
        } catch (error) {
            console.error('Error adding attachments with pdf-lib:', error);
            // Fallback to simple image-only approach
            await this.addAttachmentsSimple(mainDoc, files);
            return false;
        }
    }

    async addAttachmentsSimple(mainDoc, files) {
        // Fallback: add images as pages using jsPDF directly
        for (const fileItem of files) {
            try {
                if (fileItem.type.startsWith('image/')) {
                    mainDoc.addPage();
                    
                    const img = new Image();
                    img.src = fileItem.data;
                    
                    await new Promise((resolve) => {
                        img.onload = () => {
                            const pageWidth = mainDoc.internal.pageSize.getWidth();
                            const pageHeight = mainDoc.internal.pageSize.getHeight();
                            const margin = 10;
                            
                            // Calculate dimensions to fit page
                            const imgWidth = img.width;
                            const imgHeight = img.height;
                            const ratio = Math.min(
                                (pageWidth - margin * 2) / imgWidth,
                                (pageHeight - margin * 2) / imgHeight
                            );
                            
                            const width = imgWidth * ratio;
                            const height = imgHeight * ratio;
                            const x = (pageWidth - width) / 2;
                            const y = (pageHeight - height) / 2;
                            
                            const format = fileItem.type === 'image/png' ? 'PNG' : 'JPEG';
                            mainDoc.addImage(fileItem.data, format, x, y, width, height);
                            resolve();
                        };
                        img.onerror = () => resolve(); // Continue even if image fails
                    });
                }
            } catch (error) {
                console.error(`Error adding attachment ${fileItem.name}:`, error);
            }
        }
    }

    formatDate(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    generateFilename(formData) {
        const today = new Date();
        // Use MM_DD_YYYY format for filename (underscores for filesystem compatibility)
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = today.getFullYear();
        const dateStr = `${month}_${day}_${year}`;
        
        // Sanitize address for filename
        const sanitizedAddress = formData.address
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Sanitize project type
        const sanitizedProjectType = formData.projectType
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return `Sanctuary Architectural Approval Letter - ${formData.lot} - ${sanitizedAddress} - ${sanitizedProjectType} - ${dateStr}.pdf`;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        const btn = document.getElementById('generateBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        
        if (show) {
            overlay.style.display = 'flex';
            btn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
            btn.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    }

    showSuccess(message) {
        // Simple success notification
        console.log(message);
        // Could be enhanced with a toast notification
    }

    showError(message) {
        alert(message);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pdfGenerator = new PDFGenerator();
    });
} else {
    window.pdfGenerator = new PDFGenerator();
}

