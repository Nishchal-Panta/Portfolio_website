# Deployment Guide

## Quick Start

### Prerequisites
- GitHub account
- Git installed locally
- Portfolio files ready

### Deployment in 5 Minutes

1. **Create repository**
   ```bash
   # On GitHub.com create new repo named "portfolio"
   ```

2. **Clone and add files**
   ```bash
   git clone https://github.com/YOUR-USERNAME/portfolio.git
   cd portfolio
   # Copy all portfolio files here
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Initial portfolio commit"
   git push origin main
   ```

4. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Select "main" as source
   - Click Save

5. **Deploy automatically**
   - GitHub Actions runs workflow automatically
   - Site goes live at `https://YOUR-USERNAME.github.io/portfolio/`

---

## Detailed Setup Guide

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click "New" repository button
3. Repository name: `portfolio`
4. Description: "Personal portfolio website"
5. Visibility: **Public** (required for GitHub Pages)
6. **Do NOT** initialize with README (use your own)
7. Click "Create repository"

### Step 2: Prepare Local Repository

#### Option A: Using Git Command Line

```bash
# Navigate to portfolio folder
cd /path/to/portfolio

# Initialize git
git init

# Add remote
git remote add origin https://github.com/YOUR-USERNAME/portfolio.git

# Rename branch to main (if needed)
git branch -M main

# Verify setup
git remote -v
```

#### Option B: GitHub Desktop

1. Click "File" → "Clone Repository"
2. Select your `portfolio` repository
3. Click "Clone"

### Step 3: Add Portfolio Files

Ensure these files are in your repository:

```
portfolio/
├── index.html
├── style.css
├── script.js
├── README.md
├── assets/
│   ├── images/
│   └── files/
│       └── Nishchal_Panta_CV.pdf
├── docs/
│   ├── context.md
│   ├── requirements.md
│   ├── design-system.md
│   ├── content-strategy.md
│   ├── project-analysis.md
│   └── deployment-guide.md
└── .github/
    └── workflows/
        └── deploy.yml
```

### Step 4: Commit Files

```bash
# Stage all files
git add .

# Create initial commit
git commit -m "Initial portfolio website commit

- Add HTML structure with all sections
- Add modern CSS with dark/light mode
- Add vanilla JavaScript interactivity
- Add GitHub Actions CI/CD workflow
- Add comprehensive documentation"

# Push to GitHub
git push -u origin main
```

**Expected output:**
```
Counting objects: XX, done.
Delta compression using up to XX threads.
Compressing objects: 100% (XX/XX), done.
Writing objects: 100% (XX/XX), ...
```

### Step 5: Configure GitHub Pages

1. Go to your repository on GitHub.com
2. Click "Settings" tab
3. In left sidebar, click "Pages"
4. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
   - (The custom workflow will handle deployment)
5. Click "Save"

**Wait 1-2 minutes for initial deployment**

### Step 6: Verify Deployment

1. Go to "Actions" tab in repository
2. Look for "Deploy to GitHub Pages" workflow
3. Click on the latest run
4. Confirm status is **✓ Successful**

**Your site is now live at:**
```
https://YOUR-USERNAME.github.io/portfolio/
```

### Step 7: View Your Portfolio

1. Open browser
2. Navigate to: `https://YOUR-USERNAME.github.io/portfolio/`
3. Test all functionality:
   - [ ] Hero section loads
   - [ ] Theme toggle works
   - [ ] Mobile menu works
   - [ ] Links function correctly
   - [ ] CV button works
   - [ ] Contact form validates

---

## GitHub Actions CI/CD Workflow

### How It Works

**Trigger**: Push to `main` branch

**Process**:
1. **Checkout**: Pulls your latest code
2. **Validate**: Checks HTML, CSS, JS structure
3. **Upload**: Prepares artifact for deployment
4. **Deploy**: Pushes to GitHub Pages
5. **Summary**: Reports deployment status

### Workflow File Location

```
.github/workflows/deploy.yml
```

### Monitoring Deployments

#### View Deployment Logs

1. Go to repository → "Actions" tab
2. Click on latest workflow run
3. Click on "Deploy to GitHub Pages" job
4. Expand steps to see details

#### Check Deployment Status

```bash
# Terminal command
git log --oneline | head -10

# Shows recent commits and their deployment status
```

### Troubleshooting Workflow Issues

| Issue | Solution |
|-------|----------|
| Workflow not running | Check branch is `main` and file is in `.github/workflows/` |
| HTML validation fails | Fix syntax errors in index.html |
| CSS validation fails | Check style.css for syntax errors |
| JS validation fails | Check script.js for syntax errors |
| Page not deploying | Check GitHub Pages settings point to GitHub Actions |

---

## Custom Domain Setup (Optional)

### Add Custom Domain

1. Go to Settings → Pages
2. Under "Custom domain"
3. Enter your domain (e.g., `nishchal-panta.com`)
4. Click "Save"

### DNS Configuration

**For domain registrar (GoDaddy, Namecheap, etc.):**

1. Go to DNS settings
2. Add **A records** pointing to GitHub's IP:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

3. Or add **CNAME record**:
   ```
   CNAME: portfolio
   Points to: YOUR-USERNAME.github.io
   ```

4. Wait 24 hours for DNS propagation

### Verify HTTPS

- GitHub automatically provisions HTTPS certificate
- Takes 5-10 minutes after domain setup
- Certificate auto-renews

---

## CV / Resume Management

### Default Setup

- File location: `/assets/files/Nishchal_Panta_CV.pdf`
- Button action: Opens in new tab
- Download: Direct download enabled

### Update CV

#### Method 1: Replace File

1. Prepare new PDF file
2. Name it: `Nishchal_Panta_CV.pdf`
3. Replace file in `/assets/files/`
4. Commit and push:
   ```bash
   git add assets/files/Nishchal_Panta_CV.pdf
   git commit -m "Update CV with latest experience"
   git push origin main
   ```

#### Method 2: Different Filename

1. Upload new PDF file with new name
2. Update HTML in index.html:
   ```html
   <!-- Change this: -->
   href="assets/files/Nishchal_Panta_CV.pdf"
   
   <!-- To this: -->
   href="assets/files/Nishchal_Panta_CV_2024.pdf"
   ```
3. Commit and push

### Organize CV Versions

```
assets/files/
├── Nishchal_Panta_CV.pdf          # Current (linked)
├── Nishchal_Panta_CV_Archive/
│   ├── Nishchal_Panta_CV_2024.pdf
│   └── Nishchal_Panta_CV_2023.pdf
```

---

## Content Updates & Maintenance

### Updating Portfolio Content

**No redeploy needed** - Just edit files and push!

#### Update Text Content

1. Edit `index.html`
2. Find section you want to update
3. Edit text directly
4. Save file
5. Commit and push:
   ```bash
   git add index.html
   git commit -m "Update about section with new experience"
   git push origin main
   ```

#### Update Styles

1. Edit `style.css`
2. Make design changes
3. Test locally (open index.html in browser)
4. Commit and push:
   ```bash
   git add style.css
   git commit -m "Refine hero section spacing"
   git push origin main
   ```

#### Update Functionality

1. Edit `script.js`
2. Add/modify features
3. Test in browser console
4. Commit and push:
   ```bash
   git add script.js
   git commit -m "Add lazy loading for images"
   git push origin main
   ```

### Common Updates

#### Add New Project

1. In index.html, find `<div class="projects-grid">`
2. Add new project card:
   ```html
   <div class="project-card">
       <div class="project-header">
           <div class="project-icon">
               <i class="fas fa-[icon]"></i>
           </div>
           <h3 class="project-title">Project Name</h3>
       </div>
       <p class="project-description">Description...</p>
       <!-- ... rest of project card -->
   </div>
   ```
3. Save, commit, push

#### Update Social Links

1. Find social links in `index.html`
2. Update href URLs:
   ```html
   <a href="https://github.com/YOUR-USERNAME" target="_blank">
   ```
3. Commit and push

#### Add New Section

1. Copy existing section structure
2. Modify IDs and classes
3. Add to navigation menu
4. Test responsiveness
5. Commit and push

---

## Local Testing

### Before Pushing

1. Open `index.html` in browser
2. Test all sections load
3. Test all buttons work
4. Test theme toggle
5. Test responsive design
6. Check console for errors

### Local Server (Optional)

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then visit: http://localhost:8000
```

---

## Troubleshooting

### Site Not Appearing

**Problem**: Can't access portfolio after deployment

**Solutions**:
1. Verify repository is public
2. Check GitHub Pages enabled in Settings
3. Wait 2-3 minutes for first deployment
4. Clear browser cache (Ctrl+Shift+Delete)
5. Check Actions tab for errors

### Wrong Content Showing

**Problem**: Old content still displaying

**Solutions**:
1. Hard refresh browser (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
2. Clear browser cache
3. Wait 5 minutes (CDN cache)
4. Verify files pushed correctly:
   ```bash
   git status
   git log --oneline | head -5
   ```

### Theme Not Working

**Problem**: Dark/Light mode toggle not functioning

**Solutions**:
1. Check JavaScript console for errors
2. Verify `script.js` loaded correctly
3. Check theme storage:
   ```javascript
   // In browser console
   localStorage.getItem('theme')
   ```
4. Ensure CSS variables defined in `:root`

### Links Not Working

**Problem**: Social/project links broken

**Solutions**:
1. Verify URLs in HTML are correct
2. Test each URL manually
3. Ensure `target="_blank"` where needed
4. Check for typos in URLs

### Forms Not Submitting

**Problem**: Contact form not working

**Solutions**:
1. Replace `YOUR_FORM_ID` in HTML with actual Formspree ID
2. Visit [formspree.io](https://formspree.io) to setup
3. Get form ID and update action URL
4. Test form submission
5. Check Formspree dashboard for submissions

---

## Performance Optimization

### Improving Load Time

#### Compress Images

```bash
# Using ImageOptim or similar tool
# Reduce image file sizes before uploading
```

#### Minify CSS/JS (Advanced)

Use online minifiers:
- CSS: [cssminifier.com](https://www.cssminifier.com)
- JS: [jsminifier.com](https://www.jsminifier.com)

#### Check Performance

1. Go to site: `https://YOUR-USERNAME.github.io/portfolio/`
2. Open DevTools (F12)
3. Go to "Performance" tab
4. Click record and scroll
5. Check Lighthouse score (90+)

---

## Security Checklist

- [ ] Repository is public (required for Pages)
- [ ] No sensitive data in files
- [ ] HTTPS enabled (automatic)
- [ ] Forms configured (Formspree)
- [ ] Social links are correct
- [ ] No hardcoded API keys
- [ ] Third-party scripts from trusted sources
- [ ] Contact form has validation

---

## Ongoing Maintenance

### Monthly

- [ ] Test all links
- [ ] Check GitHub Actions runs
- [ ] Review page performance
- [ ] Update CV if needed

### Quarterly

- [ ] Add new projects if completed
- [ ] Update skills section
- [ ] Refresh about section
- [ ] Check social links

### Annually

- [ ] Full content review
- [ ] Design audit
- [ ] Performance check
- [ ] Backup repository

---

## Getting Help

### Resources

- [GitHub Pages Docs](https://docs.github.com/pages)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [HTML Validation](https://validator.w3.org/)
- [CSS Validation](https://jigsaw.w3.org/css-validator/)

### Support

If issues persist:
1. Check Actions tab for error logs
2. Review GitHub Pages documentation
3. Clear cache and try again
4. Contact GitHub Support

---

## Next Steps

1. ✓ Deploy portfolio
2. ✓ Test all functionality
3. Share portfolio link in:
   - [ ] LinkedIn profile
   - [ ] GitHub bio
   - [ ] Resume/CV
   - [ ] Email signature
   - [ ] Social media
4. Monitor deployments
5. Update content regularly
6. Gather feedback
7. Iterate and improve
