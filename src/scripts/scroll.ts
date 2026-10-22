/**
 * Scroll orchestration.
 *
 * Chrome and Safari drive the reveals with native CSS scroll-driven animation.
 * Firefox still has not shipped `animation-timeline`, so there it is behind a
 * pref that defaults to off. Rather than leave Firefox with a dead page, the
 * same keyframes are driven by an IntersectionObserver here.
 *
 * The point of doing it this way is that there is only ever ONE motion spec.
 * The CSS holds the keyframes and the durations; this module only decides
 * *when an element has arrived*, which is the single thing the native timeline
 * would otherwise do for us. Same easing, same timing, both engines.
 *
 * Elements are marked once and never unmarked, so nothing flickers when the
 * reader scrolls back up.
 */

const root = document.documentElement;

/* The native timeline exists unless the engine says otherwise. The inline
   bootstrap in the layout sets this before first paint so nothing flashes. */
export function nativeTimeline(): boolean {
  return root.dataset.timeline !== 'fallback';
}

/* Which elements the story reveals, and what class marks them as arrived. */
const REVEAL = '.is-revealed';

function targets(): HTMLElement[] {
  const sel = [
    '.movement-head .movement-index',
    '.movement-head .movement-title',
    '.movement-head .movement-lede',
    '.movement .story-body > *',
    '.print',
    '.margin-note',
    '.reveal',
  ].join(',');
  return Array.from(document.querySelectorAll<HTMLElement>(sel));
}

/**
 * Start the fallback. Only ever called when the native timeline is missing,
 * and only when motion is welcome.
 */
export function startFallback(): void {
  if (root.dataset.timeline !== 'fallback') return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  const nodes = targets();
  if (!nodes.length) return;

  const show = (el: HTMLElement) => el.classList.add(REVEAL.slice(1));

  // Anything already on screen at load is revealed immediately, so there is
  // never a frame of visible-then-hidden content.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        show(e.target as HTMLElement);
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
  );

  for (const el of nodes) {
    if (el.getBoundingClientRect().top < window.innerHeight) show(el);
    else io.observe(el);
  }

  // If the reader turns reduced motion on mid-session, land everything in its
  // finished state rather than leaving half the page mid-animation.
  reduced.addEventListener('change', (e) => {
    if (!e.matches) return;
    for (const el of nodes) {
      el.classList.remove(REVEAL.slice(1));
      el.style.animation = 'none';
    }
    io.disconnect();
  });
}

/* ---------------------------------------------------------------------------
   Pointer tilt.

   A few degrees at most, on media only, transform only, and never on touch or
   under reduced motion. The reveal animation lives on the wrapper so the tilt
   on the image composes with it instead of fighting it.
   ------------------------------------------------------------------------- */

const TILT = '[data-tilt]';
const MAX = 3.2; // degrees

export function startTilt(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let frame = 0;

  const move = (e: PointerEvent) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const el = (e.target as Element | null)?.closest?.(TILT) as HTMLElement | null;
      // Clear anything still tilted from the previous target.
      document
        .querySelectorAll<HTMLElement>('[data-tilting="true"]')
        .forEach((n) => {
          n.removeAttribute('data-tilting');
          n.style.removeProperty('--tx');
          n.style.removeProperty('--ty');
        });
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.setAttribute('data-tilting', 'true');
      el.style.setProperty('--tx', `${(-py * MAX).toFixed(2)}deg`);
      el.style.setProperty('--ty', `${(px * MAX).toFixed(2)}deg`);
    });
  };

  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener(
    'blur',
    () => {
      document
        .querySelectorAll<HTMLElement>('[data-tilting="true"]')
        .forEach((n) => {
          n.removeAttribute('data-tilting');
          n.style.removeProperty('--tx');
          n.style.removeProperty('--ty');
        });
    },
    { passive: true }
  );
}