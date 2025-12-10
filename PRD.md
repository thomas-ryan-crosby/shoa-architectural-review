# Product Requirements Document (PRD)
## Sanctuary HOA Architectural Review Generator

**Version:** 1.0  
**Date:** December 2024  
**Status:** Draft

---

## 1. Executive Summary

The Sanctuary HOA Architectural Review Generator is a web application designed to streamline the architectural review process for the Sanctuary Homeowners Association. The application enables users to input project details, upload supporting documents, and automatically generate professional PDF approval letters on behalf of the Architectural Review Committee.

---

## 2. Product Overview

### 2.1 App Name
**Sanctuary HOA Architectural Review**

### 2.2 Product Description
The Sanctuary HOA Architectural Review Generator is a web-based application that facilitates the architectural review workflow for the Sanctuary Homeowners Association. The application prompts users to input essential project information (address, lot number, project type), allows for document uploads, and captures review comments and approval reasons. Upon completion of the review workflow, the application automatically generates a professional PDF approval letter on behalf of the Sanctuary Homeowners Association Architectural Review Committee, including all uploaded attachments.

### 2.3 Problem Statement
Currently, the architectural review process requires manual creation of approval letters, which is time-consuming and prone to inconsistencies. This application automates the letter generation process while maintaining a standardized format and ensuring all necessary information and attachments are included.

---

## 3. User Personas

### 3.1 Primary User
- **Role:** HOA Architectural Review Committee Member / Administrator
- **Technical Proficiency:** Basic to intermediate
- **Use Case:** Review architectural submissions and generate approval letters
- **Goals:** 
  - Quickly generate professional approval letters
  - Ensure consistency in documentation
  - Include all relevant project information and attachments

---

## 4. Core Features & Requirements

### 4.1 User Input Collection

#### 4.1.1 Address Input
- **Requirement:** User must be able to input the property address
- **Field Type:** Text input
- **Validation:** Required field
- **Format:** Free text (address format)

#### 4.1.2 Lot Number Input
- **Requirement:** User must be able to input the lot number
- **Field Type:** Text input
- **Validation:** Required field
- **Format:** Alphanumeric

#### 4.1.3 Project Type Selection
- **Requirement:** User must be able to select the type of project
- **Field Type:** Dropdown/Radio buttons
- **Options:**
  - New Home
  - Renovation/Extension
  - Accessory Structure
  - Pool
  - Other
- **Validation:** Required field
- **Note:** If "Other" is selected, provide additional text input field

#### 4.1.4 File Upload
- **Requirement:** User must be able to upload supporting documents
- **Field Type:** File upload component
- **Validation:** Optional (but recommended)
- **File Types:** PDF, images (JPG, PNG), documents (DOC, DOCX)
- **Multiple Files:** Yes, allow multiple file uploads
- **File Size Limit:** No enforced limit

#### 4.1.5 Review Comments
- **Requirement:** User must be able to input comments describing what was reviewed
- **Field Type:** Textarea
- **Validation:** Required field
- **Character Limit:** None
- **Example:** "The addition was reviewed for Sanctuary setback requirements"

#### 4.1.6 Approval Reason
- **Requirement:** User must be able to input the approval reason/decision
- **Field Type:** Textarea
- **Validation:** Required field
- **Character Limit:** None
- **Example:** "No variances are necessary. APPROVED."

### 4.2 PDF Generation

#### 4.2.1 Approval Letter Generation
- **Requirement:** Application must automatically generate a PDF approval letter upon workflow completion
- **Format:** Professional letter format (specific formatting requirements to be provided via example)
- **Letterhead:** Must include Sanctuary logo and styling
- **Branding:** Sanctuary logo must be prominently displayed on the letterhead
- **Content Must Include:**
  - Date
  - Property address
  - Lot number
  - Project type
  - Review comments
  - Approval reason/decision
  - Committee signature line/authorization

#### 4.2.2 Attachment Inclusion
- **Requirement:** All uploaded files must be included in the generated PDF
- **Method:** **Embed attachments as pages within the PDF**
- **Implementation:** All uploaded files (PDFs, images, documents) should be converted and embedded as additional pages in the final PDF document

#### 4.2.3 PDF Download
- **Requirement:** User must be able to download the generated PDF
- **File Name Format:** `Sanctuary Architectural Approval Letter - [Lot] - [Address] - [Project Type] - [Date].pdf`
  - **Example:** `Sanctuary Architectural Approval Letter - 434 - 113 Juniper Court - House - 01_09_2025.pdf`
  - **Date Format:** DD_MM_YYYY (e.g., 01_09_2025 for January 9, 2025)
  - **Project Type:** Use the selected project type (e.g., "House", "Renovation/Extension", "Pool", etc.)
- **Action:** Automatic download or download button

### 4.3 User Interface Requirements

#### 4.3.1 Form Layout
- Clean, intuitive form layout
- Clear section headers
- Required field indicators
- File upload preview/management
- Submit/Generate button

#### 4.3.2 Responsive Design
- Must work on desktop and tablet devices
- Mobile-friendly layout (optional for MVP)

#### 4.3.3 Error Handling
- Form validation with clear error messages
- File upload error handling
- PDF generation error handling

---

## 5. Technical Requirements

### 5.1 Application Type
**Web Application**

### 5.2 Data Storage
**No persistent storage required**
- Application can reset every time it's opened
- All data is session-based
- No database required for MVP

### 5.3 Technology Stack Recommendations

**Note:** Since this is a standalone HTML file (Option 1), all technologies must work client-side with `file://` protocol.

- **Frontend:** 
  - **Recommended:** Vanilla JavaScript (simplest, no build step)
  - **Alternative:** React or Vue.js (if using, must be bundled into single HTML or use CDN)
  - All code should be embeddable in HTML or loadable via CDN/relative paths

- **PDF Generation:** 
  - **Primary:** jsPDF (client-side, works with file:// protocol)
  - **For attachments:** pdf-lib (client-side, excellent for merging/embedding PDFs and images)
  - **Not suitable:** PDFKit (requires Node.js), Puppeteer (requires server)

- **File Handling:** 
  - FileReader API for reading uploaded files
  - Client-side file processing only
  - Image processing: Canvas API for image manipulation if needed

- **Styling:** 
  - **Recommended:** Embedded CSS or external CSS file (relative path)
  - **Alternative:** Tailwind/Bootstrap via CDN
  - All styles must work with local file access

- **Dependencies:**
  - All libraries must be loaded via CDN or bundled
  - No npm/node_modules (unless bundled into single file)
  - Consider using ES6 modules with `type="module"` if needed

### 5.4 Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Support for File API
- Support for PDF generation/download

### 5.5 Deployment & Access Methods

**Selected Method:** ✅ **Option 1: Standalone HTML File**

#### Access Method
- **How to Use:** Double-click the main HTML file (e.g., `index.html`) to open in default browser
- **No setup required** - works immediately
- **No terminal/command line needed**
- **Works offline** - all functionality is client-side
- **Portable** - can be stored on USB drive, shared via email, or saved anywhere

#### Implementation Requirements
- Application must be a single HTML file or a small set of files (HTML, CSS, JS) that can be opened directly
- All assets (logo, CSS, JavaScript) must be embedded or referenced using relative paths
- Must work with `file://` protocol (local file access)
- PDF generation must work entirely client-side
- File uploads must work with local file access (some browsers may have limitations)

#### Browser Considerations
- **Chrome/Edge:** Full functionality expected
- **Firefox:** Full functionality expected
- **Safari:** May have some restrictions with local file access
- **Note:** If browser restrictions are encountered, user can use a local web server as fallback (Option 2)

#### File Structure
The application should be structured as:
```
sanctuary-architectural-review/
├── index.html          (main application file - double-click to open)
├── assets/
│   ├── logo/
│   │   └── sanctuary logo.jpg
│   └── reference/
│       └── [reference PDF]
├── css/                (optional - can be embedded in HTML)
├── js/                 (optional - can be embedded in HTML)
└── README.md           (usage instructions)
```

#### User Instructions
1. Locate `index.html` in the application folder
2. Double-click `index.html` to open in your default web browser
3. Use the application as normal
4. Generated PDFs will download to your default download folder

### 5.6 Required Assets
- **Sanctuary Logo:** ✅ Provided
  - **File:** `assets/logo/sanctuary logo.jpg`
  - **Format:** JPG
  - **Usage:** Will be embedded in PDF letterhead
  - Logo must maintain quality when scaled for letterhead use

- **Formatting Reference Document:** ✅ Provided
  - **File:** `assets/reference/Sanctuary Letterhead_Architectural Approval_ACUnits_Rockwell_Signed.pdf`
  - **Format:** PDF
  - **Usage:** Reference document for letter formatting, layout, typography, spacing, and styling

---

## 6. User Stories

### Story 1: Input Project Information
**As a** HOA committee member  
**I want to** input the property address, lot number, and project type  
**So that** I can document the project being reviewed

### Story 2: Upload Supporting Documents
**As a** HOA committee member  
**I want to** upload relevant documents and images  
**So that** they can be included in the approval letter

### Story 3: Document Review Details
**As a** HOA committee member  
**I want to** input review comments and approval reasons  
**So that** the approval letter contains all necessary information

### Story 4: Generate Approval Letter
**As a** HOA committee member  
**I want to** automatically generate a PDF approval letter  
**So that** I can quickly produce professional documentation

### Story 5: Include Attachments
**As a** HOA committee member  
**I want** uploaded files to be included in the PDF  
**So that** all relevant documentation is in one place

---

## 7. MVP Requirements (Version 1.0)

### Must-Have Features:
1. ✅ Form inputs for:
   - Address (required)
   - Lot number (required)
   - Project type selection (required)
   - File upload (optional, multiple files)
   - Review comments (required)
   - Approval reason (required)

2. ✅ File upload functionality with preview/management

3. ✅ PDF generation that includes:
   - Professional letter format with Sanctuary HOA letterhead
   - All form input data
   - All uploaded attachments embedded in PDF

4. ✅ PDF download functionality

5. ✅ Form validation and error handling

### Nice-to-Have (Future Versions):
- Save/load draft reviews
- Template customization
- Email functionality
- Approval letter templates for different project types
- Digital signature capability
- Review history/log

---

## 8. Success Metrics

### 8.1 User Experience Metrics
- Time to generate approval letter: < 2 minutes
- Form completion rate: 100% (all required fields)
- PDF generation success rate: > 99%

### 8.2 Quality Metrics
- PDF readability and professional appearance
- All attachments successfully included
- No data loss during PDF generation

---

## 9. Constraints & Assumptions

### 9.1 Constraints
- No persistent data storage (session-based only)
- Client-side processing preferred (no backend required for MVP)
- File size limitations based on browser capabilities (no enforced limits, but browser may have practical limits)

### 9.2 Assumptions
- User has modern web browser
- User understands the architectural review process
- Uploaded files are appropriate for the review process
- PDF format is acceptable for all stakeholders

---

## 10. Out of Scope (Version 1.0)

- User authentication/login
- Data persistence/database
- Multi-user collaboration
- Email integration
- Cloud storage
- Mobile app version
- Integration with HOA management systems
- Approval workflow management
- Notification system

---

## 11. Future Enhancements

### Version 2.0 Considerations:
- Save draft reviews locally (localStorage)
- Multiple approval letter templates
- Export to different formats (DOCX)
- Print optimization
- Enhanced file type support
- Batch processing

---

## 12. Resolved Questions

1. ✅ **What is the preferred PDF structure for attachments?**  
   **Answer:** Embedded pages - All uploaded files should be converted and embedded as pages within the PDF.

2. ✅ **Are there specific formatting requirements for the approval letter?**  
   **Answer:** Yes - Formatting reference document provided: `assets/reference/Sanctuary Letterhead_Architectural Approval_ACUnits_Rockwell_Signed.pdf`

3. ✅ **What file size limits should be enforced?**  
   **Answer:** No file size limits will be enforced.

4. ✅ **Should there be a character limit for comments/approval reasons?**  
   **Answer:** No character limits for review comments or approval reasons.

5. ✅ **Are there specific branding/logo requirements for the letterhead?**  
   **Answer:** Yes - The letterhead must include the Sanctuary logo and styling. The Sanctuary logo should be prominently displayed on the approval letter output. Logo file provided: `assets/logo/sanctuary logo.jpg`

---

## 13. Appendix

### 13.1 Example Approval Letter Structure
```
[Sanctuary Logo and Letterhead with Styling]

Date: [Auto-generated]

[Property Address]
Lot: [Lot Number]

RE: Architectural Review - [Project Type]

Dear [Property Owner],

[Review Comments]

[Approval Reason]

Sincerely,
Sanctuary Homeowners Association
Architectural Review Committee

---
[Attachments: List of uploaded files]
```

**Note:** Specific formatting requirements and layout details are provided in the reference document: `assets/reference/Sanctuary Letterhead_Architectural Approval_ACUnits_Rockwell_Signed.pdf`

### 13.2 Project Type Definitions
- **New Home:** Construction of a new residential dwelling
- **Renovation/Extension:** Modifications or additions to existing structures
- **Accessory Structure:** Detached structures (sheds, garages, etc.)
- **Pool:** Swimming pool installation or modification
- **Other:** Any project not covered by above categories

---

**Document Owner:** Product Team  
**Last Updated:** December 2024  
**Next Review Date:** TBD

