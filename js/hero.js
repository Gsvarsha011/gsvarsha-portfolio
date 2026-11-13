// Hero: wires the paper, the type, the desk scene, the laptop screen and the
// scroll sequence.
//
// One requestAnimationFrame loop, running only while the hero is on screen
// and the tab is visible. Each frame reads scroll progress through the pinned
// hero (0..1), eases toward it, places the type and the screen panel for that
// progress, and renders the paper (~30 fps) and the desk. Everything is a pure
// function of progress, so scrolling back plays the sequence backwards and a
// reload mid-way lands in the right state.
//
// On a first visit the greeting (js/loader.js) plays first; when it rolls
// away the name rises and the desk builds itself in (introAt / setIntro).
//
// Timeline (progress through the pin):
//   0.03 – 0.20   the name rolls up and out
//   0.09 – 0.27   the roles roll in, the introduction rises in
//   0.27 – 0.40   hold
//   0.40 – 0.48   the roles and introduction leave
//   0.46 – 0.66   the camera swings round behind you        (js/scene.js)
//   0.62 – 0.88   the lid opens as the camera flies into the screen
//   0.885 – 0.91  the projects carousel (#work) fades in over the screen,
//                 which already shows its opening view (paintWork in
//                 js/projects.js); from here the carousel takes over
//   0.93 – 1.00   hold, then the pin releases
import { createPaper } from "./paper.js";
import { createScene } from "./scene.js";
import { initFooter } from "./footer.js";
import { initAbout } from "./about.js";

initFooter();
initAbout();
// everything runs once the fonts are in (see the first await below); the
// whole file is one async function so it also works as a classic script
(async () => {
  const root = document.documentElement;
  const hero = document.querySelector("[data-hero]");
  const pin = hero.querySelector("[data-pin]");
  const frame = hero.querySelector("[data-frame]");
  const words = [...hero.querySelectorAll("[data-word]")];
  const roles = [...hero.querySelectorAll("[data-role]")];
  const intro = hero.querySelector("[data-intro]");
  const hey = hero.querySelector("[data-hey]");
  const workEl = document.querySelector("[data-work]");

  let motion = root.classList.contains("motion");
  const mobile = matchMedia("(max-width: 760px)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const seg = (p, a, b) => clamp01((p - a) / (b - a));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- fonts first: the drawn screen uses them ---------- */

  await Promise.race([
    Promise.all([
      document.fonts.load('400 100px "PP Fragment Glare"'),
      document.fonts.load('400 16px "DM Sans"'),
      document.fonts.load('500 16px "DM Sans"'),
    ]),
    new Promise((r) => setTimeout(r, 3000)),
  ]);

  /* ---------- the laptop screen: the project panel, painted ---------- */

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = mobile ? 1280 : 2048;
  screenCanvas.height = Math.round(screenCanvas.width / (2.94 / 1.9)); // the screen's proportions

  let scene = null;
  try {
    scene = createScene(hero.querySelector("[data-scene]"), { mobile, screenCanvas });
  } catch (e) {
    console.warn("Desk scene unavailable, using the still page.", e);
  }
  if (!scene) {
    root.classList.add("no-gl");
    root.classList.remove("motion");
    motion = false;
  }

  let dirty = true;
  // the laptop screen shows the carousel's opening view (js/projects.js):
  // the part of the viewport the screen covers once the camera arrives
  function redrawScreen() {
    if (!scene || !window.paintWork) return;
    const r = scene.finalScreenRect();
    window.paintWork(screenCanvas, { x: r.x + frame.offsetLeft, y: r.y + frame.offsetTop, w: r.w, h: r.h });
    scene.laptop.screenTex.needsUpdate = true;
    dirty = true;
  }
  document.addEventListener("work:changed", redrawScreen);

  const paperCanvas = hero.querySelector("[data-paper]");
  const paper = createPaper(paperCanvas);
  let painted = false;

  /* ---------- the sequence ---------- */

  let flow = 0;
  let workShown = false;
  let fresh = false; // the laptop's screen repainted on the way in
  function apply(p) {
    // the name rolls up and out of its masks, G first
    words.forEach((el, i) => {
      const t = ease(seg(p, 0.03 + i * 0.03, 0.17 + i * 0.03));
      el.style.transform = t ? `translate3d(0, ${(-112 * t).toFixed(3)}%, 0)` : "";
    });
    // the roles roll up into the same place, then up and away
    roles.forEach((el, j) => {
      const tin = ease(seg(p, 0.09 + j * 0.05, 0.22 + j * 0.05));
      const tout = ease(seg(p, 0.4 + j * 0.03, 0.47 + j * 0.03));
      const y = 112 * (1 - tin) - 112 * tout;
      el.style.transform = y ? `translate3d(0, ${y.toFixed(3)}%, 0)` : "none";
    });
    // the introduction pops out of your head with the roles, and closes as
    // they leave (the motion is a CSS transition, so it is smooth at any speed)
    intro.classList.toggle("is-open", p > 0.17 && p < 0.41);

    // the laptop's screen is a painted copy of the projects: paint it once
    // more as the camera heads for it, so it matches the cards exactly as
    // they are now (the first paint can come before they've settled)
    if (p > 0.7 && !fresh) { fresh = true; redrawScreen(); }
    else if (p < 0.5) fresh = false;

    // the carousel takes over from the drawn screen
    const ts = ease(seg(p, 0.885, 0.91));
    workEl.style.setProperty("--handover", ts.toFixed(3));
    workEl.toggleAttribute("data-waiting", ts === 0);
    const shown = ts > 0.9;
    if (shown !== workShown) {
      workShown = shown;
      document.dispatchEvent(new CustomEvent("work:visible", { detail: shown }));
    }
    flow = p;
  }

  // phones: the projects' stage is held at the top of the screen while the
  // hero is still pinned, and drops back into the page, at the same spot,
  // when it lets go (css/projects.css). Read from the scroll itself, not the
  // eased progress, so the switch lands on the exact pixel.
  const stage = workEl.querySelector(".work__stage");
  function pinWork() {
    const row = motion && root.classList.contains("work-row");
    const pinned = row && hero.getBoundingClientRect().bottom > innerHeight + 0.5;
    if (pinned !== workEl.hasAttribute("data-pinned")) workEl.toggleAttribute("data-pinned", pinned);
    // keep the section's height while its stage is out of the page
    workEl.style.minHeight = row ? `${stage.offsetHeight}px` : "";
  }
  addEventListener("scroll", pinWork, { passive: true });

  /* ---------- loop ---------- */

  // the build-in after the greeting (js/loader.js): 0 = nothing yet, 1 = all in
  const INTRO_MS = 1900;
  let introStart = root.classList.contains("is-loading") ? null : -1; // -1: no intro
  function introAt(now) {
    if (introStart === -1) return 1;
    if (introStart === null) {
      // the loader removes .is-loading when the greeting rolls away
      if (root.classList.contains("is-loading")) return 0;
      introStart = now;
    }
    const v = Math.min(1, (now - introStart) / INTRO_MS);
    if (v >= 1) introStart = -1;
    return v;
  }

  let pSmooth = 0;
  let running = false;
  let visible = true;
  let last = performance.now();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  // the bubble speaks from just above your head: its tail points there, and
  // it sits up and to the right, kept inside the frame
  const bubbleBox = { dx: 0, dy: 0, fw: 1 };
  function measureBubble() {
    const fr = frame.getBoundingClientRect();
    const ir = intro.offsetParent ? intro.offsetParent.getBoundingClientRect() : fr;
    bubbleBox.dx = fr.left - ir.left;
    bubbleBox.dy = fr.top - ir.top;
    bubbleBox.fw = fr.width;
  }
  let heyAt = null;
  const rolesEl = hero.querySelector(".roles");
  function placeBubbles() {
    // the introduction: above your head, tail pointing down at it, but never
    // over the roles. Only when the two would share columns does it slide
    // clear of them (to their right if your head is there, else below them).
    const h = scene.headPoint();
    const w = intro.offsetWidth;
    const maxLeft = bubbleBox.fw - 16 - w;
    let left = Math.max(16, Math.min(h.x - 18, maxLeft));
    let by = h.y - 14 + bubbleBox.dy;
    const rolesL = rolesEl.offsetLeft - bubbleBox.dx;
    const rolesR = rolesL + rolesEl.offsetWidth;
    const rolesBottom = rolesEl.offsetTop + rolesEl.offsetHeight;
    const overlaps = (l) => l < rolesR + 16 && l + w > rolesL - 16;
    if (by - intro.offsetHeight < rolesBottom + 14 && overlaps(left)) {
      const clear = rolesR + 16;
      if (clear <= maxLeft && h.x - clear >= 22) left = clear;
      else by = rolesBottom + 14 + intro.offsetHeight;
    }
    const tail = Math.max(22, Math.min(h.x - left, w - 22));
    intro.style.setProperty("--bx", `${(left + bubbleBox.dx).toFixed(1)}px`);
    intro.style.setProperty("--by", `${by.toFixed(1)}px`);
    intro.style.setProperty("--tail", `${tail.toFixed(1)}px`);
    // "heyy!": to the right of your head, tail pointing left at it
    const s = scene.headPoint(0.8, 0.42);
    hey.style.setProperty("--bx", `${(s.x + 20 + bubbleBox.dx).toFixed(1)}px`);
    hey.style.setProperty("--by", `${(s.y + bubbleBox.dy).toFixed(1)}px`);
  }

  function progress() {
    const r = hero.getBoundingClientRect();
    const total = r.height - pin.offsetHeight;
    return total > 0 ? clamp01(-r.top / total) : 0;
  }

  function draw(now, dt) {
    const t = motion ? now / 1000 : 4.0;
    if (paper) {
      paper.uniforms.uTime.value = t;
      paper.uniforms.uGrainTick.value = Math.floor(t * 10) % 1000;
      paper.uniforms.uFlow.value = flow;
      paper.render(t, !motion);
      if (!painted) {
        // the first real frame of paper: fade it in over its CSS stand-in
        painted = true;
        paperCanvas.classList.add("is-drawn");
      }
    }
    if (!scene) return announce();
    // once the panel covers the screen there is nothing left to draw
    const intro = introAt(now);
    if (intro < 1) dirty = true;
    if (motion && pSmooth >= 0.93 && !dirty) return;
    const k = 1 - Math.exp(-dt * 4);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    scene.update(motion ? pSmooth : 0, t, pointer, intro);
    if (motion) {
      // "heyy!" once you have settled in, until the page starts to scroll
      if (intro >= 1 && heyAt === null) heyAt = now + 500;
      hey.classList.toggle("is-open", heyAt !== null && now >= heyAt && pSmooth < 0.04);
      if (pSmooth < 0.5) placeBubbles();
    }
    scene.render();
    dirty = false;
    announce();
  }
  // the hero's first complete frame (paper and desk, whose first render is
  // the slow one): the cover (js/loader.js) waits for it, so it never
  // stalls mid-gesture
  let announced = false;
  function announce() {
    if (announced) return;
    announced = true;
    root.dataset.heroPainted = "";
    document.dispatchEvent(new Event("hero:painted"));
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // never negative, even after a long sleep
    last = now;
    const target = progress();
    const k = 1 - Math.exp(-dt * 9);
    const next = Math.abs(target - pSmooth) < 1e-4 ? target : pSmooth + (target - pSmooth) * k;
    if (next !== pSmooth) {
      pSmooth = next;
      apply(pSmooth);
      dirty = true;
    }
    draw(now, dt);
    loop = requestAnimationFrame(tick);
  }

  // one loop at a time: stop() cancels the frame it had asked for, so leaving
  // the tab and coming back never leaves a second loop running
  let loop = 0;
  function start() {
    if (running || !motion || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    loop = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(loop);
  }

  // still mode: draw only when something changes
  let stillPending = false;
  function drawStill() {
    if (stillPending) return;
    stillPending = true;
    requestAnimationFrame((now) => {
      stillPending = false;
      dirty = true;
      draw(now, 1 / 60);
    });
  }

  function onResize() {
    requestAnimationFrame(pinWork); // outside the observer's callback
    const w = frame.clientWidth, h = frame.clientHeight;
    if (paper) paper.resize(w, h);
    if (scene) scene.resize(w, h);
    redrawScreen();
    if (motion) measureBubble();
    if (motion) {
      pSmooth = progress();
      apply(pSmooth);
    }
    dirty = true;
    if (!running) drawStill();
  }

  new ResizeObserver(onResize).observe(frame);

  if (motion) {
    new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      // the carousel only needs its own backdrop while it covers the hero
      workEl.toggleAttribute("data-over-hero", visible);
      if (!visible) {
        // leaving (even in one jump): settle into the exact end state, so
        // the carousel below is shown, or hidden again above
        pSmooth = progress();
        apply(pSmooth);
      }
      visible ? start() : stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    if (finePointer) {
      window.addEventListener("pointermove", (e) => {
        pointer.tx = (e.clientX / innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
    }
    // a jump skips the sequence: the eased progress goes straight to where
    // the scroll now is, or the scene would play its way over; the next
    // frame draws it, before the crossfade shows it
    const snap = () => {
      pSmooth = progress();
      apply(pSmooth);
      dirty = true;
      if (!running) drawStill();
    };
    // "Work" jumps straight to the projects, from a click here or a link
    // from a case study (index.html#work)
    const toWork = () => {
      const top = hero.getBoundingClientRect().top + scrollY;
      const k = root.classList.contains("work-row") ? 1 : 0.96;
      scrollTo({ top: top + k * (hero.offsetHeight - pin.offsetHeight), behavior: "instant" });
      snap();
    };
    document.querySelectorAll('a[href="#work"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        softJump(toWork);
      })
    );
    // the name goes back to the top the same way
    document.querySelectorAll('a[href="#top"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        softJump(() => {
          scrollTo({ top: 0, behavior: "instant" });
          snap();
        });
      })
    );
    // (again once loaded: the browser's own jump to #work lands short of it)
    if (location.hash === "#work") {
      toWork();
      addEventListener("load", () => requestAnimationFrame(toWork), { once: true });
    }
  }

  onResize();
  start();
  // let the greeting know the desk is ready to appear
  root.dataset.heroReady = "";
  document.dispatchEvent(new Event("hero:ready"));
})();
