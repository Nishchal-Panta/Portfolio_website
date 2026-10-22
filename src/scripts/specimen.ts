/**
 * The specimen board.
 *
 * Three jobs, all of them deferred until the section is within 600px of the
 * window, so a reader who never reaches section 05 never pays for any of it:
 *
 *   1. The entrance. The markup ships every plate and every name visible, and
 *      the script marks the board as animated only once it is close. Nothing
 *      is ever hidden waiting for a script that might not run - no JavaScript,
 *      reduced motion, or a touch device all land on the resting state.
 *   2. The tilt marks. [data-tilt] is added rather than written into the
 *      markup, so the one shared pointer listener in scroll.ts never has to
 *      consider tiles that are two screens away, and never at all when a fine
 *      pointer or welcome motion says it would do nothing.
 *   3. The group filter, with a FLIP so the surviving plates travel to their
 *      new places instead of jumping there.
 *
 * The reveal is observed per tile rather than per plate: a plate is taller than
 * a viewport, and revealing it whole would play its last row while that row was
 * still two screens below the fold.
 */

/** The site's easing, and --t-base, kept in step with tokens.css. */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const SETTLE = 250;

export function startSpecimen(): void {
  const board = document.querySelector<HTMLElement>('[data-specimen]');
  if (!board) return;

  /* The board has script from now, not from when it first comes near the
     window. Its layout consequences - one caption per plate, no reserved
     space under any name - are settled in this same task, well before a
     reader can scroll to section 05 and see the difference. A page without
     script never gets this attribute, and never loses a line. */
  board.setAttribute('data-js', '');

  let started = false;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.disconnect();
        if (started) return;
        started = true;
        init(board);
        return;
      }
    },
    // Deliberately generous: the work below runs once, and running it slightly
    // early is cheaper than a visible gap between arrival and first frame.
    { rootMargin: '600px 0px' }
  );

  io.observe(board);
}

function init(board: HTMLElement): void {
  const filter = board.querySelector<HTMLElement>('[data-filter]');
  const plates = [...board.querySelectorAll<HTMLElement>('.plate')];
  const tiles = [...board.querySelectorAll<HTMLElement>('.tile')];

  // The controls do nothing without this file, so they were in the markup
  // hidden. They are not motion, so they come back either way.
  if (filter) filter.hidden = false;

  // Nor is the caption: it swaps a line of text, which is information rather
  // than movement, so it is wired before the reduced-motion branch can return
  // early and take it away with everything else that does move.
  wireSharedContext(board);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reduced.matches) {
    wireFilter(board, plates);
    return;
  }

  measureColumns(tiles);
  board.setAttribute('data-motion', '');

  // Only a fine pointer can produce the tilt, and only when motion is welcome
  // would it be allowed to run.
  if (window.matchMedia('(pointer: fine)').matches) {
    board
      .querySelectorAll<HTMLElement>('.tile__plate')
      .forEach((p) => p.setAttribute('data-tilt', ''));
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.01 }
  );

  // Anything already on screen is marked in the same task as data-motion, so
  // the browser computes one style pass and there is no visible frame of
  // hidden-then-shown content for a reader who arrived on an anchor.
  const inner = window.innerHeight;
  for (const t of tiles) {
    if (t.getBoundingClientRect().top < inner) t.classList.add('is-in');
    else io.observe(t);
  }

  reduced.addEventListener('change', (e) => {
    if (!e.matches) return;
    io.disconnect();
    board.removeAttribute('data-motion');
    for (const t of tiles) {
      t.classList.add('is-in');
      t.style.removeProperty('--i');
    }
  });

  wireFilter(board, plates);
}

/**
 * Turn --i from "nth item in this plate" into "nth column in this row".
 *
 * The markup writes the reading order, which is what a screen reader needs and
 * the wrong thing for a stagger: as written, a tile in the fifth row of a plate
 * would wait a quarter of a second before appearing for no reason a reader can
 * see. Measuring the plates once - at start-up, when they are already laid out
 * and near the window - gives the column instead, so a row settles left to
 * right in about 140ms and nothing else waits behind it.
 *
 * A tile's top is matched against its row within 14px, which tolerates the
 * hair of difference a two-line blurb above a plate can introduce between
 * neighbouring columns without ever merging two genuine rows.
 */
function measureColumns(tiles: HTMLElement[]): void {
  const byPlate = new Map<HTMLElement, HTMLElement[]>();

  for (const t of tiles) {
    const plate = t.closest<HTMLElement>('.plate');
    if (!plate) continue;
    const list = byPlate.get(plate);
    if (list) list.push(t);
    else byPlate.set(plate, [t]);
  }

  for (const list of byPlate.values()) {
    // querySelectorAll returns source order, which for a grid is row-major,
    // so tiles sharing a top are already left to right.
    const rows: { top: number; tiles: HTMLElement[] }[] = [];

    for (const t of list) {
      const top = t.getBoundingClientRect().top;
      let row = rows.find((r) => Math.abs(r.top - top) < 14);
      if (!row) {
        row = { top, tiles: [] };
        rows.push(row);
      }
      row.tiles.push(t);
    }

    for (const row of rows) {
      row.tiles.forEach((t, col) => t.style.setProperty('--i', String(col)));
    }
  }
}

/**
 * The shared context line: one per plate, saying what the tile under the
 * pointer - or under keyboard focus - has to say.
 *
 * Per plate rather than one delegated listener, because each plate owns exactly
 * one line and the lines never trade text with each other. `pointerover` and not
 * `pointerenter`, so a child moving under a slow pointer changes nothing;
 * `focusout` reads `relatedTarget`, so tabbing out of a plate clears its line in
 * the same moment the next plate sets its own.
 *
 * Nothing here is announced. The line is aria-hidden and the tile's own
 * sentence is still in the accessibility tree, so a screen-reader user is told
 * once, by the tile, and is never interrupted by a hover they did not make.
 */
function wireSharedContext(board: HTMLElement): void {
  const tileOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest('.tile') : null;

  for (const plate of [...board.querySelectorAll<HTMLElement>('.plate')]) {
    const line = plate.querySelector<HTMLElement>('.plate__context');
    if (!line) continue;

    let current: Element | null = null;

    const show = (tile: Element | null): void => {
      if (tile === current) return;
      current = tile;
      const text = tile?.querySelector('.tile__context')?.textContent?.trim() ?? '';
      if (line.textContent !== text) line.textContent = text;
    };

    plate.addEventListener('pointerover', (e) => show(tileOf(e.target)));
    plate.addEventListener('pointerleave', () => show(null));
    plate.addEventListener('focusin', (e) => show(tileOf(e.target)));
    plate.addEventListener('focusout', (e) => {
      const to = tileOf(e.relatedTarget);
      show(to && plate.contains(to) ? to : null);
    });
  }
}

/**
 * The group index above the plates.
 *
 * Only plates that were already on screen and stay on screen are measured for
 * the FLIP; a plate arriving from `hidden` has no old rectangle to travel from,
 * so its own tiles do the entering instead. Under reduced motion the
 * rectangles are not measured at all and the layout simply changes.
 */
function wireFilter(board: HTMLElement, plates: HTMLElement[]): void {
  const buttons = [...board.querySelectorAll<HTMLButtonElement>('.specimen__group')];
  if (!buttons.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 'all';

  const select = (id: string): void => {
    if (id === current) return;
    current = id;

    const before = new Map<HTMLElement, DOMRect>();
    if (!reduced.matches) {
      for (const p of plates) {
        if (!p.hidden) before.set(p, p.getBoundingClientRect());
      }
    }

    for (const p of plates) {
      p.hidden = !(id === 'all' || p.dataset.plateId === id);
    }

    for (const b of buttons) {
      const on = b.dataset.plate === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }

    if (reduced.matches) return;

    for (const p of plates) {
      if (p.hidden) continue;
      const from = before.get(p);
      if (!from) continue;
      const to = p.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      // Transform only, and fill:none so nothing is left holding a matrix
      // after the travel is over.
      p.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ],
        { duration: SETTLE, easing: EASE }
      );
    }
  };

  for (const b of buttons) {
    b.addEventListener('click', () => select(b.dataset.plate ?? 'all'));
  }
}
