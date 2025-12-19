# Configure CORS for Firebase Storage

## Quick Setup via Google Cloud Console (No Installation Required)

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Make sure you're signed in with the same Google account used for Firebase

2. **Select Your Project:**
   - Click the project dropdown at the top
   - Select: **sanctuary-hoa-arch-review**

3. **Navigate to Cloud Storage:**
   - In the left menu, click **"Cloud Storage"** (under "Storage")
   - Click **"Buckets"**

4. **Select Your Storage Bucket:**
   - Click on the bucket: **sanctuary-hoa-arch-review.firebasestorage.app**

5. **Configure CORS:**
   - Click the **"Configuration"** tab at the top
   - Scroll down to **"CORS configuration"** section
   - Click **"Edit CORS configuration"** button

6. **Add CORS Rules:**
   - Paste this JSON configuration:
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

7. **Save:**
   - Click **"Save"** button
   - Wait a few seconds for the configuration to apply

8. **Test:**
   - Go back to your app
   - Try downloading an approval letter
   - It should work now!

## Alternative: Install Google Cloud SDK (If You Prefer Command Line)

If you want to use the command line instead:

1. **Install Google Cloud SDK:**
   - Download from: https://cloud.google.com/sdk/docs/install
   - Follow the installation instructions for Windows

2. **Authenticate:**
   ```bash
   gcloud auth login
   ```

3. **Set Project:**
   ```bash
   gcloud config set project sanctuary-hoa-arch-review
   ```

4. **Set CORS:**
   ```bash
   gsutil cors set cors.json gs://sanctuary-hoa-arch-review.firebasestorage.app
   ```

The `cors.json` file has already been created in your project directory.

