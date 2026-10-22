/**
 * Hash navigation to a row or an entry opens it, and focus goes with it.
 *
 * Two things were wrong before this existed. A link from a skill tile or from
 * an event landed the reader on a collapsed `<details>`, so the certificate was
 * one click further away than the link implied; and focus stayed on the link
 * that was clicked, so a keyboard or screen-reader user was told nothing about
 * where they had arrived.
 *
 * What it does, in order:
 *
 *   1. opens the row, if the target is one. A `<details>` expands downwards
 *      from its `<summary>`, so opening it does not move the thing being
 *      aimed at - which is why the scroll below can be left to the browser.
 *   2. moves focus to the row's summary, or to the entry itself. `preventScroll`
 *      keeps focus from firing a second, competing scroll.
 *
 * Scrolling itself is deliberately NOT done here for clicks and hash changes:
 * the browser's own fragment navigation already lands correctly, and it obeys
 * the page's `scroll-padding-top: 5rem`, which is what clears the sticky
 * header. Doing it twice produced a jump. The only place this script scrolls is
 * on first load, where the browser may have already jumped to the fragment
 * before this module ran.
 *
 * Smooth normally, instant under reduced motion, is a stylesheet decision:
 * `html { scroll-behavior: smooth }` with the reduced-motion override in
 * site.css, so every in-page link on the site - rail, tiles, ledger, events -
 * behaves the same way without each one having to ask.
 *
 * No JavaScript: nothing here is required to reach anything. The rows stay
 * collapsed and open on click, because that is native `<details>` behaviour.
 */

/**
 * What counts as a destination rather than a heading. Sections are left
 * entirely alone: the rail's behaviour is already settled and this module must
 * not start moving focus around the page on every navigation.
 */
const DESTINATION = 'details.ledger__row, li.badge, article.event';

const targetOf = (hash: string): HTMLElement | null => {
  if (!hash || hash.length < 2) return null;
  try {
    // Escaped because ids come from file names, which can contain characters
    // that are not valid in a selector.
    const found = document.querySelector(`#${CSS.escape(hash.slice(1))}`);
    return found instanceof HTMLElement ? found : null;
  } catch {
    return null;
  }
};

/** Open the target and take focus to it. Returns false for anything that is
 *  not a row or an entry, so callers can let those through untouched. */
function prepare(hash: string): boolean {
  const el = targetOf(hash);
  if (!el || !el.matches(DESTINATION)) return false;

  if (el instanceof HTMLDetailsElement && !el.open) el.open = true;

  const focusTarget =
    el instanceof HTMLDetailsElement ? (el.querySelector('summary') ?? el) : el;
  focusTarget.focus({ preventScroll: true });
  return true;
}

export function startDeeplink(): void {
  // First load: the browser may have jumped to the fragment before this module
  // was evaluated, or not at all. Land it once, explicitly, with the motion
  // the reader has asked for.
  const initial = location.hash;
  if (initial && prepare(initial)) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    targetOf(initial)?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });

    /* Then wait for the browser's own fragment navigation, which runs a moment
       after this module does and takes focus back. It aims at the row, and a
       <details> is not focusable, so focus lands on the document instead -
       which is the one thing this feature exists to prevent. Re-taking it after
       `load` - always later than that navigation - and only if the hash is
       still the same, so a reader who has already clicked on somewhere else
       keeps the focus they moved to. */
    const retake = () => {
      if (location.hash === initial) prepare(initial);
    };
    if (document.readyState === 'complete') retake();
    else window.addEventListener('load', retake, { once: true });
  }

  // Back and forward, and a hash typed or pasted into the address bar.
  window.addEventListener('hashchange', () => {
    prepare(location.hash);
  });

  // A click on a link that already points at the current hash fires no
  // hashchange, so the row would stay shut on the second visit. This runs
  // before the browser's own navigation, which also means the row is open by
  // the time the browser measures where to scroll.
  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]');
    if (!anchor) return;
    prepare(anchor.getAttribute('href') ?? '');
  });
}
