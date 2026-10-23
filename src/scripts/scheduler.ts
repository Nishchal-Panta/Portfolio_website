/**
 * One requestAnimationFrame loop for the page.
 *
 * The field and the pointer ring each ran their own loop, and a loop that
 * keeps requesting frames while nothing is changing is exactly what this pass
 * exists to remove: two callbacks a frame while the reader sits still, one of
 * them writing a transform that has not moved since the pointer stopped.
 *
 * A subscriber says whether it wants the next frame and does its work only
 * when the driver asks. When the last subscriber goes quiet the loop stops
 * dead - no rAF, no work, no frame budget spent - and `kick()` starts it
 * again from wherever demand reappears.
 *
 * This is only for loops. The one-shot rAF used to coalesce a scroll handler
 * is a throttle, not a loop, and stays where it is.
 */

export interface FrameTask {
  /** Does this task want a frame? Asked before the run and once after it. */
  wants: () => boolean;
  /** Run one frame. `time` is the browser's animation timestamp. */
  run: (time: number) => void;
}

const tasks: FrameTask[] = [];
let raf = 0;

function pump(time: number): void {
  raf = 0;
  let again = false;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t.wants()) continue;
    t.run(time);
    /* Re-checked after the run so a task that stops itself inside its own
       frame - the pointer ring settling, the field being paused by an
       IntersectionObserver - does not buy itself another one. */
    if (t.wants()) again = true;
  }
  if (again && !raf) raf = requestAnimationFrame(pump);
}

/** Register a task and make sure the driver is running. */
export function onFrame(task: FrameTask): () => void {
  tasks.push(task);
  kick();
  return () => {
    const i = tasks.indexOf(task);
    if (i >= 0) tasks.splice(i, 1);
  };
}

/** Ask for a frame. Call it whenever a task's `wants` turns true. */
export function kick(): void {
  if (raf || !tasks.length) return;
  raf = requestAnimationFrame(pump);
}
