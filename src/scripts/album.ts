/**
 * The album's conveyor.
 *
 * Three photographs are on the row at a time, in the order the files are
 * named. Every step the leftmost leaves to the left, the other two slide into
 * its place and the next one in the order enters from the right - round the
 * end of the album and back to the first. There is no shuffle bag and no
 * random order anywhere: the sequence is the data's own, so nothing repeats
 * inside a loop and the loop is exactly as long as the album.
 *
 * It runs only while the section is on screen. A quarter of the section
 * visible starts it, arriving starts it at once rather than after an interval,
 * and leaving stops everything - the timer, the step in flight and the decode
 * that step may have been waiting on. Eight hundred pixels out, the first six
 * photographs are decoded so the opening steps never hitch, and nothing is
 * prepared earlier than that.
 *
 * A step is a FLIP. Measure where the three are, apply the new order, measure
 * where they have landed, then play the difference as a transform. Only
 * transform and opacity are ever animated, and the row's height is a fraction
 * of its own width rather than a function of which photographs are in it, so
 * a step cannot move the layout at all: no layout is invalidated, which is
 * what keeps the background field's frame rate up while the row is moving.
 * `will-change` is on for the length of a step and taken off again.
 */

const STEP_MS = 350; // inside the 300-400ms the design asks for
const TICK_MIN = 1300;
const TICK_JITTER = 300; // 1300-1600ms from one step's start to the next
/* The first step after the row comes into view is not made to wait out an
   interval: a reader who has just scrolled to the album should see it move
   at once, so it is scheduled on its own short delay. */
const FIRST_TICK_MS = 100;
const PRELOAD = 3; // photographs fetched and decoded ahead of the row
const SWIPE_MIN = 48;
const DECODE_CAP = 1000; // never stall the row on a slow network
const GAP = 12; // must match --album-gap: var(--s-3)
/* How much of the section has to be on screen before it counts as on screen
   for the conveyor - a quarter of it, so a sliver at the top of the window
   does not set a timer running for a row nobody can see. */
const VISIBLE_RATIO = 0.25;
/* How near the viewport the album has to be before its photographs are
   decoded in advance. Decoding any earlier than this spends work the reader
   may never reach; any later and the first steps hitch. */
const WARM_MARGIN_PX = 800;
const WARM_AHEAD = 6;

interface Photo {
  figure: HTMLElement;
  link: HTMLAnchorElement;
  img: HTMLImageElement;
  index: number;
}

export function startAlbum(): void {
  document.querySelectorAll<HTMLElement>('[data-album]').forEach((root) => wire(root));
}

function wire(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>('[data-album-stage]');
  const row = root.querySelector<HTMLElement>('[data-album-row]');
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-album-prev]');
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-album-next]');
  const live = root.querySelector<HTMLElement>('[data-album-live]');
  const lightbox = root.querySelector<HTMLElement>('[data-album-lightbox]');
  if (!stage || !row || !lightbox) return;

  const photos: Photo[] = [...row.querySelectorAll<HTMLElement>('.album__figure')].map(
    (figure, index) => {
      const link = figure.querySelector<HTMLAnchorElement>('.album__link');
      const img = figure.querySelector<HTMLImageElement>('.album__img');
      if (!link || !img) throw new Error('album figure is missing its link or image');
      return { figure, link, img, index };
    }
  );
  if (photos.length < 3) return;

  /* The script is live from here. The opening three are already the only
     visible ones in the markup, so this first pass adds their slots and
     orders and changes nothing a reader can see. */
  root.setAttribute('data-js', '');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const n = photos.length;

  /* The whole of the state: which photograph is in slot 0. Everything else -
     which three are on the row, and in what order - follows from it. */
  let start = 0;
  let busy = false;
  let timer = 0;
  let swaps = 0;
  let stepStartedAt = 0;
  /* The section being on screen is what the conveyor runs on. While it is
     off there is no timer, no decode and no animation: the reader has left,
     and nothing they cannot see is worth a frame. */
  let onScreen = false;
  /* Bumped every time the row goes inactive. A step that was waiting on a
     decode when that happened checks this afterwards and gives up, so a
     photograph arriving after the reader has scrolled away cannot start a
     step they will never see. */
  let epoch = 0;
  /** The finish half of the step in flight, if there is one, so leaving the
   *  section can end it rather than let it run on behind the reader. */
  let finishInFlight: (() => void) | null = null;
  const held = new Set<string>();

  /** The photograph in a slot, wrapping at the end of the album. */
  const indexAt = (slot: number): number => (((start + slot) % n) + n) % n;

  /** Why the row is not advancing by itself. Reduced motion is one of the
   *  reasons, so a reader who asked for less movement never gets a timer. */
  const isHeld = (): boolean => held.size > 0 || reduced.matches;

  /** Which photographs are on the row, and in which slot.
   *
   *  This is state, not animation: it is applied in one pass and the step
   *  reads the geometry either side of it. `keep` names photographs that are
   *  still on their way off the row - pinned out of flow and fading - which
   *  must not be hidden here. */
  const layout = (nextStart: number, keep: number[] = []): void => {
    start = (((nextStart % n) + n) % n);
    photos.forEach((p, i) => {
      const slot = (((i - start) % n) + n) % n;
      if (slot < 3) {
        p.figure.hidden = false;
        p.figure.dataset.slot = String(slot);
        p.figure.style.order = String(slot * 10);
      } else if (!keep.includes(i)) {
        p.figure.hidden = true;
        p.figure.removeAttribute('data-slot');
        p.figure.style.order = '';
      }
    });
  };

  /** The next few photographs, fetched and decoded before the row asks for
   *  them, so a step never waits on the network while someone is watching.
   *  Nothing is fetched while the section is away: work for a row the reader
   *  has scrolled past is work nobody asked for. */
  const preload = (): void => {
    if (!onScreen) return;
    for (let ahead = 3; ahead < 3 + PRELOAD; ahead++) {
      const img = photos[indexAt(ahead)].img;
      if (img.loading === 'lazy') img.loading = 'eager';
      decode(img);
    }
  };

  /* --- what the row is doing, in attributes -------------------------------- */

  /* These exist for the verification suite, which asserts that a row the
     reader has scrolled past is genuinely idle rather than merely invisible:
     a timer that is armed, a step in flight or a decode under way would each
     show up here. They are written only when the state changes, never per
     frame. */
  let decodes = 0;
  /** Count a decode the album asked for. The suite uses the total to prove
   *  that nothing is decoded while the section is off screen. */
  const countDecode = (): void => {
    decodes++;
    root.dataset.decodes = String(decodes);
  };
  const decode = (img: HTMLImageElement): void => {
    countDecode();
    void img.decode?.().catch(() => undefined);
  };
  const note = (): void => {
    root.dataset.onScreen = onScreen ? '1' : '0';
    root.dataset.timer = timer ? 'on' : 'off';
    root.dataset.busy = busy ? '1' : '0';
    root.dataset.epoch = String(epoch);
  };
  const armTimer = (wait: number): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      note();
      void step(1, false);
    }, wait);
    root.dataset.arm = String(Math.round(performance.now()));
    note();
  };

  /** Wait for a photograph to be ready to draw, but never for long: a row that
   *  has stopped is worse than one that steps onto a photograph still
   *  arriving, and the three ahead are normally already decoded. */
  const settle = async (img: HTMLImageElement): Promise<void> => {
    if (img.complete && img.naturalWidth > 0) return;
    if (img.loading === 'lazy') img.loading = 'eager';
    countDecode();
    await Promise.race([
      img.decode?.().catch(() => undefined) ?? Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, DECODE_CAP)),
    ]);
  };

  /**
   * One step in the direction asked for.
   *
   * Forward, the leftmost photograph leaves to the left and the one after the
   * row enters from the right; backward is its mirror. The two that stay put
   * are not redrawn - they are measured where they were and where they land,
   * and the difference is played as a transform.
   */
  const step = async (dir: 1 | -1, announce: boolean): Promise<void> => {
    if (busy) return;
    /* Off-screen, only the reader's own steps are allowed through - the
       arrows, the keys, the swipe. The timer never asks while the section is
       away, and a step asked for by someone who has just scrolled back is
       exactly what re-entry should feel like. */
    if (!announce && !onScreen) return;

    const leaving = photos[indexAt(dir > 0 ? 0 : 2)];
    const incoming = photos[(((dir > 0 ? start + 3 : start - 1) % n) + n) % n];
    const mine = epoch;
    await settle(incoming.img);
    // The reader may have hovered, focused something, hidden the tab or
    // scrolled away while that was resolving. This step was the timer's idea,
    // not theirs, so it is dropped. A step they asked for - an arrow, a key, a
    // swipe - is applied whatever the holds say: the row is held precisely so
    // that they can walk it themselves, and under reduced motion it is held
    // for good.
    if (epoch !== mine) return;
    if (!announce && isHeld()) return;

    busy = true;
    root.dataset.begin = String(Math.round(performance.now()));
    stepStartedAt = performance.now();
    root.dataset.swaps = String(++swaps);

    const instant = reduced.matches;
    const animating: HTMLElement[] = [];
    let exit = '';

    if (!instant) {
      /* Read once, before anything moves: where the three are, and where the
         row is. Nothing is read again until the step is over. */
      const stageBox = stage.getBoundingClientRect();
      const before = new Map<number, DOMRect>();
      for (let slot = 0; slot < 3; slot++) {
        const p = photos[indexAt(slot)];
        before.set(p.index, p.figure.getBoundingClientRect());
      }

      // The photograph leaving is lifted out of the flow and held where it
      // was, so the row can re-form underneath it while it slides away.
      const leaveBox = before.get(leaving.index) as DOMRect;
      leaving.figure.classList.add('is-leaving');
      leaving.figure.style.position = 'absolute';
      leaving.figure.style.left = `${leaveBox.left - stageBox.left}px`;
      leaving.figure.style.top = `${leaveBox.top - stageBox.top}px`;
      leaving.figure.style.width = `${leaveBox.width}px`;
      leaving.figure.style.height = `${leaveBox.height}px`;
      leaving.figure.style.margin = '0';
      leaving.figure.style.zIndex = '2';
      animating.push(leaving.figure);
      exit = dir > 0 ? `${-(leaveBox.width + GAP)}px` : `${leaveBox.width + GAP}px`;

      // The new order, and where it lands.
      layout(start + dir, [leaving.index]);

      const after = new Map<number, DOMRect>();
      for (let slot = 0; slot < 3; slot++) {
        const p = photos[indexAt(slot)];
        after.set(p.index, p.figure.getBoundingClientRect());
        if (p.index !== leaving.index) animating.push(p.figure);
      }

      // Invert: every photograph that moves is put back where it was, and the
      // one arriving starts outside the row on the side it comes from.
      for (let slot = 0; slot < 3; slot++) {
        const p = photos[indexAt(slot)];
        if (p.index === leaving.index) continue;
        const now = after.get(p.index) as DOMRect;
        const was = before.get(p.index);
        const dx = was
          ? was.left - now.left
          : dir > 0
            ? stageBox.width - (now.left - stageBox.left)
            : -(now.left - stageBox.left) - now.width;
        const dy = was ? was.top - now.top : 0;
        p.figure.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        // Only the arriving photograph starts transparent; the two that were
        // already on the row keep their opacity the whole way.
        if (!was) p.figure.style.opacity = '0';
      }
      leaving.figure.style.transform = 'translate3d(0, 0, 0)';
      for (const fig of animating) fig.style.willChange = 'transform, opacity';
    } else {
      // Reduced motion: the order changes and that is all. No invert, no
      // transition - a frame of inverted position would be movement.
      layout(start + dir);
    }

    /** Release the invert. Called on the next frame so the inverted positions
     *  are the ones that get painted, and the transition carries them to
     *  where the layout has already put them. */
    const play = (): void => {
      for (const fig of animating) {
        fig.style.transition = `transform ${STEP_MS}ms var(--ease), opacity ${STEP_MS}ms var(--ease)`;
      }
      leaving.figure.style.transform = `translate3d(${exit}, 0, 0)`;
      leaving.figure.style.opacity = '0';
      for (let slot = 0; slot < 3; slot++) {
        const p = photos[indexAt(slot)];
        if (p.index === leaving.index) continue;
        p.figure.style.transform = 'translate3d(0, 0, 0)';
        p.figure.style.opacity = '1';
      }
    };

    const finish = (): void => {
      finishInFlight = null;
      for (const fig of animating) {
        // Transition first: taking the transform off afterwards must not be
        // animated back to where it already is.
        fig.style.removeProperty('transition');
        fig.style.removeProperty('transform');
        fig.style.removeProperty('opacity');
        fig.style.removeProperty('will-change');
      }
      leaving.figure.classList.remove('is-leaving');
      leaving.figure.hidden = true;
      for (const prop of ['position', 'left', 'top', 'width', 'height', 'margin', 'z-index']) {
        leaving.figure.style.removeProperty(prop);
      }
      busy = false;
      preload();
      if (announce && live) live.textContent = `Photograph ${indexAt(0) + 1} of ${n}`;
      note();
      // Start-to-start is what the design asks for, so the wait is measured
      // from this step's own beginning rather than from now. Nothing is
      // scheduled while the section is away or held - that is what makes
      // leaving the album silent rather than merely unseen.
      if (!onScreen || isHeld()) return;
      const wait = Math.max(0, TICK_MIN + Math.random() * TICK_JITTER - (performance.now() - stepStartedAt));
      armTimer(wait);
    };

    if (instant) {
      leaving.figure.hidden = true;
      finish();
    } else {
      finishInFlight = finish;
      requestAnimationFrame(() => {
        play();
        // The end of the step is timed off the frame that starts it, so the
        // slide is never cut short by a late timer, and it is one timer
        // rather than one per photograph.
        window.setTimeout(finish, STEP_MS + 40);
      });
    }
  };

  /* --- holds -------------------------------------------------------------- */

  const hold = (reason: string, on: boolean): void => {
    if (on) held.add(reason);
    else held.delete(reason);
    sync();
  };

  /* Set when the section has just come into view and the first step of this
     visit has not been asked for yet. Re-entry starts the row moving at once
     rather than after a full interval: the reader has arrived somewhere, and
     a still row that starts moving a second and a half later reads as broken
     rather than as waiting. */
  let firstTickPending = false;

  const sync = (): void => {
    // Which holds are active, as words. It is the difference between "the row
    // is stopped" and "the row is stopped because the tab is hidden". Reduced
    // motion counts as one of them, because it holds the row for good and a
    // debug attribute that reads "none" while nothing is moving is worse than
    // no attribute at all.
    const words = [...held];
    if (reduced.matches) words.push('reduced');
    root.dataset.held = words.join(' ') || 'none';
    window.clearTimeout(timer);
    timer = 0;
    if (isHeld() || busy || !onScreen) {
      note();
      return;
    }
    const fast = firstTickPending;
    firstTickPending = false;
    armTimer(fast ? FIRST_TICK_MS : TICK_MIN + Math.random() * TICK_JITTER);
  };

  /* The arrows appear on hover over the album, so hover over the album is
     what holds it: the reader is looking at the row. */
  root.addEventListener('pointerenter', () => hold('hover', true));
  root.addEventListener('pointerleave', () => hold('hover', false));
  root.addEventListener('focusin', () => hold('focus', true));
  root.addEventListener('focusout', (e) => {
    if (!root.contains((e as FocusEvent).relatedTarget as Node | null)) hold('focus', false);
  });

  /* --- on screen ----------------------------------------------------------- */

  /* One observer for whether the conveyor should be running at all, and a
     second, wider one that only warms the photographs up. Splitting them
     keeps the decoding work off the running decision: the row moves on a
     quarter of itself being visible, but the photographs are fetched from
     800px out, so the first steps have something to step onto. */
  const io = new IntersectionObserver(
    (entries) => {
      const seen = entries.some((en) => en.isIntersecting);
      if (seen === onScreen) return;
      onScreen = seen;
      if (seen) {
        /* Arriving, not arriving-from-now: the first step is scheduled on
           its own short delay rather than after an interval. */
        root.dataset.enter = String(Math.round(performance.now()));
        firstTickPending = true;
        hold('offscreen', false);
      } else {
        /* Leaving stops everything at once - the timer, the step in flight
           and whatever a decode was still waiting on - so nothing is
           scheduled, animated or fetched for a row the reader cannot see.
           The epoch bump is what tells a step that was mid-decode that its
           moment has passed. */
        epoch++;
        window.clearTimeout(timer);
        timer = 0;
        if (finishInFlight) {
          // End it where it is rather than let it finish behind the reader.
          const end = finishInFlight;
          finishInFlight = null;
          end();
        }
        hold('offscreen', true);
      }
      note();
    },
    { threshold: VISIBLE_RATIO }
  );
  /* Honest from the first frame: the section starts off screen as far as the
     conveyor is concerned until the observer says otherwise. */
  held.add('offscreen');
  io.observe(root);

  /* --- warm-up ------------------------------------------------------------- */

  /* The first six photographs are decoded once the album is within 800px of
     the viewport - near enough that the reader is heading for it, early
     enough that the first few steps never wait on a decode. It is one shot:
     the observer disconnects after its first decode, because once they are
     decoded there is nothing left to prepare. */
  let warmed = false;
  const warm = new IntersectionObserver(
    (entries) => {
      if (warmed || !entries.some((en) => en.isIntersecting)) return;
      warmed = true;
      warm.disconnect();
      for (let i = 0; i < Math.min(WARM_AHEAD, n); i++) {
        const img = photos[indexAt(i)].img;
        if (img.loading === 'lazy') img.loading = 'eager';
        decode(img);
      }
      root.dataset.warmed = '1';
      note();
    },
    { rootMargin: `${WARM_MARGIN_PX}px 0px` }
  );
  warm.observe(root);

  const onVis = (): void => hold('hidden', document.visibilityState !== 'visible');
  document.addEventListener('visibilitychange', onVis);

  /* --- the reader's own steps ---------------------------------------------- */

  prevBtn?.addEventListener('click', () => void step(-1, true));
  nextBtn?.addEventListener('click', () => void step(1, true));

  root.addEventListener('keydown', (e) => {
    // The lightbox walks the album with the same keys while it is open.
    if (!lightbox.hidden) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    void step(e.key === 'ArrowRight' ? 1 : -1, true);
  });

  /* --- lightbox ------------------------------------------------------------- */

  let lbIndex = 0;
  let lbReturn: HTMLElement | null = null;
  const lbImg = lightbox.querySelector<HTMLImageElement>('[data-album-lightbox-img]');
  const lbCounter = lightbox.querySelector<HTMLElement>('[data-album-lightbox-counter]');

  const lbPaint = (): void => {
    const p = photos[lbIndex];
    if (!p || !lbImg) return;
    lbImg.src = p.link.getAttribute('href') || p.img.currentSrc || p.img.src;
    lbImg.alt = p.img.alt;
    if (lbCounter) lbCounter.textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${photos.length}`;
  };

  const lbOpen = (index: number, from: HTMLElement): void => {
    lbIndex = index;
    lbReturn = from;
    lbPaint();
    lightbox.hidden = false;
    hold('lightbox', true);
    lightbox.querySelector<HTMLButtonElement>('[data-album-lightbox-close]')?.focus();
  };

  const lbClose = (): void => {
    lightbox.hidden = true;
    hold('lightbox', false);
    lbReturn?.focus();
    lbReturn = null;
  };

  const lbStep = (delta: number): void => {
    lbIndex = (lbIndex + delta + photos.length) % photos.length;
    lbPaint();
    if (live) live.textContent = `Photograph ${lbIndex + 1} of ${photos.length}`;
  };

  root.addEventListener('click', (e) => {
    const trigger = (e.target as Element | null)?.closest?.('[data-album-open]');
    if (!(trigger instanceof HTMLAnchorElement)) return;
    e.preventDefault();
    lbOpen(Number(trigger.dataset.albumOpen), trigger);
  });

  lightbox.querySelector('[data-album-lightbox-close]')?.addEventListener('click', lbClose);
  lightbox.querySelector('[data-album-lightbox-prev]')?.addEventListener('click', () => lbStep(-1));
  lightbox.querySelector('[data-album-lightbox-next]')?.addEventListener('click', () => lbStep(1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lbClose();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      lbClose();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      lbStep(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      lbStep(-1);
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog while it is open.
      const focusables = [...lightbox.querySelectorAll<HTMLElement>('button')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* --- swipe ---------------------------------------------------------------- */

  let sx = 0;
  let sy = 0;
  let swiping = false;
  row.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      sx = e.clientX;
      sy = e.clientY;
      swiping = true;
    },
    { passive: true }
  );
  row.addEventListener(
    'pointerup',
    (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      // Horizontal, and decisively so. A vertical gesture is the reader
      // scrolling the page and is left entirely alone.
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      void step(dx < 0 ? 1 : -1, true);
    },
    { passive: true }
  );
  // The browser can still take a gesture over - a drag that turns vertical,
  // say - and when it does it cancels the pointer instead of releasing it.
  row.addEventListener('pointercancel', () => (swiping = false), { passive: true });

  reduced.addEventListener?.('change', sync);

  /* --- go ------------------------------------------------------------------- */

  layout(0);
  preload();
  sync();
}
