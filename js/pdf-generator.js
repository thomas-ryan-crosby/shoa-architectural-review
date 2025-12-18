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
                // First, try to use embedded logo data (avoids all CORS issues)
                if (window.SANCTUARY_LOGO_DATA) {
                    this.logoData = window.SANCTUARY_LOGO_DATA;
                    this.logoWidth = window.SANCTUARY_LOGO_WIDTH || 900;
                    this.logoHeight = window.SANCTUARY_LOGO_HEIGHT || 633;
                    console.log('Logo loaded from embedded base64 data', { 
                        width: this.logoWidth, 
                        height: this.logoHeight 
                    });
                    resolve();
                    return;
                }
                
                // Fallback: try to use preloaded image if available
                const preloadedImg = document.getElementById('logoPreload');
                if (preloadedImg && preloadedImg.complete && preloadedImg.naturalWidth > 0) {
                    // Check if src is already a data URL
                    if (preloadedImg.src && preloadedImg.src.startsWith('data:')) {
                        this.logoData = preloadedImg.src;
                        this.logoWidth = preloadedImg.naturalWidth;
                        this.logoHeight = preloadedImg.naturalHeight;
                        console.log('Logo loaded from preloaded image data URL', { 
                            width: this.logoWidth, 
                            height: this.logoHeight 
                        });
                        resolve();
                        return;
                    }
                }
                
                console.warn('No embedded logo data found. Logo will not appear in PDF.');
                this.logoData = null;
                resolve();
            } catch (error) {
                console.error('Error in loadLogo:', error);
                this.logoData = null;
                resolve();
            }
        });
    }

    async generatePDF(formData, siteConditionsFiles, projectFiles) {
        this.showLoading(true);
        
        try {
            // Ensure logo is loaded before generating PDF - always reload to be sure
            console.log('Checking logo status before PDF generation...');
            if (!this.logoData || !this.logoWidth || !this.logoHeight) {
                console.log('Logo not loaded, loading now...');
                await this.loadLogo();
                // Wait a bit more to ensure canvas processing is complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Verify logo is actually available
            if (this.logoData && this.logoWidth && this.logoHeight) {
                console.log('Logo is ready:', { 
                    hasData: !!this.logoData, 
                    width: this.logoWidth, 
                    height: this.logoHeight,
                    dataLength: this.logoData.length 
                });
            } else {
                console.warn('Logo failed to load - PDF will be generated without logo');
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            // Generate main letter
            await this.generateLetter(doc, formData);

            // Always merge attachments (including builder's rules) using pdf-lib
            const result = await this.addAttachments(doc, siteConditionsFiles || [], projectFiles || [], formData);
            if (result && result.success) {
                // If attachments were added via pdf-lib, download already happened
                this.showLoading(false);
                this.showSuccess('Approval letter generated successfully!');
                
                // Save project if project manager is available
                if (window.projectManager && result.blob) {
                    try {
                        await window.projectManager.addProject({
                            ...formData,
                            approvalLetterBlob: result.blob,
                            approvalLetterFilename: result.filename
                        });
                    } catch (error) {
                        console.error('Error saving project to Firestore:', error);
                        alert('Project saved locally, but could not sync to Firestore. Please check your Firebase configuration.');
                    }
                }
                
                setTimeout(() => {
                    if (window.formHandler) window.formHandler.resetForm();
                    if (window.fileHandler) window.fileHandler.clearFiles();
                }, 2000);
                return;
            }

            // Fallback: Generate filename and download if addAttachments failed
            const filename = this.generateFilename(formData);
            const pdfBlob = doc.output('blob');
            doc.save(filename);
            
            // Save project if project manager is available
            if (window.projectManager) {
                // Convert blob to array buffer for storage
                const arrayBuffer = await pdfBlob.arrayBuffer();
                try {
                    await window.projectManager.addProject({
                        ...formData,
                        approvalLetterBlob: arrayBuffer,
                        approvalLetterFilename: filename
                    });
                } catch (error) {
                    console.error('Error saving project to Firestore:', error);
                    alert('Project saved locally, but could not sync to Firestore. Please check your Firebase configuration.');
                }
            }
            
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
        
        // Simple header layout: LOGO, then TITLE, then SUBJECT
        let yPos = margin;
        
        // 1. LOGO - at the top, left-aligned
        let logoHeight = 0;
        if (this.logoData && this.logoWidth && this.logoHeight) {
            try {
                const logoMaxWidth = 60; // mm
                const logoMaxHeight = 30; // mm
                const logoAspectRatio = this.logoWidth / this.logoHeight;
                
                let logoWidth = logoMaxWidth;
                logoHeight = logoWidth / logoAspectRatio;
                
                if (logoHeight > logoMaxHeight) {
                    logoHeight = logoMaxHeight;
                    logoWidth = logoHeight * logoAspectRatio;
                }
                
                if (this.logoData.startsWith('data:image/')) {
                    doc.addImage(this.logoData, 'JPEG', margin, yPos, logoWidth, logoHeight);
                    logoHeight = logoHeight; // Keep track of height
                }
            } catch (error) {
                console.error('Error adding logo to PDF:', error);
            }
        }
        
        // Move down after logo - compact spacing
        yPos += logoHeight > 0 ? logoHeight + 10 : 0;
        
        // 2. TITLE - below logo, left-aligned
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 85, 48);
        doc.text('Sanctuary Homeowners Association', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Architectural Review Committee', margin, yPos);
        yPos += 10;
        
        // 3. SUBJECT - below title, left-aligned
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 85, 48);
        const subjectText = `RE: Architectural Review - ${formData.projectType}`;
        const subjectAvailableWidth = pageWidth - (margin * 2);
        const subjectLines = doc.splitTextToSize(subjectText, subjectAvailableWidth);
        subjectLines.forEach((line, index) => {
            doc.text(line, margin, yPos + (index * 5));
        });
        yPos += (subjectLines.length * 5) + 10;

        // Date - modern formatting
        const today = new Date();
        const dateStr = this.formatDate(today);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${dateStr}`, margin, yPos);
        yPos += 6;

        // Property information - clean, modern formatting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(formData.address, margin, yPos);
        yPos += 5;
        doc.text(`Lot: ${formData.lot}`, margin, yPos);
        if (formData.contractorName) {
            yPos += 5;
            doc.text(`Contractor: ${formData.contractorName}`, margin, yPos);
        }
        yPos += 10; // Space before greeting

        // Greeting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const greeting = formData.ownerLastName 
            ? `Dear ${formData.ownerLastName} Residence,`
            : 'Dear Property Owner,';
        doc.text(greeting, margin, yPos);
        yPos += 8;

        // Review comments - proper paragraph formatting
        const reviewComments = doc.splitTextToSize(formData.reviewComments, contentWidth);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(reviewComments, margin, yPos);
        yPos += (reviewComments.length * 5) + 8;

        // Approval reason - proper paragraph formatting
        const approvalReason = doc.splitTextToSize(formData.approvalReason, contentWidth);
        doc.text(approvalReason, margin, yPos);
        yPos += (approvalReason.length * 5) + 8;

        // Closing sentiment
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text('We look forward to another beautiful addition to the neighborhood.', margin, yPos);
        yPos += 10;

        // Builder deposit information based on project type
        const depositAmount = formData.projectType === 'New Home' ? '2000' : '1000';
        const depositText = `Please submit a $${depositAmount} builder deposit, which will be held for the duration of the project to cover any unremedied HOA property damage. We return nearly all deposits in full; only in rare cases have deductions been necessary. Checks are made out to:`;
        const depositLines = doc.splitTextToSize(depositText, contentWidth);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(depositLines, margin, yPos);
        yPos += (depositLines.length * 5) + 6;
        
        // Deposit address
        doc.setFont('helvetica', 'bold');
        doc.text('Sanctuary Homeowners Association', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text('1 Sanctuary Blvd, Suite 100', margin, yPos);
        yPos += 5;
        doc.text('Mandeville, LA 70471', margin, yPos);
        yPos += 12;

        // Closing - professional, modern formatting
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Sincerely,', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 85, 48);
        doc.text('Sanctuary Homeowners Association', margin, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Architectural Review Committee', margin, yPos);
        yPos += 10;
        
        // Approved by (if provided)
        if (formData.approvedBy) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(`Approved by: ${formData.approvedBy}`, margin, yPos);
            yPos += 8;
        }

        // Add attachments note if there are files - modern, subtle styling
        if (window.fileHandler && window.fileHandler.getFiles().length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(120, 120, 120);
            doc.text('Attachments included on following pages.', margin, yPos);
        }
    }

    async loadBuildersRules() {
        return new Promise((resolve) => {
            // Check if base64 data is available (embedded in builders-rules-data.js)
            if (typeof BUILDERS_RULES_PDF_BASE64 !== 'undefined' && BUILDERS_RULES_PDF_BASE64) {
                try {
                    // Convert base64 string to ArrayBuffer
                    const binaryString = atob(BUILDERS_RULES_PDF_BASE64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    console.log('Builder\'s Rules PDF loaded from embedded base64 data');
                    resolve(bytes.buffer);
                    return;
                } catch (error) {
                    console.error('Error converting base64 to ArrayBuffer:', error);
                }
            }
            
            // Fallback: Try loading from file (for development/testing)
            const rulesPath = 'assets/Sanctuary Builder Rules.pdf';
            const xhr = new XMLHttpRequest();
            xhr.open('GET', rulesPath, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 0) {
                    console.log('Builder\'s Rules PDF loaded via XMLHttpRequest (fallback)');
                    resolve(xhr.response);
                } else {
                    console.error('Could not load builder\'s rules PDF:', xhr.status);
                    resolve(null);
                }
            };
            
            xhr.onerror = function() {
                console.error('Error loading builder\'s rules PDF from file');
                resolve(null);
            };
            
            xhr.send();
        });
    }

    async addAttachments(mainDoc, siteConditionsFiles, projectFiles, formData) {
        // Use pdf-lib to merge attachments
        const { PDFDocument } = PDFLib;
        
        try {
            // Get the main PDF as bytes
            const mainPdfBytes = mainDoc.output('arraybuffer');
            const mergedPdfDoc = await PDFDocument.load(mainPdfBytes);

            // Add Current Site Conditions section if there are files
            if (siteConditionsFiles && siteConditionsFiles.length > 0) {
                await this.addSectionLabel(mergedPdfDoc, 'Current Site Conditions');
                await this.processFiles(mergedPdfDoc, siteConditionsFiles);
            }

            // Add Submitted Files for Review section if there are files
            if (projectFiles && projectFiles.length > 0) {
                await this.addSectionLabel(mergedPdfDoc, 'Submitted Files for Review');
                await this.processFiles(mergedPdfDoc, projectFiles);
            }

            // Add Builder's Rules PDF - always add with section label
            console.log('Attempting to load Builder\'s Rules PDF...');
            const buildersRulesBytes = await this.loadBuildersRules();
            if (buildersRulesBytes && buildersRulesBytes.byteLength > 0) {
                try {
                    console.log('Builder\'s Rules PDF loaded, size:', buildersRulesBytes.byteLength, 'bytes');
                    await this.addSectionLabel(mergedPdfDoc, 'Builder\'s Rules');
                    const buildersRulesPdf = await PDFDocument.load(buildersRulesBytes);
                    const pageIndices = buildersRulesPdf.getPageIndices();
                    console.log('Builder\'s Rules PDF has', pageIndices.length, 'pages');
                    const pages = await mergedPdfDoc.copyPages(buildersRulesPdf, pageIndices);
                    pages.forEach((page) => mergedPdfDoc.addPage(page));
                    console.log('Builder\'s Rules PDF attached successfully with', pages.length, 'pages');
                } catch (error) {
                    console.error('Error attaching Builder\'s Rules PDF:', error);
                    console.error('Error details:', error.message, error.stack);
                }
            } else {
                console.error('Builder\'s Rules PDF not found or could not be loaded. Path: assets/Sanctuary Builder Rules.pdf');
                console.error('Make sure the file exists in the assets folder relative to index.html');
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
            
            // Return blob and filename for project tracking
            return {
                success: true,
                blob: mergedPdfBytes, // Return ArrayBuffer for storage
                filename: filename
            };
            
        } catch (error) {
            console.error('Error adding attachments with pdf-lib:', error);
            // Fallback to simple image-only approach
            await this.addAttachmentsSimple(mainDoc, [...(siteConditionsFiles || []), ...(projectFiles || [])]);
            return { success: false };
        }
    }

    async addSectionLabel(pdfDoc, labelText) {
        // Create a section label page
        const page = pdfDoc.addPage([612, 792]); // Letter size in points
        const { width, height } = page.getSize();
        
        // Embed font and get text width for centering
        const font = await pdfDoc.embedFont('Helvetica-Bold');
        const fontSize = 20;
        const textWidth = font.widthOfTextAtSize(labelText, fontSize);
        
        // Draw label text centered on page (using default black color for now)
        page.drawText(labelText, {
            x: (width - textWidth) / 2,
            y: height / 2,
            size: fontSize,
            font: font,
        });
    }

    async processFiles(pdfDoc, files) {
        const { PDFDocument } = PDFLib;
        
        // Process each attachment
        for (const fileItem of files) {
            try {
                if (fileItem.type === 'application/pdf') {
                    // Embed PDF pages - ensure all pages are copied
                    const attachmentPdf = await PDFDocument.load(fileItem.data);
                    const pageIndices = attachmentPdf.getPageIndices();
                    const pages = await pdfDoc.copyPages(attachmentPdf, pageIndices);
                    
                    // Add all pages to ensure nothing is truncated
                    pages.forEach(page => {
                        pdfDoc.addPage(page);
                    });
                    
                    console.log(`PDF "${fileItem.name}" embedded: ${pages.length} page(s) added`);
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
                            image = await pdfDoc.embedJpg(imageBytes);
                        } else if (fileItem.type === 'image/png') {
                            image = await pdfDoc.embedPng(imageBytes);
                        }
                        
                        if (image) {
                            // Calculate page size based on image dimensions to prevent truncation
                            // Add padding (margins) of 20 points on each side
                            const padding = 40; // 20 points on each side
                            const maxPageWidth = 792; // Maximum page width (11 inches)
                            const maxPageHeight = 1224; // Maximum page height (17 inches) - allows for larger images
                            
                            // Get image dimensions in points (pdf-lib uses points, 72 DPI)
                            const imgWidth = image.width;
                            const imgHeight = image.height;
                            
                            // Calculate the page size needed to fit the image with padding
                            let pageWidth = imgWidth + padding;
                            let pageHeight = imgHeight + padding;
                            
                            // If image is larger than max size, scale it down proportionally
                            // but ensure the full image is visible (no truncation)
                            if (pageWidth > maxPageWidth || pageHeight > maxPageHeight) {
                                const scaleX = (maxPageWidth - padding) / imgWidth;
                                const scaleY = (maxPageHeight - padding) / imgHeight;
                                const scale = Math.min(scaleX, scaleY); // Use the smaller scale to fit both dimensions
                                
                                pageWidth = (imgWidth * scale) + padding;
                                pageHeight = (imgHeight * scale) + padding;
                            }
                            
                            // Ensure minimum page size (at least letter size)
                            pageWidth = Math.max(pageWidth, 612);
                            pageHeight = Math.max(pageHeight, 792);
                            
                            // Create page with calculated dimensions
                            const page = pdfDoc.addPage([pageWidth, pageHeight]);
                                
                                // Calculate image position (centered with padding)
                                const imageWidth = pageWidth - padding;
                                const imageHeight = pageHeight - padding;
                                
                                // Scale image to fit within the available space while maintaining aspect ratio
                                const scaleX = imageWidth / imgWidth;
                                const scaleY = imageHeight / imgHeight;
                                const finalScale = Math.min(scaleX, scaleY);
                                
                                const finalWidth = imgWidth * finalScale;
                                const finalHeight = imgHeight * finalScale;
                                
                                // Center the image on the page
                                const x = (pageWidth - finalWidth) / 2;
                                const y = (pageHeight - finalHeight) / 2;
                                
                                // Draw the full image without truncation
                                page.drawImage(image, {
                                    x: x,
                                    y: y,
                                    width: finalWidth,
                                    height: finalHeight,
                                });
                                
                                console.log(`Image "${fileItem.name}" embedded: ${imgWidth}x${imgHeight} on page ${pageWidth}x${pageHeight}`);
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
    }

    async addAttachmentsSimple(mainDoc, files) {
        // Fallback: add images as pages using jsPDF directly
        // Note: This method has limitations with very large images due to jsPDF constraints
        for (const fileItem of files) {
            try {
                if (fileItem.type.startsWith('image/')) {
                    const img = new Image();
                    img.src = fileItem.data;
                    
                    await new Promise((resolve) => {
                        img.onload = () => {
                            // Convert pixels to mm (assuming 96 DPI: 1 pixel ≈ 0.264583 mm)
                            // jsPDF uses mm as units
                            const pixelsToMm = 0.264583;
                            const margin = 10; // 10mm margin
                            
                            const imgWidthMm = img.width * pixelsToMm;
                            const imgHeightMm = img.height * pixelsToMm;
                            
                            // Calculate page size needed (with margins)
                            let pageWidth = imgWidthMm + (margin * 2);
                            let pageHeight = imgHeightMm + (margin * 2);
                            
                            // Maximum page sizes (A4 is 210x297mm, but allow larger)
                            const maxWidth = 420; // ~16.5 inches
                            const maxHeight = 594; // ~23.4 inches
                            
                            // If image is too large, scale it down but keep full image visible
                            if (pageWidth > maxWidth || pageHeight > maxHeight) {
                                const scaleX = (maxWidth - margin * 2) / imgWidthMm;
                                const scaleY = (maxHeight - margin * 2) / imgHeightMm;
                                const scale = Math.min(scaleX, scaleY);
                                
                                pageWidth = (imgWidthMm * scale) + (margin * 2);
                                pageHeight = (imgHeightMm * scale) + (margin * 2);
                            }
                            
                            // Ensure minimum page size (A4)
                            pageWidth = Math.max(pageWidth, 210);
                            pageHeight = Math.max(pageHeight, 297);
                            
                            // Add page with custom size
                            mainDoc.addPage([pageWidth, pageHeight], 'mm');
                            
                            // Calculate image dimensions and position
                            const finalWidth = pageWidth - (margin * 2);
                            const finalHeight = pageHeight - (margin * 2);
                            
                            // Maintain aspect ratio
                            const imgAspect = imgWidthMm / imgHeightMm;
                            const pageAspect = finalWidth / finalHeight;
                            
                            let drawWidth, drawHeight;
                            if (imgAspect > pageAspect) {
                                // Image is wider - fit to width
                                drawWidth = finalWidth;
                                drawHeight = finalWidth / imgAspect;
                            } else {
                                // Image is taller - fit to height
                                drawHeight = finalHeight;
                                drawWidth = finalHeight * imgAspect;
                            }
                            
                            // Center the image
                            const x = (pageWidth - drawWidth) / 2;
                            const y = (pageHeight - drawHeight) / 2;
                            
                            const format = fileItem.type === 'image/png' ? 'PNG' : 'JPEG';
                            mainDoc.addImage(fileItem.data, format, x, y, drawWidth, drawHeight, undefined, 'FAST');
                            
                            console.log(`Image "${fileItem.name}" embedded (fallback): ${img.width}x${img.height} on page ${pageWidth.toFixed(1)}x${pageHeight.toFixed(1)}mm`);
                            resolve();
                        };
                        img.onerror = () => {
                            console.error(`Failed to load image ${fileItem.name} in fallback method`);
                            resolve(); // Continue even if image fails
                        };
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

// Initialize PDF Generator
function initPDFGenerator() {
    if (typeof PDFGenerator !== 'undefined') {
        window.pdfGenerator = new PDFGenerator();
        console.log('PDF Generator initialized');
    } else {
        console.error('PDFGenerator class not found');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPDFGenerator);
} else {
    // DOM already loaded, but wait a tick to ensure all scripts are parsed
    setTimeout(initPDFGenerator, 0);
}

