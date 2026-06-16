# Deployment Guide

This document provides step-by-step instructions for deploying the Medicaid Enrollment Portal to production environments, with a focus on Vercel deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Configuration](#build-configuration)
- [Vercel Deployment](#vercel-deployment)
  - [One-Click Deploy](#one-click-deploy)
  - [Vercel CLI Deployment](#vercel-cli-deployment)
  - [GitHub Integration](#github-integration)
- [Environment Variables](#environment-variables)
- [SPA Rewrite Configuration](#spa-rewrite-configuration)
- [CI/CD with GitHub and Vercel](#cicd-with-github-and-vercel)
- [Static Hosting Alternatives](#static-hosting-alternatives)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have the following:

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher
- A [Vercel](https://vercel.com/) account (for Vercel deployment)
- A GitHub, GitLab, or Bitbucket repository containing the project source code
- All dependencies installed locally (`npm install`)

Verify your local build works before deploying:

```bash
npm run build
```

The output will be generated in the `dist/` directory.

---

## Build Configuration

The project uses [Vite 5](https://vitejs.dev/) as the build tool. The build configuration is defined in `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
```

### Build Command

```bash
npm run build
```

This runs `vite build` which:

1. Compiles all JSX and JavaScript source files
2. Processes Tailwind CSS via PostCSS
3. Tree-shakes unused code
4. Generates optimized, minified bundles
5. Outputs everything to the `dist/` directory

### Output Directory

```
dist/
```

The `dist/` directory contains the production-ready static files:

- `index.html` — The entry HTML file
- `assets/` — Hashed JavaScript and CSS bundles
- `vite.svg` — Static assets from `public/`

### Preview Production Build Locally

After building, you can preview the production build locally:

```bash
npm run preview
```

This starts a local server serving the `dist/` directory at `http://localhost:4173`.

---

## Vercel Deployment

### One-Click Deploy

The simplest way to deploy is to import your Git repository directly from the Vercel dashboard:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository**
3. Choose your repository (GitHub, GitLab, or Bitbucket)
4. Vercel will auto-detect the Vite framework and configure:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Configure environment variables (see [Environment Variables](#environment-variables))
6. Click **Deploy**

### Vercel CLI Deployment

For command-line deployment:

1. **Install the Vercel CLI globally:**

   ```bash
   npm i -g vercel
   ```

2. **Log in to your Vercel account:**

   ```bash
   vercel login
   ```

3. **Deploy from the project root:**

   ```bash
   vercel
   ```

   The CLI will prompt you to:
   - Link to an existing project or create a new one
   - Confirm the project settings

4. **Deploy to production:**

   ```bash
   vercel --prod
   ```

5. **Verify the deployment:**

   The CLI will output the deployment URL. Open it in your browser to verify.

### GitHub Integration

For automatic deployments on every push:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will automatically:
   - Deploy on every push to the `main` branch (production)
   - Create preview deployments for every pull request
   - Run the build command and verify it succeeds before promoting

#### Branch Configuration

| Branch | Deployment Type | URL Pattern |
|---|---|---|
| `main` | Production | `your-project.vercel.app` |
| Feature branches | Preview | `your-project-<hash>.vercel.app` |
| Pull requests | Preview | `your-project-<pr-number>.vercel.app` |

---

## Environment Variables

The application uses environment variables prefixed with `VITE_` for client-side configuration. These must be set in your deployment platform.

### Required Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_TITLE` | `Medicaid Enrollment Portal` | Application title displayed in the browser tab and header |
| `VITE_DEFAULT_ROLE` | `applicant` | Default user role for the application |
| `VITE_STORAGE_PREFIX` | `medicaid_` | Prefix used for localStorage keys to avoid collisions |
| `VITE_MAX_FILE_SIZE_MB` | `10` | Maximum file upload size in megabytes |

### Setting Environment Variables on Vercel

#### Via Vercel Dashboard

1. Navigate to your project on [vercel.com](https://vercel.com)
2. Go to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name:** `VITE_APP_TITLE`
   - **Value:** `Medicaid Enrollment Portal`
   - **Environment:** Select `Production`, `Preview`, and/or `Development` as needed
4. Click **Save**
5. Redeploy for changes to take effect

#### Via Vercel CLI

```bash
vercel env add VITE_APP_TITLE
# Follow the prompts to set the value and target environments
```

To list all environment variables:

```bash
vercel env ls
```

#### Via `.env` File (Local Development Only)

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
VITE_APP_TITLE=Medicaid Enrollment Portal
VITE_DEFAULT_ROLE=applicant
VITE_STORAGE_PREFIX=medicaid_
VITE_MAX_FILE_SIZE_MB=10
```

> **Important:** The `.env` file is listed in `.gitignore` and should never be committed to version control. Environment variables for production must be configured in the deployment platform.

### Environment Variable Behavior

- Variables prefixed with `VITE_` are embedded into the client-side bundle at build time
- Changing environment variables requires a new build/deployment to take effect
- Variables are accessed in code via `import.meta.env.VITE_*`
- Non-prefixed variables are NOT exposed to the client-side code

---

## SPA Rewrite Configuration

The application uses client-side routing via React Router v6 with `createBrowserRouter`. This means all routes (e.g., `/members`, `/upload`, `/eligibility`) are handled by the JavaScript application, not the server.

For this to work correctly, the hosting platform must rewrite all requests to `index.html` so that React Router can handle the routing.

### Vercel Configuration

The project includes a `vercel.json` file that configures SPA rewrites:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This configuration tells Vercel to:

1. Match any incoming request path (`/(.*)`)
2. Serve `index.html` for all matched paths
3. Allow React Router to handle the routing on the client side

### How It Works

Without the rewrite rule:

- Navigating directly to `https://your-app.vercel.app/members` would return a 404 error because there is no `members/index.html` file in the `dist/` directory.

With the rewrite rule:

- Navigating to `https://your-app.vercel.app/members` serves `index.html`, which loads the JavaScript bundle, and React Router renders the correct page component.

### Important Notes

- The `vercel.json` file must be in the project root directory (same level as `package.json`)
- Static assets in `dist/assets/` are served directly and are not affected by the rewrite rule
- The `public/` directory contents (e.g., `vite.svg`) are copied to `dist/` and served as static files

---

## CI/CD with GitHub and Vercel

### Automatic Deployments

When your GitHub repository is connected to Vercel:

1. **Push to `main`** → Triggers a production deployment
2. **Open a pull request** → Triggers a preview deployment
3. **Push to a PR branch** → Updates the preview deployment

### Build Process on Vercel

For each deployment, Vercel runs:

```
npm install
npm run build
```

The build output in `dist/` is then deployed to Vercel's edge network.

### Build Checks

Before deploying, ensure your project passes all checks locally:

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm test

# Build the project
npm run build
```

### GitHub Actions (Optional)

If you want to run tests before Vercel deploys, you can add a GitHub Actions workflow. Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
```

### Vercel Build Settings Override

If you need to customize the build settings, you can do so in the Vercel dashboard:

1. Go to **Settings** → **General**
2. Under **Build & Development Settings**:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
   - **Node.js Version:** 18.x

---

## Static Hosting Alternatives

The application can be deployed to any static hosting platform that supports SPA rewrites.

### Netlify

Create a `netlify.toml` in the project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Nginx

Add the following to your Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Apache

Create a `.htaccess` file in the `dist/` directory:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Docker

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create an `nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:

```bash
docker build -t medicaid-portal .
docker run -p 8080:80 medicaid-portal
```

---

## Troubleshooting

### Common Issues

#### 1. 404 Errors on Direct URL Access

**Symptom:** Navigating directly to a route like `/members` or `/upload` returns a 404 error.

**Cause:** The hosting platform is not configured to rewrite all routes to `index.html`.

**Solution:**
- Verify `vercel.json` exists in the project root with the correct rewrite rule
- For other platforms, ensure the equivalent SPA rewrite/redirect is configured
- Redeploy after adding or modifying the configuration file

#### 2. Blank Page After Deployment

**Symptom:** The deployed site shows a blank white page with no content.

**Cause:** Usually a JavaScript error or incorrect asset paths.

**Solution:**
- Open the browser developer console (F12) and check for errors
- Verify the build completed successfully without errors (`npm run build`)
- Check that the `base` option in `vite.config.js` is not set incorrectly (it should be omitted or set to `'/'` for root deployment)
- Ensure all environment variables are set correctly in the deployment platform

#### 3. Environment Variables Not Working

**Symptom:** Environment variable values are `undefined` or show default values in production.

**Cause:** Variables were not set in the deployment platform, or the build was not triggered after setting them.

**Solution:**
- Verify variables are set in the Vercel dashboard under **Settings** → **Environment Variables**
- Ensure variable names are prefixed with `VITE_`
- Trigger a new deployment after adding or changing environment variables (variables are embedded at build time)
- Check that you are not referencing `process.env` — use `import.meta.env.VITE_*` instead

#### 4. Build Fails on Vercel

**Symptom:** The deployment fails during the build step.

**Cause:** Missing dependencies, Node.js version mismatch, or code errors.

**Solution:**
- Check the Vercel build logs for specific error messages
- Ensure `package.json` lists all required dependencies
- Verify the Node.js version matches (set to 18.x in Vercel project settings)
- Run `npm run build` locally to reproduce and fix the error
- Run `npm run lint` to catch code issues before deploying

#### 5. localStorage Data Not Persisting

**Symptom:** Application data (members, files, enrollments) is lost between sessions.

**Cause:** This is expected behavior — localStorage is browser-specific and not shared across devices or browsers.

**Solution:**
- localStorage is used for demo/development purposes only
- Data persists within the same browser on the same device
- Use the **Settings** page to export data as JSON for backup
- Use the **Settings** page to import previously exported data
- For production use cases, a backend database would replace localStorage

#### 6. Tailwind CSS Styles Missing

**Symptom:** Components appear unstyled or with broken layouts.

**Cause:** Tailwind CSS purge/content configuration is not scanning the correct files.

**Solution:**
- Verify `tailwind.config.js` includes the correct content paths:
  ```js
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  ```
- Ensure `postcss.config.js` includes the Tailwind plugin
- Ensure `src/index.css` includes the Tailwind directives:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- Run a clean build: delete `dist/` and `node_modules/.vite/`, then rebuild

#### 7. CORS Errors in Browser Console

**Symptom:** Network requests fail with CORS-related error messages.

**Cause:** This application uses mock endpoints and does not make real API calls. If you see CORS errors, it may be from browser extensions or a misconfigured proxy.

**Solution:**
- The application is fully client-side with no external API dependencies
- All data processing happens in the browser using Zustand stores and localStorage
- Mock endpoints (`mockApiUpload`, `mockSftpUpload`) simulate API behavior without network requests
- If you have added real API endpoints, configure CORS on the API server

#### 8. Large Bundle Size

**Symptom:** The deployed application loads slowly due to large JavaScript bundles.

**Solution:**
- Vite automatically code-splits and tree-shakes the production build
- Check bundle size with: `npx vite-bundle-visualizer`
- Ensure `sourcemap: true` in `vite.config.js` is set to `false` for production if source maps are not needed (reduces deployed file size)
- Consider lazy-loading routes if the bundle grows significantly

### Getting Help

If you encounter issues not covered here:

1. Check the [Vite documentation](https://vitejs.dev/guide/)
2. Check the [Vercel documentation](https://vercel.com/docs)
3. Check the [React Router documentation](https://reactrouter.com/)
4. Review the build logs for specific error messages
5. Run `npm run lint` and `npm test` locally to catch issues before deploying