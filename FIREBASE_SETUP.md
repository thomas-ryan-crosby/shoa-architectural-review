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
  }
}
```

3. Click "Publish" to save the rules

### Storage CORS Configuration (REQUIRED for Downloads)

To allow downloads from your web app, you need to configure CORS for Firebase Storage:

1. Install Google Cloud SDK (if not already installed): https://cloud.google.com/sdk/docs/install
2. Run this command in your terminal (replace `sanctuary-hoa-arch-review` with your project ID):

```bash
gsutil cors set cors.json gs://sanctuary-hoa-arch-review.firebasestorage.app
```

3. Create a file named `cors.json` with this content:

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

**Note:** If you're testing locally, also add `http://localhost:8000` or your local development URL to the origin array.

**Alternative:** If you can't use gsutil, you can configure CORS through the Google Cloud Console:
1. Go to https://console.cloud.google.com/
2. Select your Firebase project
3. Navigate to Cloud Storage > Buckets
4. Click on your storage bucket
5. Go to the "Configuration" tab
6. Click "Edit CORS configuration"
7. Add the CORS configuration above

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

