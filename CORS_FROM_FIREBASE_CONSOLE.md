# Configure CORS from Firebase Console

You're currently in Firebase Console Storage. Here's how to configure CORS:

## Step-by-Step Instructions:

### Option 1: Use the Direct Link
1. **Click on the bucket name** in the header: `sanctuary-hoa-arch-review.firebasestorage.app`
   - This should open a dropdown or take you to Google Cloud Console
   
   OR

2. **Try this direct link:**
   ```
   https://console.cloud.google.com/storage/browser/sanctuary-hoa-arch-review.firebasestorage.app?project=sanctuary-hoa-arch-review
   ```

### Option 2: Navigate Manually
1. **In the Firebase Console Storage page**, look for:
   - A link that says "Open in Google Cloud Console" 
   - Or click the three-dot menu (⋮) next to the bucket name
   - Or look for a "Manage" or "Settings" button

2. **If you can't find a link**, go directly to:
   - https://console.cloud.google.com/
   - Make sure you're signed in with the same Google account
   - In the project dropdown at the top, search for or select: **sanctuary-hoa-arch-review**
   - If it doesn't appear, see "Troubleshooting" below

### Once in Google Cloud Console:
1. **Navigate to Storage:**
   - Click "Cloud Storage" in the left menu (under "Storage")
   - Click "Buckets"
   - Click on: **sanctuary-hoa-arch-review.firebasestorage.app**

2. **Configure CORS:**
   - Click the **"Configuration"** tab at the top
   - Scroll down to find **"CORS configuration"** section
   - Click **"Edit CORS configuration"** button
   - Delete any existing content
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

3. **Test:**
   - Go back to your app
   - Try downloading an approval letter
   - It should work now!

## Troubleshooting:

### If the project doesn't appear in Google Cloud Console:

1. **Check if project is linked:**
   - In Firebase Console, click the gear icon ⚙️ (top left)
   - Click "Project settings"
   - Scroll to "Your project" section
   - Look for "Default GCP resource location"
   - If it's empty, you may need to set it

2. **Try the direct storage URL:**
   ```
   https://console.cloud.google.com/storage/browser?project=sanctuary-hoa-arch-review
   ```

3. **Make sure you're using the correct Google account** that has access to the Firebase project

