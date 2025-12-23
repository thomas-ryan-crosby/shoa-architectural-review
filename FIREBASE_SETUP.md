# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project" or "Create a project"
3. Enter project name: "Sanctuary HOA" (or your preferred name)
4. Disable Google Analytics (optional, not needed for this app)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In Firebase Console, click "Firestore Database" in the left menu
2. Click "Create database"
3. Select "Start in test mode" (for now - we'll add security rules later)
4. Choose a location (closest to you)
5. Click "Enable"

## Step 3: Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>`
5. Register app with nickname: "Sanctuary HOA Web App"
6. Copy the `firebaseConfig` object that appears
7. Paste it into `js/firebase-config.js` (this file will be created)

## Step 4: Enable Authentication (REQUIRED for Production)

1. In Firebase Console, click "Authentication" in the left menu
2. Click "Get started"
3. Click "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"
6. **Create your first user:**
   - Click "Users" tab
   - Click "Add user"
   - Enter email and password
   - Click "Add user"

## Step 5: Production Security Rules (REQUIRED)

### Firestore Rules

1. In Firestore Database, click "Rules" tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to all (viewing projects)
    // Require authentication for write operations (creating/editing/deleting)
    match /projects/{projectId} {
      allow read: if true; // Anyone can view projects
      allow write: if request.auth != null; // Only authenticated users can modify
    }
    
    // Users collection - for user management and approvals
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.token.email == userId;
      // Allow authenticated users to read all users (for admin panel)
      // In production, you may want to restrict this to admins only
      allow list: if request.auth != null;
      // Users can create their own document (for registration or initial admin setup)
      allow create: if request.auth != null && request.auth.token.email == userId;
      // Only admins can update user status and roles
      // Note: This requires checking if the current user is an admin
      // For now, allow authenticated users to update (admin check is done in application code)
      allow update: if request.auth != null;
    }
  }
}
```

3. Click "Publish" to save the rules

### Storage Rules

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

3. Click "Publish" to save the rules

### Storage CORS Configuration (REQUIRED for Downloads)

To allow downloads from your web app, you need to configure CORS for Firebase Storage. **The easiest way is through the Google Cloud Console (no installation required):**

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Sign in with the same Google account used for Firebase

2. **Select Your Project:**
   - Click the project dropdown at the top
   - Select: **sanctuary-hoa-arch-review**

3. **Navigate to Cloud Storage:**
   - In the left menu, click **"Cloud Storage"** (under "Storage")
   - Click **"Buckets"**

4. **Select Your Storage Bucket:**
   - Click on: **sanctuary-hoa-arch-review.firebasestorage.app**

5. **Configure CORS:**
   - Click the **"Configuration"** tab at the top
   - Scroll to **"CORS configuration"** section
   - Click **"Edit CORS configuration"** button
   - Paste this JSON:
   ```json
   [
     {
       "origin": ["https://thomas-ryan-crosby.github.io"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": ["Content-Type", "Authorization"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   - Click **"Save"**

6. **Test:** Try downloading an approval letter - it should work now!

**Alternative (Command Line):** If you have Google Cloud SDK installed, you can use:
```bash
gsutil cors set cors.json gs://sanctuary-hoa-arch-review.firebasestorage.app
```
(The `cors.json` file is already in your project directory)

**Note:** If testing locally, add `http://localhost:8000` to the origin array in the CORS config.

**Important:** 
- **Firestore Read access:** Anyone can view projects (no login required)
- **Firestore Write access:** Only authenticated users can create, edit, or delete projects
- **Storage access:** Only authenticated users can upload/download approval letters
- This allows public viewing while protecting data modification and file access

## Step 6: Update firebase-config.js

After creating `js/firebase-config.js`, add your configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Replace the values with your actual Firebase configuration.

