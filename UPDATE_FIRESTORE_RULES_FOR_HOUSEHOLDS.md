# Update Firestore Rules for Households Collection

## Problem
You're seeing this error:
```
Error listening to households: FirebaseError: Missing or insufficient permissions.
Error initializing households: FirebaseError: Missing or insufficient permissions.
```

This means your Firestore security rules don't include the `households` collection yet.

## Solution: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **sanctuary-hoa-arch-review**
3. Click **"Firestore Database"** in the left menu
4. Click the **"Rules"** tab at the top
5. **Replace** the existing rules with this (make sure to include the households section):

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
    
    // Households collection - for property and member management
    match /households/{householdId} {
      // Authenticated users can read all households
      allow read: if request.auth != null;
      // Only authenticated users can create (admin check done in app code)
      allow create: if request.auth != null;
      // Authenticated users can update (admin/household_admin check done in app code)
      allow update: if request.auth != null;
      // Only authenticated users can delete (admin check done in app code)
      allow delete: if request.auth != null;
    }
  }
}
```

6. Click **"Publish"** to save the rules
7. Wait a few seconds for the rules to propagate
8. **Refresh your web app** (hard refresh: Ctrl+F5 or Cmd+Shift+R)

## What These Rules Do

- ✅ **`allow read: if request.auth != null`** - Authenticated users can view all households
- 🔒 **`allow create: if request.auth != null`** - Only logged-in users can create households (admin check done in app)
- 🔒 **`allow update: if request.auth != null`** - Only logged-in users can update households (admin/household_admin check done in app)
- 🔒 **`allow delete: if request.auth != null`** - Only logged-in users can delete households (admin check done in app)

## Verify It's Working

After updating the rules:
1. Make sure you're signed in as an admin
2. Open the "Households & Members" tab
3. Open the browser console (F12)
4. You should see:
   - ✅ "HouseholdManager: Firestore initialized"
   - ✅ "Initializing households from embedded data..."
   - ✅ "Household initialization complete: X imported, 0 skipped"
5. All 423 households should appear in the list

## Still Not Working?

If you still see permission errors:
1. Make sure you clicked **"Publish"** (not just "Save")
2. Wait 30-60 seconds for rules to propagate
3. Make sure you're signed in (the rules require authentication)
4. Try a hard refresh (Ctrl+F5 or Cmd+Shift+R)

