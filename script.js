/**
 * Nishchal Panta Portfolio - Main JavaScript
 * Handles interactivity, animations, and dynamic features
 */

// ============================================
// DOM Elements
// ============================================

const themeToggle = document.getElementById('themeToggle');
const menuToggle = document.getElementById('menuToggle');
const navbar = document.getElementById('navbar');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');
const cursor = document.getElementById('cursor');
const typingText = document.querySelector('.typing-text');

// ============================================
// Theme Management
// ============================================

class ThemeManager {
    constructor() {
        this.theme = this.loadTheme();
        this.init();
    }

    loadTheme() {
        // Check localStorage first
        const saved = localStorage.getItem('theme');
        if (saved) return saved;

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    init() {
        this.applyTheme(this.theme);
        themeToggle.addEventListener('click', () => this.toggle());
    }

    applyTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateToggleIcon();
    }

    toggle() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
    }

    updateToggleIcon() {
        const icon = themeToggle.querySelector('i');
        if (this.theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

// ============================================
// Mobile Menu Management
// ============================================

class MobileMenu {
    constructor() {
        this.init();
    }

    init() {
        menuToggle.addEventListener('click', () => this.toggle());
        navLinks.forEach(link => {
            link.addEventListener('click', () => this.close());
        });
    }

    toggle() {
        navMenu.classList.toggle('active');
    }

    close() {
        navMenu.classList.remove('active');
    }
}

// ============================================
// Typing Animation
// ============================================

class TypingAnimation {
    constructor() {
        this.roles = [
            'Software Engineering Student',
            'AWS Cloud Learner',
            'Backend Developer',
            'Full-Stack Developer',
            'ML Enthusiast'
        ];
        this.currentIndex = 0;
        this.isDeleting = false;
        this.speed = 100;
        this.deleteSpeed = 50;
        this.pauseTime = 1500;
        this.init();
    }

    init() {
        if (typingText && cursor) {
            this.type();
        }
    }

    type() {
        const current = this.roles[this.currentIndex];
        const fullText = typingText.textContent;

        if (this.isDeleting) {
            typingText.textContent = fullText.substring(0, fullText.length - 1);

            if (fullText.length === 0) {
                this.isDeleting = false;
                this.currentIndex = (this.currentIndex + 1) % this.roles.length;
                setTimeout(() => this.type(), 500);
                return;
            }

            setTimeout(() => this.type(), this.deleteSpeed);
        } else {
            if (fullText.length < current.length) {
                typingText.textContent = current.substring(0, fullText.length + 1);
                setTimeout(() => this.type(), this.speed);
            } else {
                setTimeout(() => {
                    this.isDeleting = true;
                    this.type();
                }, this.pauseTime);
            }
        }
    }
}

// ============================================
// Scroll Reveal Effect
// ============================================

class ScrollReveal {
    constructor() {
        this.init();
    }

    init() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all revealable elements
        const revealElements = document.querySelectorAll(
            '.feature-card, .project-card, .cert-card, .skill-category, .timeline-item'
        );

        revealElements.forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });

        // Staggered animations for multiple items
        this.setupStaggeredAnimations();
        this.setupSkillBarAnimations();
    }

    animateElement(element) {
        element.classList.add('active');
        
        // Apply different animations based on element type
        if (element.classList.contains('project-card')) {
            element.style.animation = 'liftIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        } else if (element.classList.contains('cert-card')) {
            element.style.animation = 'liftIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        } else if (element.classList.contains('timeline-item')) {
            element.style.animation = 'slideInLeft 0.6s ease-out forwards';
        } else if (element.classList.contains('feature-card')) {
            element.style.animation = 'fadeUp 0.5s ease-out forwards';
        } else if (element.classList.contains('skill-category')) {
            // When skill category is animated, make child stagger items visible
            const staggerItems = element.querySelectorAll('.stagger-item');
            staggerItems.forEach((item, index) => {
                setTimeout(() => {
                    item.classList.add('visible');
                }, index * 100);
            });
        }
    }

    setupStaggeredAnimations() {
        // Stagger animations for skill tags within categories
        const skillCategories = document.querySelectorAll('.skill-category');
        
        skillCategories.forEach(category => {
            const tags = category.querySelectorAll('.skill-tag');
            tags.forEach((tag, index) => {
                tag.classList.add('stagger-item');
            });
        });
    }

    setupSkillBarAnimations() {
        const observerOptions = {
            threshold: 0.7,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const bars = entry.target.querySelectorAll('.skill-bar');
                    bars.forEach((bar, index) => {
                        setTimeout(() => {
                            const fillDiv = bar.querySelector('div');
                            if (fillDiv) {
                                fillDiv.style.animation = 'skillFill 1s ease-out forwards';
                            }
                        }, index * 100);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        const skillsSections = document.querySelectorAll('.skills-grid');
        skillsSections.forEach(section => {
            observer.observe(section);
        });
    }
}

// ============================================
// Navbar Management
// ============================================

class NavbarManager {
    constructor() {
        this.lastScrollTop = 0;
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll());
        this.setupSmoothScroll();
    }

    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Add shadow on scroll
        if (scrollTop > 10) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
        }

        this.lastScrollTop = scrollTop;
    }

    setupSmoothScroll() {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const target = document.querySelector(targetId);

                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

// ============================================
// Contact Form Handler
// ============================================

const CONTACT_API_URL = "https://ue0l82ocg4.execute-api.us-east-1.amazonaws.com/";

class ContactForm {
    constructor() {
        this.API_URL = CONTACT_API_URL;
        this.init();
    }

    init() {
        const form = document.getElementById("contact-form");
        if (form) {
            form.addEventListener("submit", (e) => this.handleSubmit(e));
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const form = document.getElementById("contact-form");
        const statusEl = document.getElementById("contact-status");
        statusEl.textContent = "Sending...";
        statusEl.className = "contact-status sending";

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();

        try {
            const res = await fetch(this.API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || "Failed to send");

            statusEl.textContent = "Sent successfully!";
            statusEl.className = "contact-status success";
            form.reset();
            
            setTimeout(() => {
                statusEl.textContent = "";
                statusEl.className = "contact-status";
            }, 5000);
        } catch (err) {
            console.error('Contact form error:', err);
            let errorMsg = err.message;

            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
                errorMsg = 'Connection error - please check the Amazon SES API Gateway configuration in script.js';
            }
            
            statusEl.textContent = `Error: ${errorMsg}`;
            statusEl.className = "contact-status error";
        }
    }
}

// ============================================
// Smooth Scroll Behavior
// ============================================

function addScrollBehavior() {
    // Add CSS for animations if not already present
    if (!document.querySelector('style[data-scroll-behavior]')) {
        const style = document.createElement('style');
        style.setAttribute('data-scroll-behavior', 'true');
        style.textContent = `
            @keyframes slideInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideOutUp {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-20px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// Parallax Effect (Optional)
// ============================================

class ParallaxEffect {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll());
        // Use requestAnimationFrame for smooth parallax
        window.addEventListener('scroll', () => this.requestParallaxUpdate());
    }

    handleScroll() {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            const scrollPosition = window.pageYOffset;
            // Soft parallax effect - slower movement
            heroContent.style.transform = `translateY(${scrollPosition * 0.3}px)`;
        }
    }

    requestParallaxUpdate() {
        requestAnimationFrame(() => {
            const parallaxElements = document.querySelectorAll('[data-parallax]');
            const scrollY = window.pageYOffset;

            parallaxElements.forEach(element => {
                const speed = element.getAttribute('data-parallax') || '0.5';
                const offset = scrollY * speed;
                element.style.transform = `translateY(${offset}px)`;
            });
        });
    }
}

// ============================================
// Performance Optimization
// ============================================

class PerformanceOptimizer {
    constructor() {
        this.init();
    }

    init() {
        // Lazy load images
        if ('IntersectionObserver' in window) {
            this.setupLazyLoading();
        }

        // Prefetch resources
        this.setupPrefetch();
    }

    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    setupPrefetch() {
        // Prefetch critical resources
        const prefetchLinks = [
            { rel: 'prefetch', href: 'assets/files/Nishchal_Panta_CV.pdf' }
        ];

        prefetchLinks.forEach(link => {
            const el = document.createElement('link');
            el.rel = link.rel;
            el.href = link.href;
            document.head.appendChild(el);
        });
    }
}

// ============================================
// Active Navigation Link
// ============================================

class ActiveNavigation {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.updateActiveLink());
        this.updateActiveLink();
    }

    updateActiveLink() {
        const sections = document.querySelectorAll('section');
        const scrollPosition = window.pageYOffset + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Nishchal Panta Portfolio');

    // Initialize all managers
    new ThemeManager();
    new MobileMenu();
    new TypingAnimation();
    new ScrollReveal();
    new NavbarManager();
    new ContactForm();
    new ActiveNavigation();
    new PerformanceOptimizer();
    new ParallaxEffect();

    // Add scroll behavior styles
    addScrollBehavior();

    console.log('✓ Portfolio fully initialized');

    // Log portfolio info
    console.log('Portfolio Version: 1.0.0');
    console.log('Built with: HTML5, CSS3, JavaScript (Vanilla)');
    console.log('GitHub: https://github.com/Nishchal-Panta');
});

// ============================================
// Keyboard Navigation
// ============================================

document.addEventListener('keydown', (e) => {
    // ESC key closes mobile menu
    if (e.key === 'Escape') {
        const mobileMenu = document.getElementById('navMenu');
        if (mobileMenu) {
            mobileMenu.classList.remove('active');
        }
    }
});

// ============================================
// Analytics & Tracking (Optional)
// ============================================

function trackEvent(eventName, eventData = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventData);
    }
}

// Track page view
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        trackEvent('page_view', {
            page_title: document.title,
            page_location: window.location.href
        });
    });
}

// Track external links
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="http"]');
    if (link && !link.href.includes(window.location.hostname)) {
        trackEvent('external_link_click', {
            link_url: link.href,
            link_text: link.textContent
        });
    }
});
