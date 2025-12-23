# Fix: Firestore Permission Error

## Problem
You're seeing this error:
```
Error in real-time listener: FirebaseError: Missing or insufficient permissions.
```

This means your Firestore security rules are blocking unauthenticated users from reading projects.

## Solution: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **sanctuary-hoa-arch-review**
3. Click **"Firestore Database"** in the left menu
4. Click the **"Rules"** tab at the top
5. **Replace** the existing rules with this:

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

6. Click **"Publish"** to save the rules
7. Wait a few seconds for the rules to propagate
8. **Refresh your web app** (hard refresh: Ctrl+F5)

## What These Rules Do

- ✅ **`allow read: if true`** - Anyone can view projects (no login required)
- 🔒 **`allow write: if request.auth != null`** - Only logged-in users can create/edit/delete projects

This matches your requirement: "Anyone should be able to see the projects at any time, but you do have to login to make changes."

## Verify It's Working

After updating the rules:
1. Open your app in a browser (not logged in)
2. Open the browser console (F12)
3. You should see:
   - ✅ "Real-time listener set up successfully"
   - ✅ "Snapshot: X total docs, X changes"
   - ✅ "Rendering X projects"
4. Projects should appear in the Project Overview tab

## Still Not Working?

If you still see permission errors:
1. Make sure you clicked **"Publish"** (not just "Save")
2. Wait 30-60 seconds for rules to propagate
3. Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)
4. Check the Firebase Console Rules tab to confirm the rules are saved
5. Check the browser console for any other errors


