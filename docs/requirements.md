# Project Requirements

## Overview

Build a premium, recruiter-focused static portfolio website for Nishchal Panta that showcases technical expertise, projects, certifications, and professional growth. Deploy via GitHub Pages with automated CI/CD.

## Functional Requirements

### 1. Website Structure & Sections

#### 1.1 Hero Section
- ✓ Display name: **Nishchal Panta**
- ✓ Dynamic typing roles (4+ roles)
  - Software Engineering Student
  - AWS Cloud Learner
  - Backend Developer
  - Full-Stack Developer
- ✓ Professional subtitle
- ✓ Call-to-action buttons:
  - View Projects
  - View CV
  - Contact Me
- ✓ Social media links (GitHub, LinkedIn, Facebook, Instagram)
- ✓ Animated background gradient
- ✓ Scroll indicator

#### 1.2 About Section
- ✓ Professional biography
- ✓ Career mission statement
- ✓ Academic path
- ✓ Statistics cards (projects, certifications, skills)
- ✓ Feature cards highlighting specializations:
  - Machine Learning
  - Cloud Architecture
  - Full-Stack Development
  - Security Focus

#### 1.3 Skills Section
- ✓ Skills organized by category:
  - Programming Languages (Python, PHP, JavaScript, Java, SQL)
  - Frameworks & Libraries (Laravel, PyTorch, Scikit-learn, Pandas, etc.)
  - Cloud & DevOps (AWS, Docker, Git, CI/CD)
  - Databases & Tools (MySQL, JupyterLab, REST APIs)
  - Machine Learning (Neural Networks, Feature Engineering, Evaluation)
  - Soft Skills (Problem Solving, Communication, Leadership)
- ✓ Interactive skill tags
- ✓ Category icons

#### 1.4 Projects Section
- ✓ Featured projects display:
  - Neural Network Cybersecurity Threat Detection
  - Laravel E-Commerce Platform
  - Share Market Analysis
  - VeggieScan (AI Disease Detection)
  - Panta Store (Android App)
  - Relay Hack Hackathon Project
- ✓ Project cards with:
  - Icon/category
  - Title
  - Description
  - Highlights
  - Technology stack (badges)
  - GitHub link
- ✓ GitHub profile link
- ✓ Hover animations

#### 1.5 Certifications Section
- ✓ Certification cards:
  - AWS Cloud Practitioner
  - AWS Academy Cloud Architecting Badge
  - Aqore X Relayhack Certificate
  - Leadership & Communication
  - TEDx Participation
  - CloudMandap DAAI Fellowship
- ✓ Issuer information
- ✓ Date/badge status
- ✓ Special highlighting for major certifications

#### 1.6 Education Section
- ✓ Bachelor of Computer Science (BCS)
- ✓ Institution: IIMS College & Taylor's University
- ✓ Duration: 2023 - Present
- ✓ Relevant coursework display
- ✓ Academic focus areas

#### 1.7 Journey Timeline
- ✓ Visual timeline with events:
  - BCS Program Started (2023)
  - Deep Learning & Cybersecurity (2024)
  - AWS Certifications (2024)
  - Full-Stack E-Commerce (2025)
  - AWS Cloud Fellow (Feb-May 2026)
  - Continuous Growth
- ✓ Timeline markers
- ✓ Connecting line
- ✓ Alternating left/right layout
- ✓ Responsive to mobile

#### 1.8 CV / Resume Section
- ✓ PDF preview card
- ✓ "View CV" button (opens in new tab)
- ✓ "Download CV" button
- ✓ Quick highlights section
- ✓ Core competencies list
- ✓ Professional attributes
- ✓ Instructions for CV replacement
- ✓ Default file path: `/assets/files/Nishchal_Panta_CV.pdf`
- ✓ Graceful fallback if PDF missing

#### 1.9 Contact Section
- ✓ Contact information display:
  - Email: nishchalpanta426@gmail.com
  - Location: Kathmandu, Nepal
  - Available for calls/messages
- ✓ Contact form with fields:
  - Name
  - Email
  - Subject
  - Message
- ✓ Form validation
- ✓ Success/error messages
- ✓ Formspree integration (placeholder)
- ✓ Social media links
- ✓ Email link

#### 1.10 Navigation
- ✓ Sticky navbar
- ✓ Logo/brand
- ✓ Menu links (Home, About, Skills, Projects, Certifications, Journey, Resume, Contact)
- ✓ Theme toggle (dark/light mode)
- ✓ Mobile menu toggle
- ✓ Smooth scroll to sections
- ✓ Active link indicator

#### 1.11 Footer
- ✓ Brand information
- ✓ Quick links
- ✓ Social links
- ✓ Copyright notice
- ✓ Technology stack mention

### 2. Design Requirements

#### 2.1 Visual Design
- ✓ Modern, premium appearance
- ✓ Recruiter-grade quality
- ✓ Dark/Light mode toggle
- ✓ Smooth animations throughout
- ✓ Scroll reveal effects
- ✓ Typing animation
- ✓ Hover states on interactive elements
- ✓ Gradient accents
- ✓ Professional color palette

#### 2.2 Responsive Design
- ✓ Mobile-first approach
- ✓ Tablet support
- ✓ Desktop optimization
- ✓ Touch-friendly buttons and links
- ✓ Flexible grid layouts
- ✓ Readable on all screen sizes

#### 2.3 Accessibility
- ✓ Semantic HTML5
- ✓ ARIA labels
- ✓ Keyboard navigation
- ✓ Color contrast compliance
- ✓ Focus indicators
- ✓ Alt text for images
- ✓ Reduced motion support

#### 2.4 Performance
- ✓ Fast page load (< 2.5s)
- ✓ Optimized CSS & JavaScript
- ✓ No external frameworks required
- ✓ Minimal dependencies
- ✓ Lazy loading ready
- ✓ SEO optimized

### 3. Technical Requirements

#### 3.1 Technology Stack
- ✓ HTML5 (semantic markup)
- ✓ CSS3 (modern features, variables, gradients)
- ✓ JavaScript (vanilla, no jQuery/frameworks)
- ✓ No backend required
- ✓ Static files only

#### 3.2 Browser Support
- ✓ Chrome/Chromium (latest)
- ✓ Firefox (latest)
- ✓ Safari (latest)
- ✓ Edge (latest)
- ✓ Mobile browsers

#### 3.3 SEO Requirements
- ✓ Meta tags (title, description, keywords)
- ✓ Semantic HTML structure
- ✓ Proper heading hierarchy
- ✓ Open Graph tags
- ✓ Canonical URL
- ✓ Mobile-friendly design

### 4. Deployment Requirements

#### 4.1 GitHub Pages Setup
- ✓ Repository: `nishchal-panta/portfolio` (recommended)
- ✓ Branch: `main` (default source)
- ✓ Custom domain support ready
- ✓ HTTPS enabled (automatic)

#### 4.2 CI/CD Pipeline
- ✓ GitHub Actions workflow (`.github/workflows/deploy.yml`)
- ✓ Triggers: Push to main, Pull requests (test)
- ✓ Build validation:
  - HTML structure check
  - CSS verification
  - JavaScript validation
  - File structure validation
- ✓ Automatic deployment on push
- ✓ Deployment summary/logs

#### 4.3 Workflow Features
- ✓ Checkout repository
- ✓ Setup GitHub Pages
- ✓ Validate files
- ✓ Upload artifact
- ✓ Deploy to Pages
- ✓ Summary output

### 5. Content Requirements

#### 5.1 CV/Resume
- ✓ Default path: `/assets/files/Nishchal_Panta_CV.pdf`
- ✓ Manual upload/replacement process
- ✓ Fallback message if missing
- ✓ Update instructions in README

#### 5.2 Social Media Integration
- ✓ GitHub links to repositories
- ✓ LinkedIn profile link
- ✓ Facebook profile link
- ✓ Instagram profile link
- ✓ Links open in new tabs

#### 5.3 Project Descriptions
- ✓ All 6 projects featured
- ✓ Technology stack listed
- ✓ Key achievements highlighted
- ✓ GitHub links functional

### 6. Documentation Requirements

#### 6.1 Documentation Files
- ✓ `README.md` - Main project documentation
- ✓ `docs/context.md` - Project overview
- ✓ `docs/requirements.md` - This file
- ✓ `docs/design-system.md` - Design guidelines
- ✓ `docs/content-strategy.md` - Content approach
- ✓ `docs/project-analysis.md` - GitHub/social analysis
- ✓ `docs/deployment-guide.md` - Setup instructions

#### 6.2 README Contents
- ✓ Project description
- ✓ Features overview
- ✓ Quick start guide
- ✓ Installation steps
- ✓ GitHub Pages setup
- ✓ CV replacement instructions
- ✓ Customization guide
- ✓ Deployment troubleshooting
- ✓ Development notes

## Non-Functional Requirements

### 1. Quality
- Professional code organization
- Clear variable and function names
- Proper comments where needed
- Consistent code style

### 2. Maintainability
- Easy to update content
- Clear file structure
- Well-documented code
- Easy CV replacement

### 3. Performance
- Optimized file sizes
- Fast load times
- Smooth animations (60 FPS)
- Minimal layout shifts

### 4. Security
- No vulnerability exploits
- Secure form handling
- XSS protection ready
- CSRF token support for forms

## Success Criteria

✓ All sections implemented and functional  
✓ Responsive design on mobile, tablet, desktop  
✓ Dark/Light mode toggle working  
✓ Animations smooth and performant  
✓ GitHub Actions workflow operational  
✓ Deployed successfully to GitHub Pages  
✓ All links functional and correct  
✓ SEO optimized  
✓ Accessible to screen readers  
✓ Documentation complete  

## Constraints

- **Static only**: No backend/database
- **No frameworks**: Vanilla HTML/CSS/JS only
- **GitHub Pages**: Deployment platform
- **Public URLs**: All links must be public
- **File size**: Keep under 200KB total
