/**
 * The scroll response, stated in px/s.
 *
 * WHY THIS FILE EXISTS
 *
 * The field used to turn a scroll distance into a rate by multiplying by a
 * constant 60 - `scrollVel * 60` - which is only correct if the frame that
 * produced `scrollVel` really was 1/60s long. On a 145 Hz panel it is 1/145s,
 * so the field saw about 2.4x less scroll than actually happened, and the
 * `Ambient.astro` clamp of +-120px per frame allowed 7200px/s at 60Hz but
 * 17280px/s at 144Hz: a ceiling that moved with the display.
 *
 * Both are now expressed in px/s and multiplied by the frame's real duration.
 * That makes the response a property of the *scroll*, not of the *display*.
 *
 * UNITS, once, everywhere:
 *
 *   px/frame  - a raw per-frame displacement (`window.scrollY` delta). Internal
 *               to `Ambient.astro`, because the browser hands us a distance.
 *   px/s      - a rate. Everything after the first conversion below.
 *
 * The bridge between them is `rateFromPerFrame` / `perFrameFromRate`, and it is
 * deliberately the only place either conversion happens.
 *
 * These functions are pure so they can be unit-tested in Node with no browser,
 * no display and no frame pacing involved - see `tools/_scroll-response.test.mjs`.
 */

/**
 * How hard the sky pushes back against a scroll. THE number to tune the feel.
 *
 * 1.0 is the strength chosen for the rate-based release. Raising it makes the
 * sky travel further for the same flick; lowering it makes it lazier. It is
 * applied once, to the final rate, so it scales the whole response evenly at
 * every refresh rate rather than only the fast or the slow end.
 */
export const SCROLL_RESPONSE_GAIN = 1.0;

/**
 * The scroll rate ceiling, in px/s.
 *
 * This is the old `+-120px per frame` clamp restated: 120px in a 1/60s frame is
 * exactly 7200px/s. Stated in px/s it no longer loosens as the display gets
 * faster - it was 17280px/s on a 144Hz panel before.
 */
export const SCROLL_CLAMP_PX_PER_SEC = 7200;

/**
 * Below this rate the sky is considered still, in px/s.
 *
 * The old deadzone was `0.4px` of frame displacement, i.e. 24px/s at 60Hz.
 * Stated as a rate it means the same thing on every display.
 */
export const SCROLL_STILL_PX_PER_SEC = 24;

/**
 * How fast the eased scroll value forgets its previous state, per second.
 *
 * `0.001 ** dt` means 99.9% of the way to the new value after one second,
 * whatever the frame rate: the constant is per-second, so the shape of the
 * easing does not change when the display does.
 */
export const SCROLL_EASE_DECAY_PER_SEC = 0.001;

/**
 * A per-frame distance becomes a rate: px/frame -> px/s.
 *
 * `dt` is the real duration of the frame in seconds. This is the single
 * conversion the old `* 60` was standing in for; it returns 0 rather than
 * dividing by zero for a degenerate frame.
 */
export function rateFromPerFrame(pxPerFrame: number, dt: number): number {
  return dt > 0 ? pxPerFrame / dt : 0;
}

/** The inverse: px/s -> px/frame for the given frame duration. */
export function perFrameFromRate(ratePxPerSec: number, dt: number): number {
  return ratePxPerSec * dt;
}

/** Clamp a rate to the scroll ceiling. Symmetric: a fast flick up or down. */
export function clampRate(ratePxPerSec: number): number {
  if (ratePxPerSec > SCROLL_CLAMP_PX_PER_SEC) return SCROLL_CLAMP_PX_PER_SEC;
  if (ratePxPerSec < -SCROLL_CLAMP_PX_PER_SEC) return -SCROLL_CLAMP_PX_PER_SEC;
  return ratePxPerSec;
}

/**
 * Exponential ease toward a target.
 *
 * Time-based rather than per-frame: `decay ** dt` expresses the same amount of
 * settling over the same *elapsed time* at any refresh rate, which is what makes
 * the response identical on a 60Hz and a 145Hz panel.
 */
export function ease(current: number, target: number, dt: number): number {
  const k = Math.pow(SCROLL_EASE_DECAY_PER_SEC, dt);
  return current * k + target * (1 - k);
}

/**
 * The clamp as `Ambient.astro` applies it: take this frame's scroll distance,
 * turn it into a rate, clamp the rate, hand back a per-frame distance.
 *
 * The rate clamp is what matters; the round trip to px/frame only exists because
 * `scrollVel` is carried between frames as a distance. At dt = 1/60s this is
 * arithmetically the old `Math.max(-120, Math.min(120, delta))` - on both the
 * in-range branch (`delta * 60 <= 7200` is `delta <= 120`) and the saturated
 * branch (`+-7200 / 60` is `+-120`) - which is the identity under test.
 */
export function clampDeltaToPerFrame(deltaPx: number, dt: number): number {
  return perFrameFromRate(clampRate(rateFromPerFrame(deltaPx, dt)), dt);
}

/**
 * One step of `Ambient.astro`'s integrator: this frame's scroll distance, eased
 * over this frame's duration. Returns a per-frame distance, in the units
 * `scrollVel` is carried in.
 *
 * WHY THE DEADZONE IS TESTED AGAINST THE INPUT, NOT THE EASED VALUE
 *
 * It is tempting to snap to zero on the eased result, which is what the original
 * `if (Math.abs(scrollVel) < 0.4) scrollVel = 0` did. That comparison is against
 * a *per-frame* number while the first step of the ease is `target * (1 - k)`,
 * which shrinks with dt squared - so the fixed threshold gets harder to clear the
 * faster the display, and a value that never clears it stays zero forever. The
 * result was a minimum scroll speed that moved with the display:
 *
 *     original 0.4px/frame deadzone:   ~221 px/s at 60Hz   ~1231 px/s at 144Hz
 *     scaled 24*dt deadzone:           ~221 px/s at 60Hz    ~512 px/s at 144Hz
 *
 * Either way the field quietly ignored slow steady scrolling, and did so far more
 * aggressively on a high-refresh display - the exact refresh dependence this file
 * exists to remove. Deciding from the input rate makes the threshold 24 px/s on
 * every display, and because the state is *eased* toward zero rather than being
 * the thing compared, there is no value it can get stuck below: it decays to the
 * deadzone and then snaps to a true stop.
 */
export function ambientStep(deltaPx: number, dt: number, previousPxPerFrame: number): number {
  const rate = rateFromPerFrame(deltaPx, dt);
  const still = Math.abs(rate) < SCROLL_STILL_PX_PER_SEC;
  const target = perFrameFromRate(still ? 0 : clampRate(rate), dt);
  const eased = ease(previousPxPerFrame, target, dt);
  /* Snap only once there is no input AND the state has decayed to a stop, so a
     page at rest reads exactly zero instead of an exponentially small residue. */
  if (still && Math.abs(rateFromPerFrame(eased, dt)) < SCROLL_STILL_PX_PER_SEC) return 0;
  return eased;
}

/**
 * One step of the field's side: take the carried per-frame displacement and
 * return the rate the sky responds to, in px/s.
 *
 * This is the `scrollVel * 1000 / dt` from the spec - the same quantity, just
 * with its unit corrected - multiplied by the one tuning constant.
 */
export function fieldRate(pxPerFrame: number, dt: number): number {
  return SCROLL_RESPONSE_GAIN * rateFromPerFrame(pxPerFrame, dt);
}
