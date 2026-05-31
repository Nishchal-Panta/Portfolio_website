# Nishchal Panta - Premium Portfolio Website

![Portfolio Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![HTML5](https://img.shields.io/badge/HTML5-E34C26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![AWS](https://img.shields.io/badge/AWS-S3%20%2B%20CloudFront-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

> A modern, premium, recruiter-focused static portfolio website showcasing technical expertise, projects, certifications, and professional growth. Built with vanilla HTML, CSS, and JavaScript. Deployed via AWS S3 + CloudFront with automated CI/CD.

## 🌐 Live Portfolio

**[View Live Portfolio](https://nishchalpanta.com.np/)**
*(Replace with your live custom domain if it changes)*

```
https://nishchalpanta.com.np/
```

---

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Customization](#customization)
- [Documentation](#documentation)
- [Technology Stack](#technology-stack)
- [Performance](#performance)
- [Browser Support](#browser-support)
- [CV Management](#cv-management)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## ✨ Features

### Core Features

- ✅ **Responsive Design** - Mobile-first, fully responsive layout
- ✅ **Dark/Light Mode** - Theme toggle with system preference detection
- ✅ **Smooth Animations** - Scroll reveals, typing effects, transitions
- ✅ **Modern UI** - Premium, recruiter-grade appearance
- ✅ **Fast Performance** - Vanilla JS, minimal CSS, optimized loading
- ✅ **SEO Optimized** - Meta tags, semantic HTML, accessibility features
- ✅ **Automatic Deployment** - GitHub Actions CI/CD on every push to S3 + CloudFront
- ✅ **No Backend Required** - Static website, AWS-hosted and CDN-ready

### Website Sections

1. **Hero Section** - Dynamic roles, CTAs, social links, scroll indicator
2. **About Section** - Professional story, career mission, feature cards
3. **Skills Section** - Categorized technical skills with interactive tags
4. **Projects Section** - Featured portfolio projects plus a dedicated AWS cloud projects gallery
5. **Certifications Section** - AWS certifications and achievements
6. **Education Section** - BCS program details and coursework
7. **Journey Timeline** - Career growth visualization with milestones
8. **CV/Resume Section** - PDF viewer, download, replacement instructions
9. **Contact Section** - Contact form, contact info, social links
10. **Navigation** - Sticky navbar with smooth scroll, mobile menu
11. **Footer** - Brand info, links, social media

---

## 🚀 Quick Start

### Prerequisites

- GitHub account
- Git installed
- Text editor (VS Code recommended)

### Deploy in 5 Minutes

```bash
# 1. Clone repository
git clone https://github.com/YOUR-USERNAME/portfolio.git
cd portfolio

# 2. Customize (update index.html, add CV)
# - Replace placeholder text
# - Add CV PDF to assets/files/

# 3. Commit and push
git add .
git commit -m "Initial portfolio deployment"
git push origin main

# 4. Deploy to AWS
# GitHub Actions syncs the site to S3 and invalidates CloudFront

# 5. Your portfolio is live!
# https://nishchalpanta.com.np/
```

**See [Deployment Guide](./docs/deployment-guide.md) for detailed instructions.**

---

## 📦 Installation

### Step 1: Create Repository

1. Go to [GitHub.com](https://github.com/new)
2. Create new repository named `portfolio`
3. Choose **Public** visibility (required for public access)
4. Click "Create repository"

### Step 2: Set Up Locally

```bash
# Clone repository
git clone https://github.com/YOUR-USERNAME/portfolio.git
cd portfolio

# Add portfolio files (copy from template)
cp -r ~/downloads/portfolio-template/* .

# Verify structure
ls -la
```

### Step 3: Customize Content

#### Update Personal Information

Edit `index.html`:

```html
<!-- Update name -->
<h1 class="hero-title">Your Name</h1>

<!-- Update roles in typing animation -->
<span class="typing-text">Your Role</span>

<!-- Update contact email -->
<a href="mailto:your-email@example.com">your-email@example.com</a>

<!-- Update social links -->
<a href="https://github.com/YOUR-USERNAME" target="_blank">
    <i class="fab fa-github"></i>
</a>
```

#### Add CV File

1. Create CV PDF
2. Place in `/assets/files/`
3. Name it: `Nishchal_Panta_CV.pdf`
4. Button automatically links to it

#### Update Colors (Optional)

Edit `style.css` `:root` variables:

```css
:root {
    --color-primary: #0f172a;        /* Main color */
    --color-accent: #3b82f6;         /* Accent color */
    --color-success: #10b981;        /* Success color */
    /* ... more variables */
}
```

### Step 4: Test Locally

```bash
# Open in browser
# Double-click index.html
# Or use local server:

python -m http.server 8000
# Visit: http://localhost:8000
```

---

## 🌍 Deployment

### AWS Deployment Setup

#### Automatic (Recommended)

1. Push code to `main` branch
2. GitHub Actions workflow runs automatically
3. Site deploys to S3 and CloudFront
4. ✅ Portfolio is live in 2-3 minutes

#### View Deployment Status

```
Repository → Actions tab → Deploy to AWS workflow
```

### Verify Deployment

1. Check the GitHub Actions run completed successfully
2. Confirm CloudFront invalidation completed
3. Visit URL:
   ```
    https://nishchalpanta.com.np/
   ```

### Custom Domain

See [Deployment Guide](./docs/deployment-guide.md#custom-domain-setup) for setup instructions.

---

## 📁 Project Structure

```
portfolio/
│
├── index.html                    # Main website (all sections)
├── aws-projects.html             # AWS project showcase page
├── style.css                     # Complete styling & animations
├── script.js                     # Interactive features
├── README.md                     # This file
│
├── assets/
│   ├── images/                  # Profile images, screenshots
│   └── files/
│       └── Nishchal_Panta_CV.pdf # Your CV (update as needed)
│
├── docs/                         # Documentation
│   ├── context.md               # Project overview
│   ├── requirements.md          # Feature requirements
│   ├── design-system.md         # Design guidelines
│   ├── content-strategy.md      # Content approach
│   ├── project-analysis.md      # GitHub/social analysis
│   └── deployment-guide.md      # Detailed setup guide
│
└── .github/
    └── workflows/
        └── deploy.yml           # GitHub Actions CI/CD
```

### File Sizes

| File | Size | Purpose |
|------|------|---------|
| index.html | ~50KB | Complete HTML structure |
| style.css | ~30KB | Styling & animations |
| script.js | ~15KB | Interactive features |
| **Total** | **~95KB** | Lightweight & fast |

---

## ⚙️ Customization

### Update About Section

```html
<!-- Find this in index.html -->
<section class="about" id="about">
    <p>Professional biography...</p>
</section>

<!-- Edit text directly and push -->
```

### Add New Project

```html
<!-- In projects-grid section -->
<div class="project-card">
    <div class="project-header">
        <div class="project-icon">
            <i class="fas fa-icon"></i>
        </div>
        <h3 class="project-title">Your Project</h3>
    </div>
    <p class="project-description">Description...</p>
    <!-- ... -->
</div>
```

### Update Skills

```html
<!-- In skills-grid section -->
<div class="skill-category">
    <h3 class="category-title">
        <i class="fas fa-icon"></i> Category
    </h3>
    <div class="skill-tags">
        <span class="skill-tag">Skill 1</span>
        <span class="skill-tag">Skill 2</span>
    </div>
</div>
```

### Change Theme Colors

Edit `style.css`:

```css
:root {
    /* Light Mode */
    --color-primary: #your-color;
    --color-accent: #your-accent;
    
    /* Dark Mode */
}

[data-theme="dark"] {
    --color-primary: #your-dark-color;
    --color-accent: #your-dark-accent;
}
```

---

## 📚 Documentation

### Complete Documentation

1. **[Deployment Guide](./docs/deployment-guide.md)** ⭐ **START HERE**
   - Step-by-step setup
    - AWS S3 and CloudFront configuration
   - CI/CD workflow
   - Troubleshooting

2. **[Design System](./docs/design-system.md)**
   - Color palette
   - Typography
   - Components
   - Responsive breakpoints

3. **[Content Strategy](./docs/content-strategy.md)**
   - Content pillars
   - Messaging for audiences
   - Social media integration
   - SEO strategy

4. **[Requirements](./docs/requirements.md)**
   - Feature list
   - Technical specs
   - Success criteria

5. **[Project Analysis](./docs/project-analysis.md)**
   - GitHub profile review
   - Social media integration
   - Project categorization

6. **[Context](./docs/context.md)**
   - Project overview
   - Technology stack
   - Development timeline

---

## 💻 Technology Stack

### Frontend

- **HTML5** - Semantic structure, accessibility
- **CSS3** - Modern styling, animations, variables
- **JavaScript** - Vanilla (no frameworks), interactive features

### Hosting & Deployment

- **AWS S3** - Static site origin hosting
- **CloudFront** - CDN and custom domain delivery
- **GitHub Actions** - CI/CD automation
- **GitHub Workflows** - Build validation

### Tools & Services

- **Font Awesome** - Icons
- **Google Fonts** - Typography (Poppins, JetBrains Mono)
- **Amazon SES contact API** - Configured in `script.js`

### No External Dependencies!

- ✅ No jQuery
- ✅ No React, Vue, Angular
- ✅ No build process required
- ✅ No package.json dependencies
- ✅ Works in any browser with HTML5 support

---

## ⚡ Performance

### Optimization Features

- **Minimal CSS**: Only necessary styles (~30KB)
- **Vanilla JavaScript**: No framework overhead (~15KB)
- **Single HTML File**: All sections in one page
- **Lazy Loading Ready**: Image support for deferred loading
- **Smooth 60 FPS**: Hardware-accelerated animations

### Performance Metrics (Target)

| Metric | Target | Status |
|--------|--------|--------|
| First Contentful Paint | < 1.5s | ✅ |
| Largest Contentful Paint | < 2.5s | ✅ |
| Cumulative Layout Shift | < 0.1 | ✅ |
| Lighthouse Score | 90+ | ✅ |

### Check Your Performance

```
Visit: https://nishchalpanta.com.np/
Press: F12 → Lighthouse tab
Click: Analyze page load
```

---

## 🌐 Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ Latest | ✅ Latest |
| Firefox | ✅ Latest | ✅ Latest |
| Safari | ✅ Latest | ✅ Latest |
| Edge | ✅ Latest | ✅ Latest |
| IE 11 | ⚠️ Limited | ❌ No |

### Tested Environments

- ✅ Windows (Chrome, Firefox, Edge)
- ✅ macOS (Safari, Chrome, Firefox)
- ✅ iOS (Safari, Chrome)
- ✅ Android (Chrome, Firefox)

---

## 📄 CV Management

### Default Setup

- **Location**: `/assets/files/Nishchal_Panta_CV.pdf`
- **Access**: View/Download buttons in CV section
- **Automatic**: Links work immediately

### Update CV

#### Method 1: Replace File

```bash
# 1. Prepare new CV PDF
# 2. Save as: Nishchal_Panta_CV.pdf
# 3. Move to: assets/files/

cp ~/Documents/Nishchal_Panta_CV.pdf assets/files/

# 4. Commit and push
git add assets/files/
git commit -m "Update CV with new experience"
git push origin main
```

#### Method 2: Different Filename

Update HTML to link to new file:

```html
<!-- Before -->
href="assets/files/Nishchal_Panta_CV.pdf"

<!-- After -->
href="assets/files/Nishchal_Panta_CV_2024.pdf"
```

Then commit and push.

### CV Replacement Instructions

For others updating your portfolio:

1. Replace PDF file in `/assets/files/`
2. Keep filename consistent OR
3. Update link in `index.html` CV section
4. Commit with message: "Update CV"
5. Push to main branch
6. Wait 2-3 minutes for deployment

---

## 🐛 Troubleshooting

### Site Not Deploying

**Problem**: CloudFront or custom domain shows 404 error

**Solutions**:
1. Verify repository is **public**
2. Check Settings → Pages → Source is **GitHub Actions**
3. Check Actions tab for workflow errors
4. Wait 3-5 minutes for initial deployment
5. Clear browser cache (Ctrl+Shift+Delete)

### Content Not Updating

**Problem**: Changes aren't visible on live site

**Solutions**:
1. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache entirely
3. Wait 5-10 minutes (CDN propagation)
4. Verify file was pushed: `git log --oneline`

### Theme Toggle Not Working

**Problem**: Dark/Light mode button doesn't work

**Solutions**:
1. Check browser console (F12 → Console)
2. Verify JavaScript loaded (check Network tab)
3. Check localStorage: `localStorage.getItem('theme')`
4. Refresh page
5. Try incognito mode (rules out cache)

### Links Not Working

**Problem**: Social/project links give 404

**Solutions**:
1. Verify URL is correct in HTML
2. Test URL manually in new tab
3. Check for typos
4. Ensure `target="_blank"` attribute exists
5. For GitHub links, verify username

### Performance Issues

**Problem**: Site loads slowly

**Solutions**:
1. Check Lighthouse report (F12 → Lighthouse)
2. Reduce image sizes in assets/
3. Check for render-blocking resources
4. Disable extensions and reload
5. Test on different connection speed

### Mobile Layout Broken

**Problem**: Site looks wrong on phone

**Solutions**:
1. Check viewport meta tag in HTML
2. Test different device sizes: F12 → Toggle device toolbar
3. Check responsive CSS media queries
4. Verify touch-friendly button sizes (44px+)
5. Test on actual device

---

## 📞 Support & Help

### Documentation

- 📖 [Deployment Guide](./docs/deployment-guide.md)
- 🎨 [Design System](./docs/design-system.md)
- 📝 [Content Strategy](./docs/content-strategy.md)
- 📋 [Requirements](./docs/requirements.md)

### External Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [HTML5 Validation](https://validator.w3.org/)
- [CSS Validation](https://jigsaw.w3.org/css-validator/)
- [Lighthouse DevTools](https://developers.google.com/web/tools/lighthouse)

### Common Questions

**Q: Can I use a different domain?**  
A: Yes! See [Custom Domain Guide](./docs/deployment-guide.md#custom-domain-setup)

**Q: How do I add more projects?**  
A: Edit `index.html` projects section and add new cards

**Q: Can I change the colors?**  
A: Yes! Modify CSS variables in `style.css`

**Q: Is my data secure?**  
A: Yes! Static site, no backend, hosted on GitHub

**Q: Can I add a blog?**  
A: Future enhancement possible with markdown

---

## 🎓 Learning & Customization

### Getting Started with Customization

1. **Read Files**: Start with this README
2. **Study HTML**: Understand page structure in `index.html`
3. **Review CSS**: Check styling in `style.css`
4. **Test JS**: Review interactivity in `script.js`
5. **Make Changes**: Edit and test locally
6. **Deploy**: Push to GitHub and verify

### Code Comments

All files include helpful comments:

```html
<!-- Section Start -->
<section class="hero" id="hero">
    <!-- Content -->
</section>
<!-- Section End -->
```

```css
/* ============================================
   TYPOGRAPHY
   ============================================ */
```

```javascript
// ============================================
// Theme Management
// ============================================
```

---

## 📊 Version History

### Version 1.0.0 (Current)

- ✅ Complete portfolio website
- ✅ Responsive design
- ✅ Dark/Light mode
- ✅ GitHub Actions CI/CD
- ✅ Comprehensive documentation
- ✅ Optimized performance
- ✅ Accessibility features

### Future Enhancements

- 🚀 Blog section
- 🎥 Video testimonials
- 📊 Project showcase with demos
- 🔍 Advanced search
- 📈 Analytics integration
- 🎨 Additional theme options
- 🌍 Multi-language support

---

## 📄 License

This portfolio template is licensed under the **MIT License**.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

See [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Font Awesome** - Beautiful icons
- **Google Fonts** - Quality typography
- **GitHub** - Hosting & CI/CD platform
- **Open Source Community** - Inspiration & best practices

---

## 📧 Contact

**For questions or feedback about this portfolio:**

- Email: nishchalpanta426@gmail.com
- GitHub: https://github.com/Nishchal-Panta
- LinkedIn: https://linkedin.com/in/nishchal-panta-3890b1292

---

## 🚀 Quick Links

| Resource | Link |
|----------|------|
| **Live Portfolio** | `https://nishchalpanta.com.np/` |
| **GitHub Profile** | https://github.com/Nishchal-Panta |
| **LinkedIn** | https://linkedin.com/in/nishchal-panta-3890b1292 |
| **Deployment Guide** | [./docs/deployment-guide.md](./docs/deployment-guide.md) |
| **Design System** | [./docs/design-system.md](./docs/design-system.md) |

---

<div align="center">

**Built with ❤️ using vanilla HTML, CSS, and JavaScript**

*Last Updated: May 2026*

[⬆ Back to Top](#nishchal-panta---premium-portfolio-website)

</div>
