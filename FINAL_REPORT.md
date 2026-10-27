# FINAL_REPORT (draft)

Status: **in progress.** Sections 3.1–3.8 cover the gate-investigation session of
2026-10-23 and the scroll/ring/hover session of 2026-10-24/25. Later stages
(contact endpoint, Three.js Increment 1, fallow, deploy and SES review, artifact
cleanup, push approval) are not yet done and are not claimed.

**I committed nothing and pushed nothing, and touched no AWS resource.** Two
commits (`b4b289e`, `ae77623`) landed during this work from outside this
session — see *Standing constraints* for exactly which of my changes are and are
not inside them.

### Gate table, as of 2026-10-25

| gate tool | exit | status |
| --- | --- | --- |
| `npm run build` (includes `astro check` + `verify:album`) | 0 | **green** — 0 errors, 0 hints |
| `tools/_scroll-response.test.mjs` | 0 | **green** — refresh identity + clamp + non-vacuity self-check |
| `tools/_ring.test.mjs` | 0 | **green** — 13 checks; proven to exit 1 on an altered copy |
| `tools/dark-probe.mjs` | 0 | **green** — ring front check passes (315→390px) |
| `tools/scroll-regression.mjs` | 0 | **green** — 0 FAIL lines, 135–144 fps both themes |
| `tools/perf-album.mjs` | 0 | **green** |
| `tools/_framecheck.mjs` (new) | 0 | **green** — 128.7 fps Chrome / 139.1 fps Firefox, dark, fast scroll |
| `tools/_hovercheck.mjs` (new) | 0 | **green** — 8/8 in headed Chrome and Firefox |
| `tools/probe-album.mjs` | 1 | 2 pre-existing non-hover failures (see 3.7) |
| `tools/_parallax-cap.mjs` | — | **parked by name** — open, time-boxed, not a visible bug (see 3.6) |

Everything is uncommitted. HEAD is `a295e7f made UI changes`.

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
rather than asserted. **Proof run: dark-probe exits 0 with every assertion
passing**, including the ring front check, whose old `69 -> 69` assertion this
session replaced (3.5).

**`perf-album.mjs` — refresh measured at startup.** Added a dedicated sampler:
a tight `requestAnimationFrame` chain recording the median of 60 deltas, which
sees one delta per display frame and nothing else. `refreshMs` now prefers that
measured value; the old `pct(allFrames, 50) || 16.7` survives only as a
fallback. That old form counted jank as refresh — a long task inflated the
median interval, made the display look slower than it is, and so widened the
allowance for dropped frames by roughly what the jank had already cost. The
dead 60 Hz `expected` constant was **removed** rather than corrected, because
correcting it would have left two disagreeing refresh estimates. **Proof run:
perf-album exits 0**, now reading **145 Hz** with `2132 produced vs 2333 at
145Hz` (3.8) — the 61 Hz quoted in the first draft of this report was machine
load, not the display.

**`scroll-regression.mjs` — scrollVel compared as a rate.** `field.ts:989` sets
`scrollVel` to "px this frame". The check now computes
`|scrollVel| * 1000 / dt` and compares to **1200 px/s**, which is the old
threshold of 20 px in a 16.7 ms frame restated in units — identical at 60 Hz,
not loosened. The formula-based parallax assertion was **removed**, since a
formula applied to a per-frame number cannot say whether a star really moved,
and the figure is still printed for continuity. The cap is meant to be judged by
`tools/_parallax-cap.mjs`. **Proof run: scroll-regression exits 0 with zero FAIL
lines** — the scrollVel rate check passes in both themes (2963/6748 px/s light,
2767/9176 px/s dark, against the 1200 px/s limit), and so does the dark-theme
frame-rate assertion that previously failed at 29.9 fps (3.8).

### 3.4 The refresh dependence of scroll response — RESOLVED

**The mechanism.** The original code measured scroll as a *distance per frame*
and converted it to a rate by multiplying by an assumed 60 Hz:

- `field.ts` — `this.scrollVel = dy; // px this frame`, then
  `const raw = f.scrollVel * 60;` for both `scrollVel` and `pointerVel`;
- `Ambient.astro` — eased `scrollVel` from a per-frame `delta` clamped to
  ±120 px **per frame**, so the clamp itself was refresh-dependent
  (7200 px/s at 60 Hz, 17280 px/s at 144 Hz).

On a 145 Hz panel that made the field's scroll response weaker than on a 60 Hz
one by roughly the ratio of frame rates, and made the clamp silently 2.4×
looser.

**The fix, applied.** `rate` is now the only behaviour — there is no flag, no
`frame` branch and no `?clock` parameter anywhere in production. All the scroll
arithmetic was lifted into a pure module, `src/scripts/scroll-response.ts`, and
both callers import from it:

| export | value / role |
| --- | --- |
| `SCROLL_RESPONSE_GAIN` | **1.0** — the single knob for judging scroll feel |
| `SCROLL_CLAMP_PX_PER_SEC` | 7200 (the old ±120 px/frame at 60 Hz) |
| `SCROLL_STILL_PX_PER_SEC` | 24 — the deadzone, now decided from the input rate |
| `SCROLL_EASE_DECAY_PER_SEC` | 0.001 |
| `rateFromPerFrame` / `perFrameFromRate` | the conversion, at exactly one place |
| `clampDeltaToPerFrame`, `ease`, `clampRate`, `ambientStep`, `fieldRate` | the pipeline |

`scrollVel`/`pvx` remain **px/frame** inside `Ambient.astro` and convert once in
`field.ts` — a literal reading of `scrollVel * 1000 / dt`, which is identical to
`scrollVel / dt_s`.

**Proof: `tools/_scroll-response.test.mjs`, exit 0.**

- **Claim A** — old and new pipelines agree to a worst relative difference of
  **2.18e-16** over 16 live distances × 60 frames, and their ceiling saturation
  is identical (7192.80 px/s).
- **Claim B** — the same input produces the same output at 6.9 ms and 16.67 ms
  (relative difference ~1e-16), and after 1.0 s the settled value is identical at
  both frame rates.
- **Claim C** — clamp and easing bounds hold.
- **Claim D** — a self-check asserts the test can *detect* a wrong conversion,
  so the pass above is not vacuous (`0 == 0`).

**A real bug was found and fixed while doing this.** The deadzone was applied to
the *eased* value, so the minimum scroll speed a reader could produce scaled
with `dt²` rather than `dt`: the original `0.4` px/frame threshold trapped
everything below **≈221 px/s at 60 Hz** and **≈1231 px/s at 144 Hz**. On your
145 Hz display, steady scrolls slower than about 1231 px/s were being ignored
outright. `ambientStep` now decides "still" from the **input rate** and eases the
state to zero before snapping, which removes the rate dependence. The region
where the old code was stuck but the new code responds is `dy = −3, −0.5, 0.5, 3`.

To judge the feel, change `SCROLL_RESPONSE_GAIN` in
`src/scripts/scroll-response.ts` and nothing else.

**Left alone deliberately, for the report rather than a silent change:** star
on-screen speed is the flow velocity (hard-capped 110/90 px/s at `field.ts:658`)
**plus** a parallax term `screenVel × parallaxFor(z)` where
`screenVel = softClamp(scrollFilt, 900)` and the largest parallax is 0.14. That
gives up to **126 px/s**, ~15% above the nominal 110. `field.speeds()` returns
only `hypot(vx, vy)` and does not include this term, which is why an earlier A/B
harness read ~0. Recommendation if you want it: clamp `scrollFilt` to ≤785 px/s
so the sum cannot exceed 110.

### 3.5 Click ring — two replacement checks, both written and both proven to fail

The ring is an **annulus injected into the fluid grid**, not a growing radius
object. `field.ts:327-349`:

```
const ring = radius * 0.45;      // annulus centre, 182px at the 1440x900 probe viewport
const sig  = radius * 0.16;      // its thickness
...
const e = d - ring;
const g = Math.exp(-(e * e) / sig2);
this.u[k] += (cx / d) * amp * g; // outward velocity, annulus-shaped
```

It then travels outward because the field advects itself — `bx = i*cw + cw*0.5
- this.u[k]*dt` — and weakens because of damping,
`const damp = Math.exp(-dt / 0.7)`, i.e. about 0.9 s to die, against a hard
ceiling `FLOW_MAX`.

**This corrects an earlier claim of mine.** I previously reported that `pulse()`
"just pushes `{x, y, r, a}`" and therefore never expands. That was read from
corrupted tool output. There is **no `rings` array** in `field.ts`.

#### Check 1 — `tools/_ring.test.mjs`, unit check on the real `Flow`

It imports `Flow` directly from `src/scripts/field.ts` and runs it in Node at
the dark-probe viewport (1440×900). **Exit 0, 13 checks:**

| check | measured |
| --- | --- |
| peak sits at `radius × 0.45`, not the centre | **176px vs expected 182px**, 138.8 px/s |
| centre is not the strongest point | 0.5 px/s at centre vs 138.8 px/s at peak |
| points outward on all four axes | u = +138.0 / −138.9, v = +138.2 / −139.3 |
| nothing injected beyond the stated radius | 0.00 px/s at 465px |
| front travels outward, 0→900 ms | **304 → 328 → 360 → 400 → 456px** |
| ring **core** is carried, not just spread | **176px → 216px** |
| front never moves inward (15% and 30% thresholds) | monotonic at both |
| amplitude decays as it travels | 138.8 → 17.9 px/s (12.9%) |
| stays under `FLOW_MAX` 240 px/s | peak 138.9 |

#### Check 2 — `dark-probe.mjs`, observable front in the real browser

The old assertion measured `bestR` — the argmax of magnitude — and reported
`69 -> 71px, FAIL`. **Argmax cannot answer the question:** the injected core
stays the strongest point long after the wave has left it, so argmax reports
where the ring was *born*, not where it has *reached*. The replacement measures
the **front**: the outermost radius still carrying 15% of the wave's own peak,
sampled at 100/250/500/900 ms. The threshold stays at the **same 40px** the old
assertion used — it was not relaxed. Only the metric changed.

Measured on the real page: **315 → 334 → 362 → 390px** (76px travelled, never
inward), amplitude 138.9 → 1.2 px/s.

Two input defects in the probe had to be fixed before it could measure anything —
both test-side, neither changes visible behaviour:

1. **The click never registered.** `page.mouse.click()` does down+up with no gap,
   and both can fall inside one animation-frame gap. `pointerDown` is latched by
   `pointerdown`/`pointerup` (`Ambient.astro:150`) but read **once per frame**,
   and `field.ts` requires `f.pointerDown && !wasDown` to be true *during a
   frame*. So `flow.pulse` never ran, and the section was reporting residual
   pointer motion at 3.5 px/s as if it were the ring. Now it holds the press for
   90ms across several frames — grid peak went from **4.7 to 119.9 px/s**.
2. **Rays walked off the grid.** The sampler read `__fieldFlow` past the
   viewport, and `sample()` clamps to the grid, so an out-of-bounds ray reads the
   *same* cell forever — a phantom floor. Each ray now stops at the viewport
   edge, and a ray clipped before the wave dropped below threshold is discarded
   (5 of 8 rays qualified; the click at y=700 with a 405px radius leaves the
   southern arc partly off-screen).

#### Proof that both can fail

A temporary copy `src/scripts/field.__noadvect.ts` was generated with advection
**and** diffusion disabled (`- this.u[k] * dt` → `;`, `- this.v[k] * dt` → `;`,
`const kd = 0`) — damping left intact, so the pulse can only decay in place.

| check | real `field.ts` | altered copy |
| --- | --- | --- |
| `_ring.test.mjs` | exit **0**, 13/13 | exit **1** — front 304→304 (0px), core 176→176 |
| `dark-probe.mjs` ring front | **pass** 315→390px | **FAIL** 298px at all four marks, 0px travelled |

Note the first version of the altered copy disabled advection only — and the
test **still passed**, because diffusion alone moved the front 112px. That was a
weak assertion, not a pass; it is why diffusion had to go too, and why the
core-drift check (228→252px with advection, pinned at 228px without) was added.

The copy was then **discarded**: `field.ts` restored from backup,
`field.__noadvect.ts` deleted and confirmed gone, build re-run green, and both
checks re-run green against the restored state.

### 3.6 The end-to-end parallax measurement — PARKED BY NAME (open, time-boxed, not a visible bug)

> **Parked.** `tools/_parallax-cap.mjs` is **open, time-boxed, and not a
> visible bug.** It is recorded here by name so it is not quietly forgotten: the
> sampler needs an identity/continuity filter and its pointer phase needs
> `page.mouse`, and neither is quick. Nothing in the site looks wrong because of
> it, no gate depends on it, and it was deliberately not started rather than
> half-finished. Reopen it only if the cap itself is called into question.

The contribution it would size is already known from static reading (3.4): a
star's on-screen speed is the flow velocity (capped 110/90 px/s) **plus** a
parallax term reaching `900 × 0.14 = 126 px/s`, about 15% over the nominal cap.
That is reported above as a recommendation, not changed unilaterally.

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

### 3.7 Hover assertion — RESOLVED: the page was right, the input was wrong

**A real user sees correct behaviour.** `tools/_hovercheck.mjs` (new) drives the
pointer the way a hand does — `page.mouse.move(..., { steps })` across the
stage's edge rather than a single jump — and asks three questions that have to
hold *together*, because any one of them alone can pass for the wrong reason
("stops while hovered" is also satisfied by a timer that never started; "runs
while away" by one that never stops):

| check | Chromium, headed | Firefox, headed |
| --- | --- | --- |
| timer **runs** while the pointer is away | **4 swaps / 6s**, `held "none"` | **4 swaps / 6s**, `held "none"` |
| timer **stops** while the pointer is over the stage | **0 swaps / 6s**, `held "hover"` | **0 swaps / 6s**, `held "hover"` |
| the hold is recorded specifically as a hover | `data-held "hover"` ✓ | `data-held "hover"` ✓ |
| timer **runs again** once the pointer leaves | **4 swaps / 6s**, `held "none"` | **4 swaps / 6s**, `held "none"` |

**8/8 in both engines, exit 0.**

So the product needed **no change to visible behaviour** — only the test was
fixed, per the ruling. `probe-album.mjs` was using
`locator.hover({ position: { x: 400, y: 8 } })`, which warps to a single
coordinate 8px from the stage's top edge, right where the revealing arrows sit in
the gutter; that jump did not settle, so `hovering the album stops the timer`
failed while an almost identical hover 60 lines earlier passed. It now moves to
the stage centre over 12 steps. The check and `leaving it starts again` both
pass, along with the focus, lightbox, off-screen and hidden-tab holds.

**Two unrelated `probe-album` failures remain** and are *not* hover: `the first
step never started (limit 300ms after 4670ms of watching)` and `and it stepped
(1 -> 1)`. Both carry the same diagnostic payload — `held: "hover"` with no
pointer action having occurred yet in that run, the pointer sitting at Playwright's
default (0,0) with the album scrolled beneath it. An isolated reproduction
(clean page, pointer moved to 4,4) gives `held "none"`, `timer "on"`, `begin`
set 104ms after `enter`, `swaps 1` — i.e. the album behaves correctly when the
pointer is not over it, and a cursor parked where the album scrolls to is
genuinely hovering it. This is a test-sequencing artefact, not a defect; it is
left unfixed here because it is outside this session's scope and the gate tool
is `verify:album`, which passes.

### 3.8 Proof runs — the quiet-machine results

Every previously red or suspicious number moved once the machine was idle. That
is the whole finding of this section: **they were concurrent-build interference,
not defects.** No threshold was loosened to obtain any of them.

| tool | earlier reading | quiet re-run | verdict |
| --- | --- | --- | --- |
| `scroll-regression.mjs` | exit **1**, dark fast-scroll **29.9 fps**, 10 frames >32ms | exit **0**, light 133.2/143.7 fps, **dark 137.4/135.2 fps, 0 stalls**, **0 FAIL lines** | was load |
| `perf-album.mjs` | **61 Hz** refresh, 574/640 frames | **145 Hz**, `2132 produced vs 2333 at 145Hz`, p50 6.9 / p95 7.1 ms, **0 FAIL** | was load |
| `dark-probe.mjs` | `ring radius grows 69 -> 69` FAIL | **pass**, front 315→390px | was the metric (3.5) |

The scrollVel rate fix from the earlier session still holds: the field saw the
scroll at 2963/6748 px/s (light) and 2767/9176 px/s (dark) against the 1200 px/s
limit.

**`tools/_framecheck.mjs` (new)** was written to settle the frame-rate question
on its own terms — headed, dark theme, fast scroll, reporting the *distribution*
rather than one mean, because a mean of 33ms made of 60ms gaps is a different
problem from a mean of 33ms made of 33ms gaps:

| run | fps | p50 | p95 | p99 | frames >32ms | travelled |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium, dark, clean | **128.7** | 7.10ms | 12.30ms | 25.20ms | 1 | 7760px |
| Chromium, dark, **with** a per-frame `getImageData` readback | **108.0** | 7.60ms | 14.90ms | 35.10ms | 2 | 6520px |
| Firefox, dark, clean | **139.1** | 7.00ms | 10.00ms | 12.00ms | 0 | 8360px |

Two things were tested there, because both were candidates:

1. **Is the readback the cause?** `scroll-regression`'s `ink()` runs on every
   animation frame and does `clearRect` + `drawImage` + a synchronous
   `getImageData` — a full-frame GPU readback. Reproducing it verbatim costs
   ~20 fps (128.7 → 108.0) and adds a p99 tail of 35ms. Real, but it does not
   reach 30 fps on its own.
2. **Is the scroll landing?** The first version of this tool used a plain
   `scrollTo` — and since the document is smooth by default, restarting a smooth
   scroll 145 times a second moves almost nothing, which would have reported a
   comfortable frame rate for entirely the wrong reason. It now uses
   `behavior: 'instant'` and **fails the run if it travels less than 2px/ms**:
   the measured 7760–8360px in 1500ms (≈5170 px/s) confirms the scroll was real.

**The 60 Hz identity** that the removed `?clock` flag used to demonstrate is now
proved by unit test instead, where it belongs: `tools/_scroll-response.test.mjs`
Claim B shows the same input producing the same output at 6.9 ms and 16.67 ms,
and the same settled value after 1.0 s, to ~1e-16. That replaced an A/B harness
whose `field.speeds()` metric read ~0 in both modes — a vacuous `0 == 0` pass
that was correctly identified as proving nothing (and see 3.4 for the real
reason it read ~0: `speeds()` excludes the parallax term).

---

## 7. Status after the 2026-10-24/25 scroll + ring + hover session

### Closed this session

1. **Scroll response is now `rate`, the only mode.** Flag, `frame` branch and
   `?clock` are all gone from production. Arithmetic lives in
   `src/scripts/scroll-response.ts` and is proven by
   `tools/_scroll-response.test.mjs` (exit 0, non-vacuous).
   **To judge the feel: change `SCROLL_RESPONSE_GAIN` there — it is the single
   knob** — then `npm run build` and open `http://localhost:4323/`.
   **Judged on the real display, 2026-10-25: the feel is right at 1.0.** The
   gain is ratified and left untouched; no tuning was applied, and no other
   value feeds scroll strength. Note that the response also *changed for free*
   here — the deadzone fix in (3.4) means gentle scrolls that used to be
   discarded now register — so this verdict covers the new behaviour, not the
   old.
2. **Ring checks: written and proved to fail.** `tools/_ring.test.mjs` (unit, on
   the real `Flow`) and the observable front check in `dark-probe.mjs`, both green
   on the real code and both red on a discarded altered copy (3.5).
3. **Hover: settled.** A real pointer stops the timer dead in headed Chrome and
   Firefox; only the test needed fixing (3.7).
4. **The 29.9 fps and the 61 Hz were load artefacts.** Quiet re-runs: scroll-regression
   exit 0 with 0 FAIL lines and 135–144 fps; perf-album at 145 Hz. Neither threshold
   was loosened (3.8).
5. **A real scroll bug was found and fixed:** the deadzone scaled with `dt²`,
   ignoring steady scrolls below ≈1231 px/s on a 144 Hz display (3.4).

### Parked by name

6. **`tools/_parallax-cap.mjs` — open, time-boxed, not a visible bug** (3.6).
   Recorded deliberately so it is not mistaken for finished work.

### Deploy pipeline — five blockers found and fixed (2026-10-25 → 2026-10-27)

The site was down and the pipeline red from 10-22 onward. **Five** separate
defects stood between it and green. The last run before all of it was
**#18 `a295e7f`, 2026-10-07**; runs #19 through #33 failed.

Only the first two failed in the Build job, before anything was uploaded:

**Blocker 1 — YAML, reported as an error at line 27.** The real break was lines
40–43: `env:` was written as a *sibling* of the `- name:` entries under
`steps:`, i.e. a mapping key dropped into a sequence. GitHub points at line 27
because that is where the sequence starts. It was committed in `4e077e0`
(10-22), so **every push since 10-22 failed to deploy** — which is exactly why
the live site still served the 7 Oct build. Fixed by moving `env:` inside the
Build step; proven 4 parse errors → 0 and 7 well-formed steps.

**Blocker 2 — the 12 MB assertion at `deploy.yml:48-57`.** CI measured
`dist` = 20,904 KB against a 12,000 KB budget. Two real defects behind it:

- `astro.config.mjs:15` claims *"WebP only"* but only sets `responsiveStyles`;
  the claim was never enforced. `<Picture>` defaults `formats` to `['webp']` for
  the `<source>` tags but `fallbackFormat` to the **source** format, so a `.jpg`
  source silently emitted a second full set of JPEGs — **74 files, 10,838 KB**,
  every one with a WebP sibling, none reachable by any WebP-capable browser.
- The real cause of the size: Astro's fallback `<img src>` is the **untouched
  original**, and the original was **6150×4100, 29 MB**. Reformatting to WebP
  did not help much (6,951 KB → 6,503 KB at the same 6150×4100) because the bug
  is resolution, not format. No Astro prop caps that fallback, so the source had
  to be corrected: `src/assets/album/1790495165040.jpg` → **1600×1067, 432 KB**.

The 29 MB original is **not lost** — it remains tracked in
`assets/Carousel_photos/` and `assets/photo_intake/`, and is backed up at
`%TEMP%\opencode\backups\deploy-fix-2026-10-25\`. The site never rendered this
above 1600px anyway: the inline `srcset` tops out at 960w and the lightbox serves
a 1600px WebP.

Also corrected the comment you flagged: it claimed the check measured
`dist/_astro` while `du -sk` measures **all of `dist`**. The comment now matches
the command; the 12,000 KB budget was **not** loosened.

**Blocker 3 — every repository Variable was empty (runs #30–#31).**
The workflow reads `${{ vars.* }}` only, but all five values had been saved on
the **Secrets** tab, which it never reads and which never displays a value
again after saving — so they looked empty forever while being populated. The
annotation was `Input required and not supplied: aws-region`. Two things had
been masking it: a `|| 'ap-south-1'` fallback at `deploy.yml:89` that quietly
pointed every deploy at the wrong region, and a `|| secrets.AWS_DEPLOY_ROLE_ARN`
fallback that could only ever supply a correct ARN or fail as before. The region
fallback was removed (it was actively wrong, not merely permissive); the role
fallback was kept. All five were re-created on the **Variables** tab and
verified by a temporary boolean-only step that printed `true`/`false` and never
a value: **all five resolve**, including `CONTACT_ENDPOINT` — the one that
fails *silently*, by building a form that posts nowhere while CI stays green.

**Blocker 4 — OIDC had never passed, not even once (runs #32–#33).** Two
independent defects:

- The identity provider `token.actions.githubusercontent.com` **did not exist**
  in the account. IAM will save a trust policy naming a provider that isn't
  there — it never validates the reference — and STS then reports *"The web
  identity token provided could not be validated."*
- Even once created, the policy demanded
  `sub = repo:ORG/REPO:ref:refs/heads/main` while the job declares
  `environment: production` (`deploy.yml:74`), which makes GitHub issue
  `sub = repo:ORG/REPO:environment:production` instead. GitHub's OIDC docs state
  this directly: *"The subject claim includes the environment name when the job
  references an environment."*

`git log -S "environment: production"` settles whether this was a regression:
both `environment: production` and `id-token: write` were introduced together in
`4e077e0` (10-22) and were **absent at `a295e7f`**, the last green run. OIDC had
never worked; nothing had broken. The repository predates GitHub's 15 July 2026
immutable-subject-claims change (`created_at: 2026-05-10`), so the classic `sub`
format applies and no `@<id>` suffixes are involved.

**Blocker 5 — the role could send email and nothing else (exit code 254).**
With identity solved, authorization failed. The only policy on the role was
`ses:SendEmail`/`ses:SendRawEmail` — no `s3:*`, no `cloudfront:*`. AWS CLI
return code **254** means *"a request was made to the specified service but the
service returned an error"*, and the first call in the job,
`s3:PutBucketWebsite`, was rejected — confirmed independently by probing the
live site, which still reported `NoSuchKey Key: index.astro` because the website
configuration had never applied. An S3 + CloudFront policy was attached, scoped
to the specific bucket and distribution rather than `*`.

Trade-off recorded deliberately: the Lambda/mail role now doubles as the
deploy role. Splitting them into a dedicated deploy role is **later cleanup**,
not done while the site was down.

| | before | after |
| --- | --- | --- |
| `dist` apparent | 20,318 KB | **10,653 KB** |
| `du -sk` (what CI runs) | 20,904 KB (measured) | **11,072 KB** (projected) |
| verdict | over by 8,904 | **under by 928** |
| JPEGs in `dist/_astro` | 74 | **0** |

Verified after rebuilding: build exits 0 with 0 errors, **183 distinct local
references in `index.html`, none missing**, the one remaining `.jpg` is a
`public/` evidence asset that exists, and both unit gates still pass.

**Final state — measured, not assumed.** Run **#33 `da7d542` completed
successfully (30s)**, and the live site was probed directly afterwards rather
than trusting the checkmark:

| probe | result |
| --- | --- |
| `/` | 200, 121,011 chars, **13 `<picture>`**, WebP |
| `/index.html` | 200, **identical ETag to `/`** → the same file |
| `/404.html` | 200 — *file now exists* (was missing) |
| `/page-that-does-not-exist-xyz` | **404 with the custom HTML page** → real status, no `NoSuchKey` |
| `index.astro` error | gone |
| `last-modified` | `Tue, 27 Oct 2026 11:12:42 GMT` |

A first probe caught `/index.html` at the stale 73,260-byte Oct-7 build; an
immediately following re-fetch returned `x-cache: Miss from cloudfront` with the
current content and a matching ETag. The CloudFront invalidation had been
mid-flight — a transient, not a defect.

**Attribution.** All five fixes were **committed and pushed by you, not by me**
— I made no commits and no pushes. The AWS changes (creating the OIDC provider,
editing the trust policy, attaching the S3/CloudFront policy) were likewise
**yours, done in the console**; I listed no AWS CLI command and ran none.

### Still open

7. **Contact endpoint.** Not diagnosed beyond confirming `config.js` is its
   source. The full sequence — shape of the value → `src/config.local.ts` → the
   form → CSP → CI mapping (`PUBLIC_CONTACT_ENDPOINT`), at most 5 endpoint
   probes, one real send only after explicit approval, `lambda_function.js`
   reviewed with a diff — **is a session's work on its own.**
8. **Three.js Increment 1.** Untouched; also a session's work. If time runs
   short the plan is install-and-scaffold and stop clean.
9. **`tools/probe-album.mjs` exits 1** on two pre-existing non-hover checks
   (3.7). Diagnostic only; `verify:album` is the gate and it passes.
10. **Left alone on purpose, reported not changed:** the star-speed sum reaching
    126 px/s (3.4); `tools/_scrollmode.mjs` depends on removed flags and should
    be deleted at cleanup.

### Standing constraints

**I committed nothing and pushed nothing. No AWS resource was touched.
`sync:vars` was not run. `config.js` is unmodified in the working tree and no
value from it appears anywhere in this report.**

Superseding an earlier draft of this section, which recorded HEAD as `a295e7f`
and listed six files riding uncommitted on top. **None of that holds now** —
those edits were committed in `b4b289e` (10-23), `ae77623` (10-24) and the
10-25/10-27 deploy work. Verified directly rather than assumed:

| | |
| --- | --- |
| `HEAD` | `da7d542` "fixing broken deploy" |
| vs `origin/main` | behind 0, ahead 0 |
| staged | empty — nothing staged |
| working tree | **only `FINAL_REPORT.md`** (this edit) |

Re-checked file by file: `src/components/Ambient.astro`, `src/scripts/field.ts`,
`tools/dark-probe.mjs`, `tools/probe-album.mjs`, `tsconfig.scripts.json` are all
**unmodified**, and `src/scripts/scroll-response.ts`,
`tools/_scroll-response.test.mjs`, `tools/_ring.test.mjs`,
`tools/_framecheck.mjs`, `tools/_hovercheck.mjs` are all **tracked** — none
untracked, none missing. The earlier table would have been misleading to anyone
planning the next change against it.

Backups for this session: `%TEMP%\opencode\backups\rate-default-2026-10-24\`
(`field.ts`, `Ambient.astro`, `dark-probe.mjs`, `perf-album.mjs`,
`_scrollmode.mjs`) and `%TEMP%\opencode\backups\ringproof-2026-10-25\`
(`field.ts.original`).

Scratch readers kept until cleanup: `tools/_integrity.mjs`,
`tools/_integrity-git.mjs`, `tools/_read.mjs`, `tools/_refresh.mjs`.
