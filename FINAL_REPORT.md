# FINAL_REPORT (draft)

Status: **in progress.** Only the gate-investigation session of 2026-10-23 is
written up here. Later stages (Three.js Increment 1, fallow, deploy and SES
review, artifact cleanup, push approval) are not yet done and are not claimed.

Nothing here is committed or pushed. No AWS resource was touched.

---

## 3. Verification results — the three gate questions

### 3.1 Item 6 — file integrity: CLOSED

No file is damaged. Using git as the arbiter (it cannot be fooled by my readers):

| check | result |
| --- | --- |
| tracked files compared to git blobs | **210, 0 byte mismatches** |
| non-UTF-8 files | 0 |
| authored files failing `node --check` | 0 |
| genuinely duplicated blocks | 1 — `tools/constellations.build.json`, generated star arrays, legitimate |

The `dark-probe.mjs` confusion is resolved: git reports **19,872 B / 465 lines**,
the working tree matches blob `8d20ed83…` exactly, and it parses. My earlier
"21,218 B / 683 lines / 1,889 LF" and the "function repeated 20×" were produced
by my own readers, three different wrong numbers for one file. Cause: tool bug.
Nothing needed restoring.

Note for the record: `tools/shared.mjs` does not exist and is referenced by
nothing; tools import `./base-url.mjs`. An earlier note claiming it existed was
wrong.

Scratch readers kept until the cleanup stage: `tools/_integrity.mjs`,
`tools/_integrity-git.mjs`, `tools/_read.mjs`, `tools/_refresh.mjs`.

### 3.2 Item 5 — frame-rate audit

The field is **correctly designed** where it matters most: it is a fixed-step
accumulator (`field.ts:1511` `tick = Math.floor(f.time * 60)`, catch-up capped
at 6 steps) so simulation time equals wall-clock time at any frame rate. That is
deliberate and documented in the code.

| location | what | verdict |
| --- | --- | --- |
| `field.ts:1511,1538-1540` | fixed-step accumulator | **correct** |
| `field.ts:1545,1553-1554` | `scrollVel * 60`, `pointerVel * 60` on per-frame values | **behaviour — measured, not changed** (see 3.4) |
| `Ambient.astro:255-260` | `scrollVel` eased from per-frame `delta`, clamped ±120 px/**frame** | **behaviour — same family** |
| `scroll-regression.mjs:205-206` | parallax/vel from per-frame `scrollVel` | **wrong — fixed to a rate (3.3)** |
| `dark-probe.mjs:417` | `y += (pxPerSec * 16.7) / 1000` | **wrong — fixed (3.3)** |
| `perf-album.mjs:194` | `expected` computed against 60 Hz | **wrong but dead code — removed (3.3)** |
| `perf-album.mjs:211` | `refreshMs` from the run's own frame times | **wrong — fixed (3.3)** |
| `probe-album.mjs:518`, `profile-page.mjs:334` | `p95 <= 16.7ms` | **correct** — a 60 fps floor requirement, not an assumption |
| `spring-tune.mjs:34` | `DT = 1/60` offline spring sim | **correct** |
| `constellation-landmarks.mjs:153`, `fetch-constellations.mjs:111` | arcminutes / Sirius coordinates | **false positives** |

### 3.3 Fixes applied to the gates

All three parse clean (`node --check` exit 0). Backups of the four touched
scripts are at `%TEMP%\opencode\backups\gates-2026-10-23\`.

**`dark-probe.mjs` — the scripted scroll is now clock-driven.** The loop's
period is set by the `evaluate` round-trip plus `waitForTimeout`, not by the
display, so a fixed 16.7 ms increment made the real scroll speed a function of
round-trip latency while reporting `pxPerSec`. Position is now
`(pxPerSec * (Date.now() - t0)) / 1000`, a pure function of wall clock. The
achieved rate is printed against the requested one, so the fix is measured
rather than asserted. **Proof run executed (3.8): dark-probe exits 0, all
assertions pass** except the pre-existing `ring radius grows 69 -> 69`, whose
assertion is being replaced (3.5, ruling 4).

**`perf-album.mjs` — refresh measured at startup.** Added a dedicated sampler:
a tight `requestAnimationFrame` chain recording the median of 60 deltas, which
sees one delta per display frame and nothing else. `refreshMs` now prefers that
measured value; the old `pct(allFrames, 50) || 16.7` survives only as a
fallback. That old form counted jank as refresh — a long task inflated the
median interval, made the display look slower than it is, and so widened the
allowance for dropped frames by roughly what the jank had already cost. The
dead 60 Hz `expected` constant was **removed** rather than corrected, because
correcting it would have left two disagreeing refresh estimates. **Proof run
executed (3.8): perf-album exits 0**, measuring a real 61 Hz refresh and
574 frames produced against 640 expected over the 10.5 s of stepping.

**`scroll-regression.mjs` — scrollVel compared as a rate.** `field.ts:989` sets
`scrollVel` to "px this frame". The check now computes
`|scrollVel| * 1000 / dt` and compares to **1200 px/s**, which is the old
threshold of 20 px in a 16.7 ms frame restated in units — identical at 60 Hz,
not loosened. The formula-based parallax assertion was **removed**, since a
formula applied to a per-frame number cannot say whether a star really moved,
and the figure is still printed for continuity. The cap is meant to be judged by
`tools/_parallax-cap.mjs`. **Proof run executed (3.8): the scrollVel rate check
passes in both themes** (2963/6748 px/s light, 2767/9176 px/s dark, against the
1200 px/s limit). A *different* assertion in the same tool fails — dark-theme
frame rate under fast scroll (29.9 fps); see 3.8.

### 3.4 The 145 Hz flag — NOT ESTABLISHED

The mechanism is confirmed in code:

- `field.ts:989` `this.scrollVel = dy; // px this frame` — a distance, not a rate;
- `field.ts:1545` `const raw = f.scrollVel * 60;` — assumes exactly 60 Hz;
- `field.ts:1553-1554` same for `pointerVel`;
- `Ambient.astro:255-260` eases `scrollVel` from a per-frame `delta` clamped to
  ±120 px **per frame**, so the clamp itself is refresh-dependent (7200 px/s at
  60 Hz, 17280 px/s at 144 Hz).

So on a 145 Hz panel the field's scroll response *should* be weaker than on a
60 Hz one, by roughly the ratio of frame rates. **The measurement that was
supposed to size this did not run at the rates it claimed, so no ratio can be
reported.** See 3.6.

### 3.5 Click ring — the ring does expand; the old check measured the wrong thing

The ring is an **annulus injected into the fluid grid**, not a growing radius
object. `field.ts:327-349`:

```
const ring = radius * 0.45;      // annulus centre, 223px at the 1400x1100 test viewport
const sig  = radius * 0.16;      // its thickness
...
const e = d - ring;
const g = Math.exp(-(e * e) / sig2);
this.u[k] += (cx / d) * amp * g; // outward velocity, annulus-shaped
```

It then travels outward because the field advects itself — `field.ts:372-373`
`bx = i*cw + cw*0.5 - this.u[k]*dt` — and weakens because of damping,
`field.ts:403` `const damp = Math.exp(-dt / 0.7)`, i.e. about 0.9 s to die,
against a hard ceiling `FLOW_MAX`.

**This corrects an earlier claim of mine.** I previously reported that `pulse()`
"just pushes `{x, y, r, a}`" and therefore never expands. That was read from
corrupted tool output. There is **no `rings` array** in `field.ts`; the two
occurrences of the string are inside comments about springs. The real code
above shows the ring expands by advection and decays by damping — which is what
the spec asks for.

The old `dark-probe` assertion was measuring `bestR`, defined as
`Math.abs(c.gx - cx)` — the horizontal offset from each row's intensity centroid
to that row's brightest cell. That is not a ring radius, and the reported
"69 -> 71" therefore says nothing about the click ripple. **The replacement
checks (unit check on the annulus, observable check on the radial displacement
front at 100/250/500/900 ms) are specified but not yet written.**

### 3.6 The end-to-end parallax measurement — NOT ESTABLISHED, two defects

`tools/_parallax-cap.mjs` was written and run against both engines. It measures
each particle's real on-screen speed as `|displacement| / real frame interval`,
in px/s, with no particle excluded. It ran 2 themes × 2 target rates × 3 scroll
speeds per engine. **Its output cannot be used**, for two reasons visible in the
output itself:

1. **The rate emulation never reached 144 Hz.** Chromium reported
   `pacedHz 60` for *both* the 60 and the 144 target — headless Chromium runs at
   60 Hz here regardless, so those two columns are the same experiment twice.
   Firefox reported `pacedHz 31` for target 60 and `61` for target 144: pacing
   to a rate just below native makes the pacer drop every other frame, because
   a 16.4 ms native frame does not clear a 16.67 ms interval. The apparent
   `144/60 = 1.99` ratio in Firefox's light theme is that 31-vs-61 Hz artefact,
   not refresh-dependent behaviour.
2. **`max` is contaminated by particle identity.** The sampler matches particles
   by array index between frames. Light theme births and retires figures as it
   scrolls (7 particles), so a retirement plus a birth at a new position reads
   as an instantaneous jump. The reported maxima — 86,729 px/s, 99,389 px/s —
   are ~1355× the p95 and are not physical. They must be filtered by continuity
   (or by an implausible-speed cut) before any max is quoted.

The **p95** figures are plausible and worth re-examining once the sampler is
fixed: dark theme p95 reaches 126.5 px/s in Chromium and 141–365 px/s in
Firefox at 4000 px/s scroll, against a 110 px/s cap. Whether that is real or
also an artefact is **undetermined**.

The pointer phase returned `NaN` in all eight cases: the sweep dispatches
synthetic `PointerEvent`s, which the page does not read as pointer motion. That
phase needs to drive the real cursor via `page.mouse` instead.

### 3.7 Hover assertion — mechanism narrowed, cause not yet proven

The assertion hovers `[data-album-stage]` and expects the row to stop. It fails
with `held: "none"`, `timer: "running"`, one step in six seconds.

The wiring: `album.ts:409-410` `root.addEventListener('pointerenter', …)` on
`[data-album]`; the CSS reveal is `.album:hover .album__arrow` (`album.css:167`).
Both are the same gesture, and CSS `:hover` on the ancestor demonstrably works —
the arrow-reveal assertion on the same element and same `y: 8` offset passes.
So the pointer is over the album, `:hover` matches, and the JS `pointerenter`
hold does not engage. `album.css:126` puts `pointer-events: none` on the arrows
at rest, but that is on the arrows, not the stage. **Not yet proven which of
`pointer-events`, the 150 ms fade timing, or a `pointerleave` fired by the
layout change during a step is responsible.**

### 3.8 Proof runs of the gate fixes + the `scrollmode` flag

**The three proof runs were executed** (sequentially, to avoid the load
interference that caused the earlier album-lede flakiness):

| tool | exit | result |
| --- | --- | --- |
| `scroll-regression.mjs` | 1 | scrollVel rate check **passes** both themes; dark-theme frame-rate assertion fails (29.9 fps fast) — pre-existing/heavy-theme, not caused by the fix |
| `perf-album.mjs` | 0 | all pass; measured 61 Hz refresh, 574/640 frames |
| `dark-probe.mjs` | 0 | all pass except pre-existing `ring radius grows 69 -> 69` |

The scrollVel fix is proven: the field saw the scroll at 2963/6748 px/s (light)
and 2767/9176 px/s (dark), against the 1200 px/s rate limit. The dark-theme
frame-rate failure (49.1 fps slow / 29.9 fps fast) is a different assertion in
the same tool; it is the heavy-theme (220-particle) case and is believed
pre-existing. It cannot be separated from machine load in this run because three
browser tools ran back-to-back; a quiet single run is needed before calling it
either way.

**The `?scrollmode` flag is implemented and inert in production.** Per the
ruling, `field.ts` and `Ambient.astro` now read `?scrollmode=rate` once at
module load (not per frame):

- `field.ts` — `raw = RATE_MODE ? f.scrollVel / frameSeconds : f.scrollVel * ASSUMED_HZ`
  (and the same for `pointerVel`), where `frameSeconds` is the new `dt` the
  caller passes in the Frame.
- `Ambient.astro` — `instant = rateMode ? clamp(delta / dt, ±7200) * dt : clamp(delta, ±120)`,
  the ±120 px/frame clamp restated as 7200 px/s.

Production default is `frame` (unchanged behaviour) when the parameter is
absent. The code is not tree-shaken out — it is *inert*: with no parameter the
`frame` path is taken, which is byte-for-byte the old arithmetic.

**The virtual clock (`?clock=<hz>`) works.** It replaces each frame's timestamp
with a fixed step so the page's own `dt` and `f.time` advance at the named rate
independent of display pacing. Verified: `?clock=60` reports fps 60 and
`?clock=144` reports 144; star positions at scrollY=3000 and the eased
`scroll` are **bit-identical** with and without the parameter, and there are no
console errors.

**The 60 Hz identity of `rate` vs `frame` is NOT empirically proved.** The
algebra is identical at 60 Hz (`x / (1/60) === x * 60`, and the clamp agrees on
both the in-range and saturated branch), but the A/B harness
(`tools/_scrollmode.mjs`) measures star *speeds* via `field.speeds()`, which
read **~0 in both modes** — so "IDENTICAL" was vacuous (0 == 0). An earlier
light-theme run reported a clean pass that proved nothing; the dark-theme run
shows the metric is the defect, not the clock. A working metric must compare
**positions under scroll** (observable and non-zero), not speeds. The harness
needs rework before the identity can be claimed. Per the ruling's "keep it
small; stop and tell me if it exceeds one focused session": **it did, and I am
stopping here on that item.**

---

## 7. Open questions and status after the 2026-10-23 flag session

Rulings from the user have been applied where noted. Remaining items:

1. **Parallax cap — p95/max by engine, theme, scroll speed and mode.** NOT DONE.
   The `?scrollmode` flag is in place and the virtual clock works, but the
   sampler still lacks the identity/continuity filter (match by particle id,
   drop born/retired) and the pointer phase still needs `page.mouse`. Until
   that runs, the dark-theme p95 figures (126.5 px/s Chromium, 141–365 px/s
   Firefox against a 110 px/s cap) remain **undetermined**. If the cap is really
   breached, the contributing code will be quoted and a recommendation given —
   not fixed — per the ruling.
2. **The `?scrollmode` flag — A/B on the real display.** Implemented and inert;
   production default `frame`. The URLs to try on your 145 Hz display:
   - `http://localhost:4323/?scrollmode=frame` (current behaviour, default)
   - `http://localhost:4323/?scrollmode=rate` (the rate-based version)
   - optionally `?clock=60` or `?clock=144` appended to either, to see the
     page's own clock forced to a named rate.
   **What to look for:** scroll the page and compare how strongly the sky
   responds. `frame` and `rate` are identical at 60 Hz; at 145 Hz `rate` should
   make the sky respond about 2.4× more strongly. **The 60 Hz identity is
   algebraically proven but not empirically** — the A/B harness's metric reads
   ~0 and needs rework (3.8). Your eye on the display is currently the only
   working test.
3. **Ring replacement checks.** NOT WRITTEN. The two checks specified by the
   ruling — a unit check on the real annulus (`field.ts:327-349`) and an
   observable radial-displacement-front check at 100/250/500/900 ms — are still
   to be written, and must be proved to fail on a temporary altered copy where
   the pulse does not propagate.
4. **Hover hold.** NOT INVESTIGATED this session. Cause still narrowed to the
   JS `pointerenter` path (CSS `:hover` works on the same element). Needs quiet
   headed runs in Chrome and Firefox with `page.mouse` to determine whether a
   real user sees the arrows.
5. **Dark-theme frame rate under fast scroll (29.9 fps).** Believed pre-existing
   and/or load-induced; needs a quiet single run before it can be called either
   way. Not loosened, not changed.

**Nothing is committed or pushed. No AWS resource was touched. `sync:vars` was
not run.** `src/scripts/field.ts`, `src/components/Ambient.astro`, and the gate
tools are modified but uncommitted; backups of `field.ts` and `Ambient.astro`
are at `%TEMP%\opencode\backups\scrollmode-2026-10-23\`.

**Not started this session** (per the ruling): Three.js Increment 1, fallow, the
deploy/SES review, and artifact cleanup. Those remain for later sessions.
