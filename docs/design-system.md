# Design System

> This document was stale until now: it described Poppins and blue gradients,
> which the stylesheet stopped using some time ago. It has been rewritten to
> match what `src/styles/tokens.css` and `src/styles/site.css` actually do.
> **The CSS is the source of truth. If they ever disagree, the CSS wins.**

## Principles

1. Paper, not screen. A warm off-white ground reads as a printed page rather
   than a browser window.
2. Two accents, one job each. `--accent` is for actions and links only.
   `--verified` is reserved for credentials and means nothing else.
3. Mono is for dates and roles. Labels and headings stay sentence case.
4. Four rendered weights. No italics.
5. Separate with spacing, alignment and hairlines before reaching for shadow.
   There are three shadows in the whole site and they are all for interactive
   overlays.
6. Motion only where scroll position carries meaning.

## Colour

### Light (paper)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f6f4ef` | page ground |
| `--surface` | `#fdfcfa` | raised panels, inputs |
| `--surface-sunk` | `#f1eee7` | image wells, code blocks |
| `--text` | `#1a1917` | body and headings |
| `--text-secondary` | `#4f4b43` | descriptions |
| `--text-muted` | `#6b665c` | meta, labels |
| `--border` | `#e0dbcf` | hairlines |
| `--border-strong` | `#c9c3b4` | emphasis hairline |
| `--accent` | `#1a45c4` | links and actions only |
| `--accent-soft` | `#eaeefc` | selected and hover fills |
| `--verified` | `#8f4207` | **credentials only** |

### Dark (ink)

| Token | Value |
|---|---|
| `--bg` | `#111214` |
| `--surface` | `#191a1d` |
| `--surface-sunk` | `#101113` |
| `--text` | `#f2f0ec` |
| `--text-secondary` | `#c3bfb6` |
| `--text-muted` | `#918c82` |
| `--border` | `#2b2c30` |
| `--accent` | `#93acff` |
| `--verified` | `#e0a64b` |

### Measured contrast

Every pairing below was computed, not assumed.

| Pairing | Ratio | AA |
|---|---|---|
| `--text` on `--bg` (light) | 15.98:1 | pass |
| `--text-secondary` on `--bg` | 7.89:1 | pass |
| `--text-muted` on `--bg` | 5.19:1 | pass |
| `--accent` on `--bg` | 7.10:1 | pass |
| `--verified` on `--bg` | **6.48:1** | pass |
| `--text` on `--bg` (dark) | 16.47:1 | pass |
| `--text-muted` on `--bg` (dark) | 5.60:1 | pass |
| `--accent` on `--bg` (dark) | 8.56:1 | pass |
| `--verified` on `--bg` (dark) | **8.68:1** | pass |

`--verified` was darkened from an earlier `#B45309` precisely so it clears
4.5:1 for small text on the paper ground.

## Typography

Four rendered weights. No italics anywhere.

| Face | Weights | Role |
|---|---|---|
| **Newsreader** (variable, `opsz` pinned to 72, self-hosted) | 500 | display and narrative voice |
| **Plus Jakarta Sans** (self-hosted) | 400, 500 | body and UI |
| **JetBrains Mono** (self-hosted) | 400 | dates, roles, labels |

The optical-size axis is pinned rather than kept live. Keeping it cost
**32.5 KB on the latin subset** (51.9 KB against 19.4 KB), and since Newsreader
is only ever used at display sizes, `opsz 72` is the correct static instance
rather than a compromise.

### Scale

| Token | Value | Used for |
|---|---|---|
| `--step--1` | `0.78rem → 0.82rem` | labels, meta, captions |
| `--step-0` | `1rem → 1.075rem` | body |
| `--step-1` | `1.15rem → 1.35rem` | ledes, sub-headings |
| `--step-2` | `1.4rem → 1.8rem` | event titles |
| `--step-3` | `1.75rem → 2.5rem` | section titles |
| `--step-4` | `2.4rem → 4rem` | 404 |
| `--step-5` | `3rem → 6.5rem` | the opening statement |

Display type is set at `weight 500`, `line-height 1.02` and
`letter-spacing -0.028em`. Body is `1.5` to `1.65` with the measure capped at
`68ch`.

## Space

Base unit `0.25rem`. Named steps `--s-1` (4px) through `--s-10` (128px).
Layout constants: `--measure 68ch`, `--measure-narrow 46ch`, `--page 1200px`,
`--rail 190px`, `--gutter clamp(1.25rem, 4vw, 3rem)`.

## Shape

Three radii only: `--r-1 3px`, `--r-2 6px`, `--r-3 10px`. Pills exist only on
the carousel arrows, which are circular controls.

Three shadows in the site, all for interactive surfaces: `--shadow-subtle`,
`--shadow-card`, `--shadow-dropdown`.

## Motion

Four durations and one easing. There are no others.

| Token | Value | Used for |
|---|---|---|
| `--t-state` | `150ms` | hover, focus, colour, pointer tilt |
| `--t-base` | `250ms` | disclosure, paragraph reveals, theme fallback |
| `--t-scene` | `400ms` | a photograph settling, a scene change |
| `--t-chapter` | `550ms` | a chapter arriving, the theme reveal |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | everything |

### One spec, two triggers

The keyframes and the durations live in `src/styles/story.css` and nowhere
else. What differs between engines is only **when an element has arrived**:

| | Trigger | Cost |
|---|---|---|
| Chrome 115+, Edge 115+, Safari 26+ | native CSS `animation-timeline` | none, compositor only |
| Everything else | `IntersectionObserver` in `src/scripts/scroll.ts` | one class toggle per element |

So both paths run the identical `@keyframes` at the identical durations. There
is no second copy of the motion to drift out of step.

Which path is in use is decided by the inline bootstrap in
`src/layouts/BaseLayout.astro`, before first paint, and written to
`<html data-timeline="native|fallback">`. That ordering matters: if it were
decided after paint, Firefox would show one frame of content in its final state
before the observer started hiding it again.

**Firefox has not shipped scroll-driven animations.** caniuse shows no support
through v161; MDN lists the feature as Limited availability and "Baseline
blocked since September 2025". It sits behind
`layout.css.scroll-driven-animations.enabled`, defaulting to `false`. This is
why the fallback exists rather than a static page.

### What the fallback deliberately does not reproduce

Parallax and the drawn thread. Both are depth cues rather than story, both want
a live scroll position, and both would mean a scroll listener on the main
thread. The reveals carry the narrative, so those are what cross the gap. The
thread is still drawn in Firefox, just drawn in full rather than drawn in.

### Ambient layer

The depth field is raw WebGL (`src/scripts/field.ts`): one shader program, one
buffer, no dependency. It is a sparse cloud of motes in the paper and ink
tokens, normal alpha blending rather than additive so body copy keeps its
measured contrast.

- The camera reads `scrollY` from a passive listener and advances through a
  depth band, so the parallax is real depth rather than a scale trick.
- Because it is rAF-driven rather than timeline-driven, **it runs identically in
  every engine**, including Firefox.
- Ceiling of 1500 points, device pixel ratio capped at 2.
- Paused when the tab is hidden or the canvas is out of view; removed entirely
  on touch, on low-power devices, and under reduced motion.
- If WebGL is refused, the canvas is removed rather than left as a dead element.

### Resting state

Every reveal is authored so that an engine which ignores the animation shows the
**completed** page. No-JS and reduced motion both land on that same state.

Chapter pinning is `position: sticky`, so it needs no scroll listener. The only
scroll listeners in the codebase are the field's cached scroll position, the
rail's `IntersectionObserver`, and the chapter scene stepping.

### Reduced motion

`prefers-reduced-motion: reduce` removes: the depth field and pointer ring
(deleted from the DOM, not just hidden), all reveal animation, parallax, tilt,
smooth scrolling, the theme View Transition, and chapter pinning. Theme changes
become instantaneous. Nothing is reordered or removed from the page: the whole
story is still there, simply still.

## Layout

A page grid with the rail as a real first column at `≥ 78rem`. This replaced a
fixed overlay, which overlapped the headline at 1440 because there is not
enough margin beside a 1200px container to hold a 190px rail.

Horizontal reveals were removed entirely: a `translateX` start offset places
not-yet-revealed elements outside the viewport and produces a horizontal
scrollbar on narrow screens.

## Components

- **Ledger.** Certificates and badges only, as native `<details>` rows. Opens
  with no JavaScript. Nothing else on the page shows these documents.
- **Carousel.** Native `scroll-snap`, real `<button>` controls, `ArrowLeft` /
  `ArrowRight` / `Home` / `End` / `PageUp` / `PageDown`, and an `aria-live`
  status. A trailing spacer makes the last slide reachable by keyboard.
- **Contained figures.** Shown at true size, never cropped, never stretched,
  never rendered wider than the source file.