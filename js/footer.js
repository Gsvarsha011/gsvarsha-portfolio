// The footer panel: the hero's own paper (same gradient, same moving grain,
// js/shaders.js), swept along where the cursor moves so the colours blend
// like paint, and you, meditating on a cushion (buildMeditator in
// js/scene.js). The character is still; hover, focus or tap it and its eyes
// open and a small note appears, with a link back to the About page. The
// paper draws only while the panel is on screen; the character only when
// something changes. Reduced motion: no swoosh. Without WebGL the panel keeps its CSS
// gradient and the character is simply left out.
import * as THREE from "three";
import { PAPER_GLSL } from "./shaders.js";
import { buildMeditator } from "./scene.js";

export function initFooter() {
  const panel = document.querySelector("[data-drop]");
  const paperCanvas = document.querySelector("[data-foot-paper]");
  const meCanvas = document.querySelector("[data-me]");
  const spot = document.querySelector("[data-me-spot]");
  const hit = document.querySelector("[data-me-hit]");
  if (!panel || !paperCanvas || !meCanvas || !spot) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  const paper = createSwooshPaper(paperCanvas);
  if (paper) panel.classList.add("has-paper");

  let renderer = null, scene, camera, me;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: meCanvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#FFF6EC", "#C8A385", 1.6));
    // warm light from the left, like sun through a window
    const sun = new THREE.DirectionalLight("#FFF0DF", 2.3);
    sun.position.set(-3.5, 10, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2, near: 1, far: 30 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#F5E6D6", 0.5);
    fill.position.set(6, 4, 4);
    scene.add(fill);

    me = buildMeditator();
    me.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    scene.add(me.group);
    // a soft shadow on the floor under the cushion
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.09 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.46;
    floor.receiveShadow = true;
    scene.add(floor);

    camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    camera.position.set(0.6, 3.6, 13);
    camera.lookAt(0, 1.05, 0.5);
  } catch (e) {
    renderer = null;
    spot.hidden = true;
  }

  function size() {
    if (paper) paper.resize(panel.offsetWidth, panel.offsetHeight);
    if (renderer) {
      const c = meCanvas;
      const w = c.offsetWidth, h = c.offsetHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      meDirty = true;
    }
    draw(performance.now() / 1000, true);
  }

  let peeking = false;
  let meDirty = true;
  // the swoosh: the cursor leaves a short trail; each point pushes the
  // colours along the way it was moving, then fades
  const TRAIL = 16;
  const trail = []; // { x, y, vx, vy, life }
  let lastT = 0;
  function draw(t, force) {
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    if (flick) flickStep(t * 1000);
    if (paper) {
      const u = paper.uniforms;
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].life -= dt / 1.1;
        if (trail[i].life <= 0) trail.splice(i, 1);
      }
      for (let i = 0; i < TRAIL; i++) {
        const p = trail[i];
        if (p) {
          u.uTrail.value[i].set(p.x, p.y, p.vx, p.vy);
          // ease in and out of its life, so nothing pops
          u.uLife.value[i] = Math.sin(Math.min(1, p.life) * Math.PI * 0.5) ** 2;
        } else u.uLife.value[i] = 0;
      }
      u.uTime.value = t;
      u.uGrainTick.value = Math.floor(t * 10) % 1000;
      paper.render(t, force || trail.length > 0);
    }
    if (renderer && meDirty) {
      me.setEyes(peeking);
      renderer.render(scene, camera);
      meDirty = false;
    }
  }

  let raf = 0, visible = false;
  function frame(now) {
    raf = 0;
    if (!visible) return;
    draw(now / 1000, false);
    if (!reduce.matches) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (raf || !visible) return;
    raf = requestAnimationFrame(frame);
  }

  let prev = null;
  panel.addEventListener("pointermove", (e) => {
    if (reduce.matches || e.pointerType === "touch") return;
    const r = panel.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    if (prev) {
      let vx = x - prev.x, vy = y - prev.y;
      const len = Math.hypot(vx, vy);
      if (len > 0.004) {
        const k = Math.min(1, 0.09 / len); // cap a very fast flick
        trail.push({ x, y, vx: vx * k, vy: vy * k, life: 1 });
        if (trail.length > TRAIL) trail.shift();
        prev = { x, y };
      }
    } else prev = { x, y };
  });
  panel.addEventListener("pointerleave", () => (prev = null));

  // on touch screens: a finger dragged across the panel leaves the same
  // swoosh, and a tap flicks a short one out from where you touched
  const at = (t) => {
    const r = panel.getBoundingClientRect();
    return { x: (t.clientX - r.left) / r.width, y: 1 - (t.clientY - r.top) / r.height };
  };
  let tPrev = null;
  let flick = null; // { x, y, dx, dy, t0 }
  panel.addEventListener("touchstart", (e) => {
    if (reduce.matches || e.touches.length !== 1) return;
    tPrev = at(e.touches[0]);
    // a little curve, up and across, away from the nearer edge
    const side = tPrev.x < 0.5 ? 1 : -1;
    flick = { x: tPrev.x, y: tPrev.y, dx: side * 0.075, dy: 0.065, t0: performance.now() };
    wake();
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (reduce.matches || !tPrev || e.touches.length !== 1) return;
    flick = null; // a drag, not a tap
    const p = at(e.touches[0]);
    const vx = p.x - tPrev.x, vy = p.y - tPrev.y;
    const len = Math.hypot(vx, vy);
    if (len > 0.006) {
      const k = Math.min(1, 0.09 / len);
      trail.push({ x: p.x, y: p.y, vx: vx * k, vy: vy * k, life: 1 });
      if (trail.length > TRAIL) trail.shift();
      tPrev = p;
    }
  }, { passive: true });
  panel.addEventListener("touchend", () => (tPrev = null), { passive: true });
  // the tap's swoosh: points laid along a short arc over a quarter second
  function flickStep(now) {
    if (!flick) return;
    const u = Math.min(1, (now - flick.t0) / 260);
    const n = Math.floor(u * 7);
    while ((flick.n || 0) < n) {
      const i = (flick.n = (flick.n || 0) + 1) / 7;
      const x = flick.x + flick.dx * 2.2 * i, y = flick.y + flick.dy * Math.sin(i * Math.PI * 0.8) * 1.6;
      trail.push({ x, y, vx: flick.dx * (1 - i * 0.4), vy: flick.dy * Math.cos(i * Math.PI * 0.8), life: 1 });
      if (trail.length > TRAIL) trail.shift();
    }
    if (u >= 1) flick = null;
  }

  // the note: open on hover, on focus, or with a tap/click on the character;
  // it stays open while the pointer is over the character or the note, so
  // the link can be reached; Esc closes it
  let closeTimer = 0;
  const say = (on) => {
    clearTimeout(closeTimer);
    if (on === peeking) return;
    peeking = on;
    meDirty = true;
    spot.classList.toggle("is-saying", on);
    hit.setAttribute("aria-expanded", String(on));
    draw(performance.now() / 1000, true);
  };
  const later = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => say(false), 260);
  };
  spot.addEventListener("pointerenter", (e) => e.pointerType !== "touch" && say(true));
  spot.addEventListener("pointerleave", (e) => e.pointerType !== "touch" && !spot.contains(document.activeElement) && later());
  // (a tap focuses the button first, which already opens the note, so the
  // click that follows must not close it again)
  let openedAt = 0;
  hit.addEventListener("click", () => {
    if (peeking && performance.now() - openedAt < 600) return;
    say(!peeking);
  });
  spot.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || peeking) return;
    say(true); // straight away, without waiting for the click
    openedAt = performance.now();
  });
  spot.addEventListener("focusin", () => {
    if (!peeking) openedAt = performance.now();
    say(true);
  });
  spot.addEventListener("focusout", (e) => { if (!spot.contains(e.relatedTarget)) later(); });
  spot.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && peeking) { say(false); hit.focus(); }
  });
  // a tap anywhere else closes it on touch screens
  document.addEventListener("pointerdown", (e) => {
    if (peeking && e.pointerType === "touch" && !spot.contains(e.target)) say(false);
  });

  new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible) {
      draw(performance.now() / 1000, true);
      wake();
    }
  }).observe(panel);
  document.addEventListener("visibilitychange", () => !document.hidden && wake());
  new ResizeObserver(size).observe(panel);
}

// The hero's paper, plus a swoosh: each trail point (uTrail: position and
// the way it was moving, in panel units; uLife: its strength) pulls the
// paper along its direction inside a soft streak, longer than it is wide,
// so the colours are dragged and blended like a brushstroke through wet
// paint; a breath of warmth gathers in the streak.
function createSwooshPaper(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(1);
  const uniforms = {
    uCss: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrainTick: { value: 0 },
    uFlow: { value: 0 },
    uTrail: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    uLife: { value: new Array(16).fill(0) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${PAPER_GLSL}
      uniform vec4 uTrail[16];
      uniform float uLife[16];
      void main() {
        vec2 uv = gl_FragCoord.xy / uCss;
        vec2 asp = vec2(uCss.x / uCss.y, 1.0);
        vec2 pull = vec2(0.0);
        float mixed = 0.0;
        for (int i = 0; i < 16; i++) {
          float life = uLife[i];
          if (life <= 0.0) continue;
          vec2 d = (uv - uTrail[i].xy) * asp;
          vec2 v = uTrail[i].zw * asp;
          float vl = length(v) + 1e-4;
          vec2 dir = v / vl;
          float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
          // a streak: long behind the point, short ahead, narrow across
          float len = 0.05 + vl * 1.8;
          float a2 = along < 0.0 ? along * along / (len * len) : along * along / 0.0016;
          float w = exp(-a2 - across * across / 0.0045) * life;
          pull += uTrail[i].zw * w * 2.6;
          mixed += w;
        }
        vec3 col = paperField(uv - pull);
        col = mix(col, mix(SAND, TERRA, 0.4), min(mixed, 1.0) * 0.12);
        gl_FragColor = vec4(col + paperGrain(uv) * 0.05, 1.0);
      }
    `,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();
  let last = -1;
  return {
    uniforms,
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uCss.value.set(w, h);
      last = -1;
    },
    render(time, force = false) {
      if (!force && last >= 0 && time - last < 1 / 30) return;
      last = time;
      renderer.render(scene, camera);
    },
  };
}
