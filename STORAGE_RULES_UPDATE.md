# Firebase Storage Rules Update

## Problem
File uploads for site conditions and submitted plans are failing with 403 (Forbidden) errors because the Firebase Storage security rules don't include these new folders.

## Solution
Update Firebase Storage security rules to include `site-conditions` and `submitted-plans` folders.

## Steps to Fix

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select your project: **sanctuary-hoa-arch-review**

2. **Navigate to Storage:**
   - Click "Storage" in the left menu
   - Click the "Rules" tab

3. **Update the Rules:**
   Replace the existing rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Approval letters folder - require auth for upload, allow read for authenticated users
    match /approval-letters/{projectId}/{fileName} {
      allow read: if request.auth != null; // Only authenticated users can download
      allow write: if request.auth != null; // Only authenticated users can upload
    }
    
    // Site conditions folder - require auth for upload, allow read for authenticated users
    match /site-conditions/{projectId}/{fileName} {
      allow read: if request.auth != null; // Only authenticated users can download
      allow write: if request.auth != null; // Only authenticated users can upload
    }
    
    // Submitted plans folder - require auth for upload, allow read for authenticated users
    match /submitted-plans/{projectId}/{fileName} {
      allow read: if request.auth != null; // Only authenticated users can download
      allow write: if request.auth != null; // Only authenticated users can upload
    }
  }
}
```

4. **Click "Publish"** to save the rules

5. **Test:** Try uploading site conditions or submitted plans files again - they should now work!

## What Changed

- Added rules for `site-conditions/{projectId}/{fileName}` folder
- Added rules for `submitted-plans/{projectId}/{fileName}` folder
- Both folders require authentication for read and write operations (same as approval-letters)

## Notes

- All three file types (approval letters, site conditions, submitted plans) now use Firebase Storage
- Files are organized by project ID in their respective folders
- Authentication is required for both upload and download operations
- This enables file preview functionality for all file types

