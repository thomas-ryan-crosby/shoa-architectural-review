# Configure CORS for Firebase Storage - Command Line Method

Since the CORS configuration option may not be visible in the Google Cloud Console UI, you can configure it using the command line.

## Method 1: Using gcloud storage (Recommended - Newer Method)

According to [Google Cloud Documentation](https://docs.cloud.google.com/livestream/docs/how-to/configure-cors), the recommended way to configure CORS is using the `gcloud storage` command.

### Step 1: Install Google Cloud SDK

1. **Download Google Cloud SDK:**
   - Visit: https://cloud.google.com/sdk/docs/install
   - Download the installer for your operating system (Windows/Mac/Linux)
   - Run the installer and follow the prompts

2. **Authenticate:**
   ```bash
   gcloud auth login
   ```

3. **Set your project:**
   ```bash
   gcloud config set project sanctuary-hoa-arch-review
   ```

### Step 2: Configure CORS

1. **Make sure you're in the project directory** (where `cors.json` is located)

2. **Run this command:**
   ```bash
   gcloud storage buckets update gs://sanctuary-hoa-arch-review.firebasestorage.app --cors-file=cors.json
   ```

3. **Verify it worked:**
   ```bash
   gcloud storage buckets describe gs://sanctuary-hoa-arch-review.firebasestorage.app --format="value(cors)"
   ```
   
   Or use the older gsutil command if gcloud storage doesn't work:
   ```bash
   gsutil cors get gs://sanctuary-hoa-arch-review.firebasestorage.app
   ```

You should see the CORS configuration printed out.

## Method 2: Using Firebase CLI

If you have Firebase CLI installed:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login:**
   ```bash
   firebase login
   ```

3. **Configure CORS:**
   ```bash
   gcloud storage buckets update gs://sanctuary-hoa-arch-review.firebasestorage.app --cors-file=cors.json
   ```

## Method 3: Direct API Call (Advanced)

If neither of the above work, you can use the Google Cloud Storage JSON API directly. This requires creating a service account and using OAuth2.

## Troubleshooting

### "Command not found: gcloud" or "Command not found: gsutil"
- Make sure Google Cloud SDK is installed and in your PATH
- On Windows, you may need to restart your terminal after installation
- Try using `gsutil` if `gcloud storage` doesn't work (older method)

### "Access Denied" or "Permission Denied"
- Make sure you're authenticated: `gcloud auth login`
- Make sure you have Owner or Storage Admin permissions on the Firebase project
- Try: `gcloud auth application-default login`

### "Bucket not found"
- Verify the bucket name: `sanctuary-hoa-arch-review.firebasestorage.app`
- Make sure you're using the correct project: `gcloud config get-value project`

## Verify CORS is Working

After configuring CORS, test it by:
1. Going to your app: https://thomas-ryan-crosby.github.io/shoa-architectural-review/
2. Try generating an approval letter that includes site conditions or submitted plans
3. Check the browser console - you should no longer see CORS errors

## Need Help?

If you're still having issues:
1. Check that `cors.json` exists in your project directory
2. Verify the bucket name matches exactly
3. Make sure you're authenticated with the correct Google account
4. Try running `gcloud projects list` to see if you have access to the project

