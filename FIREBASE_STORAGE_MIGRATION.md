# Firebase Storage Migration for PDF Files

## Problem
PDFs were hitting Firestore's 1MB per-field limit, causing upload failures for larger approval letters.

## Solution
Migrated PDF storage from Firestore (1MB limit) to **Firebase Storage** (5GB per file limit).

## What Changed

### 1. Firebase Storage Integration
- Added Firebase Storage SDK to `index.html`
- Initialized Firebase Storage in `firebase-config.js`
- PDFs are now uploaded to Firebase Storage instead of being stored as base64 in Firestore

### 2. Upload Process
- When a project is added with a PDF, it's uploaded to Firebase Storage
- Storage path: `approval-letters/{projectId}/{filename}.pdf`
- A download URL is stored in Firestore (not the file itself)
- Shows a loading indicator during upload

### 3. Download Process
- PDFs are downloaded from Firebase Storage on-demand
- Supports both new Storage URLs and legacy base64-encoded PDFs (backward compatible)
- Only authenticated users can download PDFs

### 4. Backward Compatibility
- Old projects with base64-encoded PDFs still work
- New projects use Storage URLs
- System automatically handles both formats

## Setup Required

### 1. Enable Firebase Storage
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Storage" in the left menu
4. Click "Get started"
5. Select "Start in test mode" (we'll add security rules next)
6. Choose the same location as Firestore (recommended)
7. Click "Done"

### 2. Update Storage Security Rules
1. In Firebase Storage, click "Rules" tab
2. Replace the rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Approval letters folder - require auth for upload, allow read for authenticated users
    match /approval-letters/{projectId}/{fileName} {
      allow read: if request.auth != null; // Only authenticated users can download
      allow write: if request.auth != null; // Only authenticated users can upload
    }
  }
}
```

3. Click "Publish" to save the rules

## Benefits

✅ **No file size limits** - Supports PDFs up to 5GB (vs 1MB in Firestore)  
✅ **Better performance** - Files stored separately from database  
✅ **Cost efficient** - Storage pricing is more favorable for large files  
✅ **Scalable** - Can handle many large files without impacting database performance  
✅ **Backward compatible** - Old projects still work  

## Testing

1. Try uploading a large PDF (>1MB) - it should now work
2. Verify the PDF downloads correctly
3. Check that old projects with base64 PDFs still work
4. Confirm that unauthenticated users cannot download PDFs

## Notes

- PDFs are uploaded to Storage when projects are added
- Download URLs are stored in Firestore for quick access
- Files are organized by project ID in Storage
- Authentication is required for both upload and download operations


