---
description: Prevents generic, trend-driven, "AI-generated/vibecoded" UI design and enforces intentional, restrained, professional visual design.
---

# Avoid AI-Like Design

You are responsible for preventing generic, repetitive, low-effort, "vibecoded", or obviously AI-generated visual design.

When creating or modifying a user interface, prioritize intentional design decisions, visual hierarchy, usability, consistency, and restraint.

The interface should look like it was designed for the specific product and its users, not assembled from a collection of popular AI/SaaS design trends.

## Absolute Design Restrictions

Do NOT use the following unless the user explicitly requests them:

1. Harsh or excessive gradients
2. Lucide icons as a default icon system
3. Pure white (#FFFFFF) page backgrounds when a more considered neutral would be appropriate
4. Rainbow or multi-color visual schemes without a genuine product reason
5. Generic drop shadows or excessive box shadows
6. Three identical feature cards placed side-by-side simply to fill space
7. Emojis as UI decoration, icons, headings, or feature indicators
8. "Liquid glass", glassmorphism, frosted translucent cards, or excessive backdrop blur
9. Em dashes (—) in interface copy
10. Inter, Geist, Space Grotesk, or other overused AI/SaaS-default fonts unless explicitly required by the existing design system
11. Decorative colored vertical stripes on cards or sections
12. Fake testimonials, invented customer quotes, fabricated reviews, or fake social proof
13. Generic bento grids used purely because they are fashionable
14. Fake terminal/code windows used as decorative hero content
15. The copywriting pattern "It's not X, it's Y"
16. Checkmark bullets used as generic marketing decoration
17. Excessively soft, pill-like, or overly rounded corner radii
18. Purple-and-black themes used as a generic "AI" aesthetic
19. Missing skeleton loaders where content loading can visibly cause layout shifts
20. Decorative radial gradient orbs
21. Decorative dot grids
22. Sparkle icons or sparkle decorations used to signal "AI"
23. Animated arrows used as generic attention-grabbers
24. Hover animations applied to everything
25. Neon colors without a strong product-specific reason
26. Basic pastel color palettes that make the interface look like a generic template

## Additional Anti-Vibecoding Rules

Avoid other common patterns that make an interface look cheaply generated or template-based, including:

- Generic SaaS landing-page layouts
- Generic "AI startup" hero sections
- Oversized gradient text
- Excessive use of rounded cards
- Cards nested inside cards without a clear reason
- Excessive use of badges, pills, chips, and tags
- Decorative UI elements that provide no information
- Excessive borders around every element
- Excessive use of shadows to separate every section
- Randomly mixing multiple visual styles
- Huge typography used solely to appear impressive
- Excessive uppercase labels
- Tiny uppercase tracking-heavy section headings
- Repetitive card layouts
- Repeating the same icon + heading + paragraph pattern
- Generic dashboard layouts when a simpler information hierarchy would work
- Excessive empty space used to imitate premium design
- Excessive dense layouts used to imitate "developer" interfaces
- Fake statistics or metrics
- Fake activity feeds
- Fake avatars
- Fake notifications
- Fake logos or partner brands
- Invented awards or certifications
- Invented user counts
- Invented ratings
- Decorative graphs with no meaningful data
- Decorative charts that do not communicate information
- Generic "AI-powered" visual motifs
- Robot imagery used merely to indicate AI
- Circuit-board imagery used merely to indicate technology
- Abstract glowing blobs
- Floating decorative shapes
- Excessive blur
- Excessive animation
- Parallax effects without a functional purpose
- Scroll-triggered animations for ordinary content
- Animated counters when the number itself does not require animation
- Infinite marquee sections unless they serve a genuine information purpose
- Carousels when static content would be clearer
- Hamburger menus on desktop unnecessarily
- Navigation patterns that hide important functionality without a usability reason

## Icons

Do not automatically reach for an icon library.

Use icons only when they improve comprehension or interaction.

Prefer, in this order:

1. Existing project iconography/design system
2. Platform-native or system icons where appropriate
3. Carefully selected SVG icons
4. A consistent icon library only when it genuinely fits the product

Never add an icon merely because an empty area "looks boring".

Do not use decorative sparkle, magic-wand, rocket, lightning, robot, or similar symbols as generic representations of AI or innovation.

## Typography

Typography must have deliberate hierarchy.

Avoid:

- Overused startup fonts
- Excessive font weights
- Excessive letter spacing
- Huge headings without a content reason
- Tiny text used to create visual sophistication
- All-caps text everywhere
- Mixing too many typefaces

Choose typography based on the product's personality, readability, platform, and existing design system.

If the project already has a typography system, preserve and extend it rather than replacing it unnecessarily.

## Color

Use a restrained and intentional color system.

A typical interface should have:

- A primary text color
- A secondary/muted text color
- A considered background
- A surface/card color where necessary
- A primary action color
- Semantic colors for success, warning, and error

Do not introduce additional colors merely to make the interface appear more visually interesting.

Color must communicate hierarchy or meaning.

Do not use gradients, neon colors, rainbow palettes, or purple/black combinations simply because they are associated with AI products.

## Layout

Design layouts around the actual content and user tasks.

Do not begin with:

"hero + three cards + testimonials + CTA"

or:

"bento grid + floating cards + gradient background"

Instead, determine:

- What the user needs to accomplish
- What information is most important
- What actions matter
- What content deserves visual emphasis
- What should remain secondary
- How the layout should adapt to different screen sizes

Use asymmetry, whitespace, typography, grouping, alignment, and scale intentionally.

Not every section needs to be contained inside a card.

Not every piece of content needs an icon.

Not every page needs a hero section.

## Cards

Cards should exist because they represent a meaningful grouping of information or interaction.

Avoid turning every piece of content into a rounded rectangle.

Avoid:

- Identical cards repeated three or four times
- Excessive corner rounding
- Decorative colored stripes
- Generic shadows
- Nested cards
- Icon + heading + paragraph cards repeated throughout a page

Use flat layouts, dividers, spacing, typography, tables, lists, or other structures when they communicate information more effectively.

## Borders, Shadows, and Depth

Do not rely on shadows to create visual hierarchy.

Prefer:

- Spacing
- Alignment
- Typography
- Background contrast
- Borders used selectively
- Section separation

If shadows are used, they should be subtle and purposeful.

Avoid the common pattern where every card, button, input, dropdown, and container has its own shadow.

## Border Radius

Use corner radius deliberately.

Avoid making every component pill-shaped or heavily rounded.

Buttons, inputs, cards, dialogs, images, and containers do not need to share an exaggerated radius.

The radius should fit the product's visual language.

## Animation and Motion

Motion should communicate state, hierarchy, or continuity.

Do NOT animate elements simply because animation is possible.

Avoid:

- Hover animations on every component
- Buttons that constantly move
- Animated arrows
- Excessive scale transforms
- Bouncing elements
- Floating cards
- Decorative particle effects
- Scroll-triggered animations everywhere
- Excessive entrance animations

Prefer subtle transitions for meaningful interactions such as:

- Opening and closing
- Loading states
- State changes
- Validation feedback
- Navigation transitions

Respect `prefers-reduced-motion`.

## Loading States

Do not leave users looking at blank spaces while content loads.

Where appropriate, implement:

- Skeleton loaders
- Progress indicators
- Loading states for buttons
- Empty states
- Error states

Skeleton loaders should resemble the actual content structure rather than being generic animated rectangles.

Do not add skeleton loading where content is effectively instantaneous and it would create unnecessary visual noise.

## Copywriting

Interface copy should sound like a real product written by a human team.

Avoid:

- Generic AI marketing language
- Empty claims
- Excessive superlatives
- Fake urgency
- "Revolutionary", "seamless", "powerful", "cutting-edge" filler
- "Unlock your potential"
- "Transform your workflow"
- "Take your X to the next level"
- "Built for the future"
- "It's not X, it's Y"
- Artificially clever slogans
- Repetitive sentence structures

Do not fabricate:

- Testimonials
- Reviews
- Statistics
- Customer names
- Company logos
- Awards
- Certifications
- Usage numbers
- Performance claims

If real content is unavailable, use honest placeholders or design the interface without fabricated content.

## Product-Specificity

Every design decision should have a reason related to the actual product.

Before introducing a visual pattern, ask:

- Does this help the user?
- Does this communicate something?
- Does this belong to this product?
- Does this improve hierarchy?
- Is this consistent with the existing interface?
- Would the design still make sense without the decorative element?

If the answer is no, remove it.

## Existing Design System

When modifying an existing project:

1. Inspect the current design system first.
2. Identify existing typography, spacing, colors, components, and interaction patterns.
3. Preserve established patterns that are working.
4. Extend the existing system rather than introducing a completely new aesthetic.
5. Do not replace the design system merely to make the page appear more impressive.

Consistency is more important than novelty.

## Quality Standard

The final interface should feel:

- Intentional
- Product-specific
- Mature
- Clean
- Functional
- Visually coherent
- Accessible
- Responsive
- Professionally designed
- Restrained rather than decorated

It should NOT feel:

- AI-generated
- Template-generated
- Trend-chasing
- Overdesigned
- Cheap
- Sloppy
- Generic
- Like a landing-page template
- Like an "AI startup" stereotype

## Final Design Check

Before considering a UI implementation complete, inspect it critically.

Remove anything that appears to exist only for decoration.

Specifically check for:

- Unnecessary gradients
- Excessive rounded cards
- Generic icon usage
- Decorative AI motifs
- Excessive shadows
- Excessive animations
- Repetitive card layouts
- Fake content
- Generic marketing copy
- Unnecessary badges
- Excessive colors
- Poor typography
- Missing loading states
- Missing empty states
- Missing error states
- Inconsistent spacing
- Inconsistent component styling
- Unnecessary visual effects

The goal is not to make the interface visually plain.

The goal is to make every visual decision feel deliberate.

When choosing between a fashionable visual trend and a simpler design that better serves the product, choose the design that better serves the product.