# Quick CORS Setup - Step by Step

## If you don't see your project in Google Cloud Console:

Firebase projects are separate from Google Cloud projects. Here's the easiest way to configure CORS:

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com/
2. Sign in with your Google account
3. Click on **sanctuary-hoa-arch-review** project

### Step 2: Access Storage
1. In the left menu, click **"Storage"**
2. You should see your storage bucket

### Step 3: Open in Google Cloud Console
1. Look for a link/button that says:
   - **"Open in Google Cloud Console"** OR
   - **"Manage storage in Google Cloud Console"** OR
   - A link icon next to the bucket name
2. Click it - this will open the bucket in Google Cloud Console

### Step 4: Configure CORS
1. In Google Cloud Console, click the **"Configuration"** tab at the top
2. Scroll down to find **"CORS configuration"** section
3. Click **"Edit CORS configuration"** button
4. Delete any existing content
5. Paste this:
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
6. Click **"Save"**

### Step 5: Test
- Go back to your app
- Try downloading an approval letter
- It should work!

---

## Alternative: Direct URL

If you can't find the link, try going directly to:
https://console.cloud.google.com/storage/browser?project=sanctuary-hoa-arch-review

This should open your storage bucket directly.

---

## Still Can't Access?

If you still can't see the project, you may need to:
1. Make sure you're signed in with the correct Google account
2. Check that you have the right permissions on the Firebase project
3. The project might need to be upgraded to Blaze plan (but CORS should work on free tier too)

Let me know if you need help with any of these steps!


