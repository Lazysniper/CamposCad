# Campos Cadilhe - Postal Code Management System

A Node.js/Express application for managing and searching Portuguese postal codes with MongoDB integration.

## Features

- Search postal codes from the database
- Admin interface for managing postal codes
- CSV upload functionality
- Integration with CTTCódigoPostal API
- Responsive UI with improved contrast for SEO

## Deployment

### Render (Recommended)

This application is configured for deployment on Render. The `render.yaml` file contains the deployment configuration.

#### Setup Steps:

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Render**
   - Go to [render.com](https://render.com)
   - Sign up/login and connect your GitHub account
   - Click "New +" → "Blueprint"
   - Select your repository
   - Render will automatically detect `render.yaml`

3. **Set Environment Variables in Render Dashboard:**
   - `MONGODB_URI` - Your MongoDB connection string
   - `POSTAL_API_KEY` - CTT Postal API key
   - `ADMIN_USER` - Admin username
   - `ADMIN_PASSWORD` - Admin password
   - `SESSION_SECRET` - Random secret for sessions (generate a secure random string)
   - `PORT` - Will be set automatically by Render (optional)
   - `PAGE_SIZE` - Items per page (default: 20, optional)

4. **Deploy**
   - Render will automatically deploy on push to main branch
   - Check the logs for any issues

### Alternative Platforms

- **Railway**: Similar to Render, supports Node.js apps
- **Heroku**: Requires credit card for free tier
- **Vercel**: Can work with serverless functions (requires refactoring)
- **AWS/Google Cloud/Azure**: Full cloud platforms

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```env
   MONGODB_URI=your_mongodb_uri
   POSTAL_API_KEY=your_api_key
   ADMIN_USER=admin
   ADMIN_PASSWORD=your_password
   SESSION_SECRET=your_random_secret
   PORT=3000
   PAGE_SIZE=20
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Main search: http://localhost:3000/search
   - Admin panel: http://localhost:3000/gestao/codigos

## Project Structure

```
├── app.js              # Main Express application
├── views/              # EJS templates
│   ├── index.ejs
│   ├── search.ejs
│   ├── login.ejs
│   ├── manage.ejs
│   └── upload.ejs
├── uploads/            # CSV upload directory
├── render.yaml         # Render deployment config
├── package.json        # Dependencies
└── .env                # Environment variables (not in git)
```

## Notes

- The `.env` file is gitignored for security
- Make sure to set all required environment variables in your deployment platform
- The application uses MongoDB for data storage
- File uploads are stored in the `uploads/` directory

