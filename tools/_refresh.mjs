/* Refresh-rate measurement and emulation, shared by the gate fixes.
 *
 * Why this exists: this machine's panel runs at ~145Hz, and several gates were
 * written assuming 60. Two distinct problems fall out of that:
 *
 *   1. a per-frame quantity (field.ts:989 `scrollVel`, "px this frame") being
 *      compared against a threshold tuned for 60Hz - the same scroll spreads
 *      over ~2.4x as many frames, so each frame moves ~2.4x less, and the
 *      measured peak falls through the threshold;
 *   2. a loop that *assumes* each iteration took 16.7ms, so its scroll speed is
 *      whatever the loop period happens to be rather than what it says.
 *
 * Emulation is an rAF pacer, not a browser flag: there is no CDP hook for
 * refresh rate. It is faithful here because the field derives its clock from
 * the rAF timestamp (Ambient.astro:248 `time: (now - t0) / 1000`), so starving
 * rAF makes the page observe a genuinely lower refresh rate - the fixed-step
 * accumulator in field.ts:1511/1538 then catches up by the right number of
 * steps, exactly as it would on a real 60Hz panel.
 *
 * At 144Hz on this 145Hz panel the pacer is effectively a no-op (every native
 * frame already clears the interval), which is what makes the 60 vs 144
 * comparison a clean single-variable experiment.
 */

/** Median of `n` real rAF deltas, in ms. Quietly rounded to something usable. */
export function measureRefresh(page, n = 60) {
  return page.evaluate((count) => new Promise((resolve) => {
    const dt = [];
    let prev = 0;
    const step = (t) => {
      if (prev) dt.push(t - prev);
      prev = t;
      if (dt.length < count) requestAnimationFrame(step);
      else {
        dt.sort((a, b) => a - b);
        const med = dt[Math.floor(dt.length / 2)];
        resolve({ medianMs: med, hz: 1000 / med, samples: dt.length });
      }
    };
    requestAnimationFrame(step);
  }), n);
}

/**
 * Throttle rAF to at most `hz` callbacks a second. Installed via addInitScript
 * so it is in place before the page's own modules register their loops.
 * Returns without touching anything when hz is null, so callers can pass
 * "no emulation" through the same code path.
 */
export function pacerSource(hz) {
  if (!hz) return '';
  return `(() => {
  const interval = 1000 / ${Number(hz)};
  const native = window.requestAnimationFrame.bind(window);
  let queue = [];
  let scheduled = false;
  let last = 0;
  function pump(now) {
    scheduled = false;
    if (now - last >= interval - 0.25) {
      last = now;
      const cbs = queue;
      queue = [];
      for (const cb of cbs) cb(now);
    }
    if (queue.length && !scheduled) { scheduled = true; native(pump); }
  }
  window.requestAnimationFrame = (cb) => {
    queue.push(cb);
    if (!scheduled) { scheduled = true; native(pump); }
    return 0;
  };
})();`;
}

/** Install the pacer (or nothing) before the page loads. */
export function installPacer(page, hz) {
  const src = pacerSource(hz);
  if (!src) return Promise.resolve();
  return page.addInitScript(src);
}

/** What the page actually ended up running at, after pacing. */
export function verifyPaced(page, hz) {
  return page.evaluate((target) => new Promise((resolve) => {
    const dt = [];
    let prev = 0;
    const step = (t) => {
      if (prev) dt.push(t - prev);
      prev = t;
      if (dt.length < 90) requestAnimationFrame(step);
      else {
        dt.sort((a, b) => a - b);
        resolve({
          target,
          medianMs: dt[45],
          medianHz: 1000 / dt[45],
        });
      }
    };
    requestAnimationFrame(step);
  }), hz);
}
