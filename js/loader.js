/**
 * Loader: the rolling greeting, over the bare paper.
 *
 * Runs only when the <head> script has set .greet (the first visit in this
 * browser session, or ?hello). While it plays, the hero shows only the
 * paper: no name, no desk, no navigation. Timeline, about 3.5s:
 *   Hello (hold) → roll → வணக்கம் → roll → नमस्ते → roll → Salut → roll →
 *   Salve (hold) → Salve rolls away; then the name rises into its place and
 *   the desk builds itself in (js/hero.js, js/scene.js).
 * Salve holds until the desk is ready (at most a few seconds). Any key,
 * click, tap or wheel skips straight to the hand-over.
 * Reduced motion: one still "Hello", then a short crossfade.
 */
(() => {
  const root = document.documentElement;
  const loader = document.querySelector("[data-loader]");
  if (!loader) return;
  if (!root.classList.contains("greet")) {
    loader.remove();
    return;
  }
  try {
    sessionStorage.setItem("gsv9-greeted", "1");
  } catch (e) {}

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const track = loader.querySelector("[data-loader-track]");
  const count = track.children.length;

  const ROLL = 440; // one greeting rolling into the next
  const HOLD = 280; // a pause on each, long enough to read
  const FIRST = 520; // the first greeting stays a little longer
  const EXIT = 620; // the last greeting rolling away as the name rises
  const WAIT_MAX = 4000; // never hold Salve longer than this for the desk

  let index = 0;
  let timer = null;
  let finished = false;
  let ready = "heroReady" in root.dataset;
  document.addEventListener("hero:ready", () => (ready = true), { once: true });

  const go = (i, duration) => {
    track.style.transitionDuration = `${duration}ms`;
    track.style.setProperty("--i", String(i));
  };

  const skipEvents = ["keydown", "pointerdown", "wheel", "touchstart"];
  const end = () => {
    root.classList.remove("greet");
    loader.remove();
    document.dispatchEvent(new Event("loader:done"));
    skipEvents.forEach((type) => window.removeEventListener(type, skip));
  };

  const finish = (fast) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    loader.classList.add("is-leaving");
    if (reduce) {
      setTimeout(end, 320);
      return;
    }
    const exit = fast ? 420 : EXIT;
    go(count, exit); // roll the last greeting up and away…
    // …then, once it has gone, the name rises and the desk builds
    setTimeout(() => {
      root.classList.remove("is-loading");
      setTimeout(() => root.classList.remove("is-rising"), 1600);
      end();
    }, exit + 60);
  };

  // hold the last greeting until the desk is ready to appear
  const finishWhenReady = (waited = 0) => {
    if (ready || waited >= WAIT_MAX) finish(false);
    else timer = setTimeout(() => finishWhenReady(waited + 100), 100);
  };

  const step = () => {
    if (index < count - 1) {
      index += 1;
      go(index, ROLL);
      timer = setTimeout(step, ROLL + (index === count - 1 ? HOLD + 80 : HOLD));
    } else {
      finishWhenReady();
    }
  };

  const skip = () => finish(true);

  const begin = () => {
    if (finished) return;
    loader.classList.add("is-on");
    timer = setTimeout(reduce ? () => finish(false) : step, reduce ? 900 : FIRST);
  };

  skipEvents.forEach((type) => window.addEventListener(type, skip, { passive: true }));

  // warm the Tamil and Devanagari faces while Hello is showing
  if (document.fonts) {
    document.fonts.load('400 1em "Noto Sans Tamil"', "வணக்கம்").catch(() => {});
    document.fonts.load('400 1em "Noto Sans Devanagari"', "नमस्ते").catch(() => {});
  }
  const face = document.fonts ? document.fonts.load('400 1em "PP Fragment Glare"') : Promise.resolve();
  Promise.race([face, new Promise((r) => setTimeout(r, 800))]).then(begin, begin);
})();
