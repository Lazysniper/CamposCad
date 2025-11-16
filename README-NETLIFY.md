# Deploying to Netlify

This guide will help you deploy your Express app to Netlify using serverless functions.

## Prerequisites

- A Netlify account (free tier works)
- Your code pushed to GitHub, GitLab, or Bitbucket
- MongoDB connection string
- CTT Postal API key

## Setup Steps

### 1. Install Dependencies Locally (Optional)

```bash
npm install
```

This will install `serverless-http` which is required for Netlify Functions.

### 2. Push to Git

Make sure all your code is committed and pushed:

```bash
git add .
git commit -m "Configure for Netlify deployment"
git push origin main
```

### 3. Connect to Netlify

1. Go to [netlify.com](https://www.netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect your Git provider (GitHub/GitLab/Bitbucket)
4. Select your repository
5. Netlify will auto-detect the settings from `netlify.toml`

### 4. Configure Environment Variables

In Netlify Dashboard → Site settings → Environment variables, add:

- `MONGODB_URI` - Your MongoDB connection string
- `POSTAL_API_KEY` - Your CTT Postal API key
- `ADMIN_USER` - Admin username
- `ADMIN_PASSWORD` - Admin password (use a strong password!)
- `SESSION_SECRET` - A random secret string for sessions (generate one)
- `PAGE_SIZE` - Items per page (optional, default: 20)

**Important:** Generate a secure `SESSION_SECRET`:
```bash
# On Linux/Mac:
openssl rand -base64 32

# Or use an online generator
```

### 5. Deploy

Netlify will automatically:
- Run `npm install` (from `netlify.toml`)
- Build your functions
- Deploy your site

### 6. Verify Deployment

- Check the deploy logs in Netlify dashboard
- Visit your site URL (provided by Netlify)
- Test the `/search` endpoint
- Test admin login at `/gestao/codigos`

## Important Notes

### File Uploads

- File uploads use `/tmp` directory (Netlify's temporary storage)
- Files are deleted after processing
- For persistent storage, consider using AWS S3 or similar

### MongoDB Connection

- MongoDB connection is reused across function invocations
- Connection pooling is handled automatically
- Make sure your MongoDB allows connections from Netlify's IP ranges

### Session Storage

- Sessions use in-memory storage by default
- For production, consider using:
  - MongoDB session store
  - Redis (via Upstash or similar)
  - Netlify's built-in session management

### Function Timeout

- Netlify Functions have a 10-second timeout on free tier
- 26 seconds on Pro plan
- Large CSV uploads might timeout - consider chunking or async processing

## Troubleshooting

### Function Timeout

If you see timeout errors:
- Optimize database queries
- Consider using background jobs for large operations
- Upgrade to Netlify Pro for longer timeouts

### MongoDB Connection Issues

- Check MongoDB IP whitelist (allow all IPs or Netlify's IPs)
- Verify connection string format
- Check MongoDB Atlas network access settings

### View Rendering Issues

- Ensure `views/` directory is included in deployment
- Check that EJS templates are being found correctly
- Verify file paths in `netlify/functions/server.js`

### Environment Variables Not Working

- Make sure variables are set in Netlify dashboard
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

## Local Testing

To test Netlify Functions locally:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Start local dev server
netlify dev
```

This will simulate the Netlify environment locally.

## Custom Domain

1. Go to Site settings → Domain management
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL is automatically provisioned by Netlify

## Monitoring

- Check function logs in Netlify dashboard
- Monitor function execution time
- Set up alerts for errors
- Use Netlify Analytics (Pro feature)

## Cost Considerations

- **Free Tier:**
  - 100GB bandwidth/month
  - 300 build minutes/month
  - 125,000 function invocations/month
  - 10-second function timeout

- **Pro Tier ($19/month):**
  - 1TB bandwidth/month
  - 500 build minutes/month
  - 1M function invocations/month
  - 26-second function timeout

## Alternative: Keep app.js for Local Development

Your original `app.js` still works for local development. The Netlify function is in `netlify/functions/server.js` and only runs on Netlify.

To run locally:
```bash
node app.js
```

To deploy to Netlify:
- Push to Git
- Netlify automatically uses `netlify/functions/server.js`

