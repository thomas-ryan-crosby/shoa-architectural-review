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

1. In Firestore Database, click "Rules" tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require authentication for all operations
    match /projects/{projectId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish" to save the rules

**Important:** These rules require users to be authenticated. Only signed-in users can read or write projects.

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

