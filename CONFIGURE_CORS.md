# Configure CORS for Firebase Storage

## Method 1: Via Firebase Console (Easiest - Recommended)

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Make sure you're signed in with the same Google account

2. **Select Your Project:**
   - Click on: **sanctuary-hoa-arch-review**

3. **Navigate to Storage:**
   - In the left menu, click **"Storage"**
   - You should see your storage bucket

4. **Open Google Cloud Console:**
   - In the Storage page, look for a link or button that says **"Open in Google Cloud Console"** or **"Manage storage in Google Cloud Console"**
   - Click it (this will open the bucket in Google Cloud Console)

5. **Configure CORS:**
   - In Google Cloud Console, click the **"Configuration"** tab
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

6. **Test:**
   - Go back to your app
   - Try downloading an approval letter
   - It should work now!

## Method 2: Direct Google Cloud Console Access

If Method 1 doesn't work, you may need to link your Firebase project to Google Cloud:

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select: **sanctuary-hoa-arch-review**

2. **Link to Google Cloud:**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Click **"Project settings"**
   - Scroll to **"Your project"** section
   - If you see "Default GCP resource location", your project is already linked
   - If not, you may need to upgrade to the Blaze plan (pay-as-you-go) to access Google Cloud features

3. **Access Google Cloud Console:**
   - In Firebase Console, click the gear icon ⚙️
   - Click **"Project settings"**
   - Scroll down and click **"Open in Google Cloud Console"** link
   - This will open your project in Google Cloud Console

4. **Navigate to Storage:**
   - In Google Cloud Console, click **"Cloud Storage"** in the left menu
   - Click **"Buckets"**
   - Click on: **sanctuary-hoa-arch-review.firebasestorage.app**

5. **Configure CORS:**
   - Click the **"Configuration"** tab
   - Scroll to **"CORS configuration"**
   - Click **"Edit CORS configuration"**
   - Paste the JSON from Method 1
   - Click **"Save"**

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

