# Production Deployment Checklist

## Pre-Deployment Steps

### 1. Firebase Configuration ✅
- [ ] Firebase project created
- [ ] Firestore Database enabled
- [ ] Authentication enabled (Email/Password)
- [ ] First admin user created in Firebase Console
- [ ] Firebase config added to `js/firebase-config.js`

### 2. Security Rules ✅
- [ ] Firestore security rules updated to require authentication:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /projects/{projectId} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```
- [ ] Rules published in Firebase Console

### 3. User Management
- [ ] Create user accounts for all authorized users
- [ ] Document user credentials securely
- [ ] Consider setting up password reset functionality (optional)

### 4. Testing
- [ ] Test login with created user
- [ ] Test creating a project
- [ ] Test editing a project
- [ ] Test deleting a project
- [ ] Test generating approval letters
- [ ] Test uploading PDFs
- [ ] Verify projects sync across browsers

### 5. GitHub Pages
- [ ] All code pushed to GitHub
- [ ] GitHub Pages enabled and working
- [ ] Site accessible at: https://thomas-ryan-crosby.github.io/shoa-architectural-review/

## Post-Deployment

### 6. Monitoring
- [ ] Monitor Firebase usage (Firestore reads/writes)
- [ ] Check Firebase Console for any errors
- [ ] Monitor authentication attempts

### 7. Security
- [ ] Verify only authenticated users can access data
- [ ] Review Firebase security rules regularly
- [ ] Keep Firebase API keys secure (already in repo, but monitor usage)

## Important Notes

- **Authentication is REQUIRED** - Users must sign in to use the app
- **No localStorage** - All data is stored in Firestore only
- **PDF Size Limit** - PDFs must be under 800KB to store in Firestore
- **User Management** - Add new users via Firebase Console > Authentication > Users

## Troubleshooting

**Users can't sign in:**
- Check that Email/Password authentication is enabled
- Verify user exists in Firebase Console
- Check browser console for errors

**Projects not loading:**
- Verify Firestore security rules are published
- Check that user is authenticated
- Verify Firestore is enabled

**PDF upload fails:**
- Check PDF size (must be < 800KB)
- Try compressing the PDF
- Check browser console for errors

