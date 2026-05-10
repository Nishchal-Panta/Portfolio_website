# Design System

## Color Palette

### Primary Colors

**Light Mode:**
- Background: `#ffffff` (White)
- Surface: `#f8f9fa` (Light Gray)
- Text: `#1a1a2e` (Dark Navy)
- Text Secondary: `#64748b` (Slate)
- Border: `#e2e8f0` (Light Border)

**Dark Mode:**
- Background: `#0f172a` (Deep Navy)
- Surface: `#1e293b` (Navy)
- Text: `#f1f5f9` (Off White)
- Text Secondary: `#cbd5e1` (Light Slate)
- Border: `#334155` (Dark Border)

### Accent Colors

- Primary Accent: `#3b82f6` (Blue)
- Accent Dark: `#1e40af` (Dark Blue)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Error: `#ef4444` (Red)

### Gradients

- Primary: `linear-gradient(135deg, #3b82f6, #0284c7)`
- Accent: `linear-gradient(135deg, #0f172a, #1e293b)`

## Typography

### Font Families

- **Primary**: `Poppins` (Google Fonts)
  - Used for headings, UI text
  - Weights: 300, 400, 500, 600, 700, 800

- **Monospace**: `JetBrains Mono` (Google Fonts)
  - Used for code snippets, technical content
  - Weights: 400, 600

### Font Sizes

```css
h1 {
  font-size: 3.5rem;    /* 56px - Hero title */
  font-weight: 700;
}

h2 {
  font-size: 2.5rem;    /* 40px - Section titles */
  font-weight: 700;
}

h3 {
  font-size: 1.875rem;  /* 30px - Subsections */
  font-weight: 700;
}

h4 {
  font-size: 1.25rem;   /* 20px - Component titles */
  font-weight: 700;
}

p {
  font-size: 1rem;      /* 16px - Body text */
  line-height: 1.8;
  font-weight: 400;
}

small {
  font-size: 0.875rem;  /* 14px - Small text */
}
```

### Line Heights

- Headings: 1.2
- Body: 1.6 - 1.8
- Tight: 1.4

### Letter Spacing

- Hero Title: -0.02em (tighter)
- Headings: -0.01em (slight)
- Normal: 0 (default)
- Wide: 0.5px - 1px (UI elements)

## Spacing System

**Base Unit: 0.25rem (4px)**

```css
--spacing-xs:   0.25rem   /* 4px */
--spacing-sm:   0.5rem    /* 8px */
--spacing-md:   1rem      /* 16px */
--spacing-lg:   1.5rem    /* 24px */
--spacing-xl:   2rem      /* 32px */
--spacing-2xl:  3rem      /* 48px */
--spacing-3xl:  4rem      /* 64px */
--spacing-4xl:  6rem      /* 96px */
```

### Common Applications

- **Padding**: Small content - `var(--spacing-md)` to `var(--spacing-lg)`
- **Margins**: Section spacing - `var(--spacing-2xl)` to `var(--spacing-3xl)`
- **Gap (Grid/Flex)**: `var(--spacing-lg)` to `var(--spacing-2xl)`
- **Button Padding**: Horizontal `var(--spacing-xl)`, Vertical `var(--spacing-md)`

## Border Radius

```css
--radius-sm:   0.375rem   /* 6px - Small elements */
--radius-md:   0.5rem     /* 8px - Buttons, inputs */
--radius-lg:   1rem       /* 16px - Cards, modals */
--radius-xl:   1.5rem     /* 24px - Large elements */
```

## Shadows

```css
--shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

### Usage

- Hover states: `var(--shadow-lg)`
- Lifted cards: `var(--shadow-md)` → `var(--shadow-lg)` on hover
- Heavy emphasis: `var(--shadow-xl)`

## Transitions & Animations

### Timing

```css
--transition-fast:   150ms ease-in-out
--transition-base:   300ms ease-in-out
--transition-slow:   500ms ease-in-out
```

### Common Animations

- **Fade**: opacity from 0 to 1
- **Slide**: transform translateX/Y
- **Scale**: transform scale()
- **Bounce**: keyframe animation
- **Pulse**: opacity pulse effect

### Timing Functions

- **ease-in-out**: Default for UI transitions
- **ease-out**: Entrance animations
- **ease-in**: Exit animations
- **linear**: Continuous rotations

## Component Styles

### Buttons

#### Primary Button
```css
Background: var(--color-accent) /* #3b82f6 */
Color: white
Padding: var(--spacing-md) var(--spacing-xl)
Border Radius: var(--radius-lg)
Font Weight: 600
Box Shadow: 0 4px 15px rgba(59, 130, 246, 0.4)
Hover: translateY(-2px), darkened background
```

#### Secondary Button
```css
Background: var(--color-surface)
Color: var(--color-text)
Border: 1px solid var(--color-border)
Padding: var(--spacing-md) var(--spacing-xl)
Border Radius: var(--radius-lg)
Hover: var(--color-surface-alt) background
```

#### Outline Button
```css
Background: transparent
Border: 2px solid var(--color-accent)
Color: var(--color-accent)
Hover: blue background, white text
```

### Cards

#### Base Card
```css
Background: var(--color-surface)
Border: 1px solid var(--color-border)
Border Radius: var(--radius-lg)
Padding: var(--spacing-xl)
Transition: all 300ms ease-in-out
Hover: translateY(-5px), enhanced shadow
```

#### Feature Card
```css
Text Align: center
Hover: border-accent color
Icon Color: var(--color-accent)
Icon Size: 2.5rem
```

### Tags & Badges

#### Skill Tag
```css
Background: linear-gradient(135deg, #3b82f6, #0284c7)
Color: white
Padding: var(--spacing-sm) var(--spacing-lg)
Border Radius: var(--radius-lg)
Font Size: 0.9rem
Font Weight: 500
Hover: scale(1.05)
```

#### Tech Badge
```css
Background: rgba(59, 130, 246, 0.1)
Color: var(--color-accent)
Border: 1px solid var(--color-accent)
Padding: var(--spacing-xs) var(--spacing-md)
Border Radius: var(--radius-md)
Font Size: 0.85rem
```

### Forms

#### Input / Textarea
```css
Padding: var(--spacing-md)
Background: var(--color-bg)
Border: 1px solid var(--color-border)
Border Radius: var(--radius-md)
Font Size: 1rem
Font Family: var(--font-sans)
Color: var(--color-text)
Focus: border-accent, shadow with accent tint
```

## Responsive Breakpoints

```css
Mobile: < 480px
Tablet: 480px - 768px
Desktop: 768px - 1024px
Large: > 1024px
```

### Common Breakpoints Used

```css
@media (max-width: 480px)    /* Mobile */
@media (max-width: 768px)    /* Tablet & below */
@media (max-width: 1024px)   /* Desktop & below */
```

### Layout Changes

- **Mobile**: Single column, stacked sections
- **Tablet**: Two columns, flexible grids
- **Desktop**: Multi-column, side-by-side layouts

## Dark Mode Implementation

The design system uses CSS custom properties (variables) that change between light and dark themes.

```html
<!-- Default: Light mode -->
<html>

<!-- Dark mode -->
<html data-theme="dark">
```

All colors automatically adapt without code changes:

```css
:root {
    --color-bg: #ffffff;
}

[data-theme="dark"] {
    --color-bg: #0f172a;
}
```

## Accessibility Features

### Color Contrast

- **WCAG AA**: Minimum 4.5:1 ratio for normal text
- **WCAG AAA**: Minimum 7:1 ratio (preferred)
- All accent colors meet AA standards against both backgrounds

### Focus States

- Visible focus outline on all interactive elements
- Focus color: `var(--color-accent)`
- Outline width: 2px
- Outline offset: 2px

### Keyboard Navigation

- Tab order follows visual order
- All links and buttons accessible via keyboard
- Escape key closes modals/menus
- Enter key activates buttons/links

## Animation Best Practices

### Do's

✓ Use transforms (scale, translate, rotate) for performance  
✓ Keep animations under 400ms for UI feedback  
✓ Use ease-out for entrances, ease-in for exits  
✓ Provide `prefers-reduced-motion` support  

### Don'ts

✗ Animate color changes (use them strategically)  
✗ Animations longer than 500ms for interactions  
✗ Multiple simultaneous animations on same element  
✗ Ignore motion preferences  

## Brand Elements

### Logo

- **Format**: "NP" initials in circle gradient
- **Size**: 40px minimum
- **Colors**: Blue gradient (#3b82f6 → #0284c7)
- **Background**: Optional gradient or solid

### Typography Emphasis

- **Primary**: Hero title with gradient
- **Accent**: Section titles with underline
- **Active**: Links with color transition

### Imagery Style

- Professional photography
- Technical screenshots
- Minimalist icons
- High contrast graphics

## Spacing Examples

### Hero Section
```
Top: 96px (var(--spacing-4xl))
Bottom: 64px (var(--spacing-3xl))
Content Gap: 96px (var(--spacing-4xl))
```

### Card Sections
```
Padding: 32px (var(--spacing-xl))
Gap: 24px (var(--spacing-lg))
Border: 1px solid
```

### Text Sections
```
Paragraph Gap: 16px (var(--spacing-md))
Section Gap: 48px (var(--spacing-2xl))
Line Height: 1.8
```

## Color Usage Guidelines

### Text

- **Primary**: Use `--color-text` for main content
- **Secondary**: Use `--color-text-secondary` for muted text
- **Accents**: Use sparingly for emphasis

### Backgrounds

- **Main**: `--color-bg` for page background
- **Surface**: `--color-surface` for cards/sections
- **Alt Surface**: `--color-surface-alt` for hover/active states

### Borders

- **Standard**: `--color-border` for all borders
- **Accent**: `--color-accent` for highlighted borders/focus states

### UI Elements

- **Buttons**: Primary accent `#3b82f6`
- **Links**: Use `--color-accent` with underline
- **Hover**: Slightly darker shade
- **Active**: Full saturation
