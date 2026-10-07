/**
 * Nishchal Panta - Portfolio Interactivity Engine
 * High-performance, dependency-free vanilla JavaScript.
 * Implements Motion Primitives (Spotlight & Filter Tabs) and Animata micro-interactions.
 */

'use strict';

// ==========================================================================
// Theme Management
// ==========================================================================
class ThemeController {
    constructor() {
        this.toggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');
        this.html = document.documentElement;
        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            this.setTheme('light');
        } else {
            this.setTheme('dark');
        }

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Listen for OS system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    setTheme(theme) {
        this.html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateIcon(theme);
    }

    toggleTheme() {
        const currentTheme = this.html.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    updateIcon(theme) {
        if (!this.themeIcon) return;
        if (theme === 'dark') {
            this.themeIcon.className = 'fas fa-sun';
            this.toggleBtn.setAttribute('title', 'Switch to light mode');
            this.toggleBtn.setAttribute('aria-label', 'Switch to light mode');
        } else {
            this.themeIcon.className = 'fas fa-moon';
            this.toggleBtn.setAttribute('title', 'Switch to dark mode');
            this.toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
        }
    }
}

// ==========================================================================
// Motion Primitives - Spotlight Card Effect
// Calculates dynamic mouse position for radial gradient border sheen
// ==========================================================================
class SpotlightEffect {
    constructor() {
        this.cards = document.querySelectorAll('.spotlight-card');
        this.init();
    }

    init() {
        if (!this.cards.length) return;

        // Skip intensive mouse tracking if reduced motion is preferred
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        this.cards.forEach((card) => {
            card.addEventListener('mousemove', (e) => this.handleMouseMove(e, card));
            card.addEventListener('mouseleave', () => this.handleMouseLeave(card));
        });
    }

    handleMouseMove(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    }

    handleMouseLeave(card) {
        card.style.setProperty('--mouse-x', '-200px');
        card.style.setProperty('--mouse-y', '-200px');
    }
}

// ==========================================================================
// Segmented Filter Tabs (Projects & Certifications)
// ==========================================================================
class FilterTabs {
    constructor(navSelector, itemsSelector, categoryAttr = 'data-category') {
        this.nav = document.querySelector(navSelector);
        this.items = document.querySelectorAll(itemsSelector);
        this.categoryAttr = categoryAttr;
        if (this.nav && this.items.length) {
            this.init();
        }
    }

    init() {
        const buttons = this.nav.querySelectorAll('.filter-btn');
        buttons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const targetFilter = e.currentTarget.getAttribute('data-filter') || e.currentTarget.getAttribute('data-cert-filter');
                this.setActiveTab(buttons, e.currentTarget);
                this.filterItems(targetFilter);
            });
        });
    }

    setActiveTab(buttons, activeBtn) {
        buttons.forEach((btn) => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }

    filterItems(category) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.items.forEach((item) => {
            const itemCat = item.getAttribute(this.categoryAttr);
            const show = category === 'all' || itemCat === category;
            if (show) {
                item.style.display = '';
                if (reduceMotion) {
                    item.style.opacity = '1';
                    return;
                }
                item.classList.add('filter-fade-out');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        item.classList.remove('filter-fade-out');
                        item.style.opacity = '1';
                    });
                });
            } else {
                item.style.display = 'none';
                item.style.opacity = '0';
            }
        });
    }
}

// ==========================================================================
// Animata - Copy Email Chip Micro-interaction
// ==========================================================================
class CopyEmailAction {
    constructor() {
        this.btn = document.getElementById('copyEmailBtn');
        this.tooltip = document.getElementById('copyTooltip');
        if (this.btn) {
            this.init();
        }
    }

    init() {
        this.btn.addEventListener('click', async () => {
            const email = this.btn.getAttribute('data-email') || 'nishchalpanta426@gmail.com';
            try {
                await navigator.clipboard.writeText(email);
                this.showSuccess();
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = email;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showSuccess();
            }
        });
    }

    showSuccess() {
        this.btn.classList.add('copied');
        const icon = this.btn.querySelector('i');
        const btnText = this.btn.querySelector('.btn-text');
        
        if (icon) icon.className = 'fas fa-check';
        if (btnText) btnText.textContent = 'Copied!';
        if (this.tooltip) this.tooltip.textContent = 'Copied to clipboard!';

        setTimeout(() => {
            this.btn.classList.remove('copied');
            if (icon) icon.className = 'fas fa-copy';
            if (btnText) btnText.textContent = 'Copy Email';
            if (this.tooltip) this.tooltip.textContent = 'Click to copy';
        }, 2200);
    }
}

// ==========================================================================
// Mobile Navigation Menu Controller
// ==========================================================================
class MobileNavController {
    constructor() {
        this.menuToggle = document.getElementById('menuToggle');
        this.navMenu = document.getElementById('navMenu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.init();
    }

    init() {
        if (!this.menuToggle || !this.navMenu) return;

        this.menuToggle.addEventListener('click', () => this.toggleMenu());

        // Close when clicking nav links
        this.navLinks.forEach((link) => {
            link.addEventListener('click', () => this.closeMenu());
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.navMenu.classList.contains('active')) {
                this.closeMenu();
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (
                this.navMenu.classList.contains('active') &&
                !this.navMenu.contains(e.target) &&
                !this.menuToggle.contains(e.target)
            ) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        const isOpen = this.navMenu.classList.contains('active');
        if (isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        this.navMenu.classList.add('active');
        this.menuToggle.setAttribute('aria-expanded', 'true');
        const icon = this.menuToggle.querySelector('i');
        if (icon) icon.className = 'fas fa-times';
    }

    closeMenu() {
        this.navMenu.classList.remove('active');
        this.menuToggle.setAttribute('aria-expanded', 'false');
        const icon = this.menuToggle.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
    }
}

// ==========================================================================
// Active Navigation Spy (IntersectionObserver)
// ==========================================================================
class NavigationObserver {
    constructor() {
        this.sections = document.querySelectorAll('section[id]');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.init();
    }

    init() {
        if (!this.sections.length || !this.navLinks.length) return;

        const options = {
            root: null,
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const currentId = entry.target.getAttribute('id');
                    this.setActiveLink(currentId);
                }
            });
        }, options);

        this.sections.forEach((sec) => observer.observe(sec));
    }

    setActiveLink(id) {
        this.navLinks.forEach((link) => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('active');
            }
        });
    }
}

// ==========================================================================
// Contact Form Integration (AWS SES API Gateway)
// ==========================================================================
class ContactFormHandler {
    constructor() {
        this.form = document.getElementById('contact-form');
        this.statusBox = document.getElementById('contact-status');
        this.submitBtn = document.getElementById('submitBtn');
        this.apiUrl = 'https://ue0l82ocg4.execute-api.us-east-1.amazonaws.com/contact';
        this.init();
    }

    init() {
        if (!this.form) return;

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });
    }

    async handleSubmit() {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const messageInput = document.getElementById('message');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();

        // Basic front-end validation
        if (!name || !email || !message) {
            this.showStatus('Please provide your name, email, and a message.', 'error');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showStatus('Please enter a valid email address.', 'error');
            return;
        }

        this.setLoading(true);
        this.showStatus('Sending message...', 'sending');

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, message })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            this.showStatus('Thank you! Your message has been sent successfully.', 'success');
            this.form.reset();

            // Clear success status after 6 seconds
            setTimeout(() => {
                if (this.statusBox.classList.contains('success')) {
                    this.statusBox.style.display = 'none';
                    this.statusBox.className = 'contact-status';
                }
            }, 6000);

        } catch (error) {
            console.error('Contact Form Transmission Error:', error);
            let displayMsg = 'Unable to send message at this time. Please reach out directly to nishchalpanta426@gmail.com.';
            if (error.message && !error.message.includes('Failed to fetch')) {
                displayMsg = `Notice: ${error.message}`;
            }
            this.showStatus(displayMsg, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        if (!this.submitBtn) return;
        this.submitBtn.disabled = isLoading;
        if (isLoading) {
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        } else {
            this.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
        }
    }

    showStatus(message, type) {
        if (!this.statusBox) return;
        this.statusBox.textContent = message;
        this.statusBox.className = `contact-status ${type}`;
        this.statusBox.style.display = 'block';
    }
}

// ==========================================================================
// Scroll Progress (functional position indicator)
// ==========================================================================
class ScrollProgress {
    constructor() {
        this.bar = document.getElementById('scrollProgress');
        this.ticking = false;
        if (this.bar) {
            this.init();
        }
    }

    init() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.bar.style.display = 'none';
            return;
        }
        document.addEventListener('scroll', () => this.requestUpdate(), { passive: true });
        window.addEventListener('resize', () => this.requestUpdate());
        this.update();
    }

    requestUpdate() {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.update();
            this.ticking = false;
        });
    }

    update() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        this.bar.style.transform = `scaleX(${progress})`;
    }
}

// ==========================================================================
// Reveal on Scroll (subtle, staggered, once)
// ==========================================================================
class RevealObserver {
    constructor() {
        this.selector = '.section-header, .about-bio, .matrix-card, .skill-category-card, .project-card, .cert-card, .education-card, .timeline-item, .cv-action-card, .cv-highlights-card, .contact-form-card, .contact-info-card, .hero-content > *, .profile-card, .metrics-strip .metric-item';
        this.items = document.querySelectorAll(this.selector);
        this.init();
    }

    init() {
        if (!this.items.length) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        // Group stagger by parent so grids rise in sequence
        const groups = new Map();
        this.items.forEach((el) => {
            const parent = el.parentElement;
            if (!groups.has(parent)) groups.set(parent, []);
            groups.get(parent).push(el);
        });

        groups.forEach((siblings) => {
            siblings.forEach((el, index) => {
                if (siblings.length > 1) {
                    el.style.setProperty('--reveal-delay', `${Math.min(index * 70, 280)}ms`);
                }
                el.classList.add('reveal');
            });
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -6% 0px'
        });

        this.items.forEach((el) => observer.observe(el));
    }
}

// ==========================================================================
// Journey Narrative (progress fill + active chapter)
// ==========================================================================
class JourneyNarrative {
    constructor() {
        this.timeline = document.querySelector('.journey-section .timeline');
        this.items = document.querySelectorAll('.journey-section .timeline-item');
        if (this.timeline) {
            this.init();
        }
    }

    init() {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!reduceMotion) {
            document.addEventListener('scroll', () => this.updateProgress(), { passive: true });
            window.addEventListener('resize', () => this.updateProgress());
            this.updateProgress();
        } else {
            this.timeline.style.setProperty('--journey-progress', '1');
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.items.forEach((item) => item.classList.remove('is-active'));
                    entry.target.classList.add('is-active');
                }
            });
        }, {
            rootMargin: '-35% 0px -45% 0px',
            threshold: 0
        });

        this.items.forEach((item) => observer.observe(item));
        if (this.items.length) this.items[0].classList.add('is-active');
    }

    updateProgress() {
        const rect = this.timeline.getBoundingClientRect();
        const viewportCenter = window.innerHeight * 0.6;
        const total = rect.height;
        const passed = viewportCenter - rect.top;
        const progress = Math.min(1, Math.max(0, passed / total));
        this.timeline.style.setProperty('--journey-progress', progress.toFixed(3));
    }
}

// ==========================================================================
// Application Bootstrap
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => document.body.classList.add('loaded'));

    // 1. Initialize Theme
    new ThemeController();

    // 2. Initialize Motion Primitives Spotlight Effect
    new SpotlightEffect();

    // 3. Initialize Project Filter Tabs
    new FilterTabs('.projects-section .filter-nav', '#projectsGrid .project-card', 'data-category');

    // 4. Initialize Certification Filter Tabs
    new FilterTabs('.certifications-section .filter-nav', '#certsGrid .cert-card', 'data-category');

    // 5. Initialize Copy Email Action (Animata)
    new CopyEmailAction();

    // 6. Initialize Mobile Navigation
    new MobileNavController();

    // 7. Initialize Active Navigation Spy
    new NavigationObserver();

    // 8. Initialize Contact Form Transmission Handler
    new ContactFormHandler();

    // 9. Storytelling motion: scroll progress, reveals, journey chapters
    new ScrollProgress();
    new RevealObserver();
    new JourneyNarrative();
});
