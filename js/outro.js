/* The close: the footer.
 *
 * The footer panel arrives as liquid (carried over from the v5 footer): as
 * you scroll in, a drop falls in from the top, swells, then spreads into the
 * rounded panel with a wobble that settles. The outline is sampled as 160
 * points (drop and box share the same order, from the top centre) and joined
 * into a smooth clip-path. It moves only with scrolling.
 *
 * Inside, the hero's paper and the meditating character are drawn by
 * js/footer.js (part of the bundle).
 */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const foot = document.querySelector("[data-foot]");
  if (!foot) return;
  const panel = foot.querySelector("[data-drop]");

  /* ---------- links: put the real addresses here ---------- */

  const LINKS = {
    email: "gsvarsha11@gmail.com",
    linkedin: "https://www.linkedin.com/in/gsvarsha/",
    // the header's Resume link already has the right path from this page
    // (and, in the one-file share copy, the PDF itself)
    resume: document.querySelector("[data-resume]")?.getAttribute("href") || "",
  };
  // the address as plain text, for anyone without a mail app
  document.querySelectorAll("[data-email-plain]").forEach((el) => (el.textContent = LINKS.email));
  // the footer's links, and the phone menu's
  document.querySelectorAll("[data-link]").forEach((a) => {
    const kind = a.dataset.link;
    const value = LINKS[kind];
    if (value) {
      if (kind === "email") {
        const subject = a.dataset.subject;
        a.href = `mailto:${value}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
        a.setAttribute("aria-label", `Email me at ${value}`);
        const t = a.querySelector("[data-email-text]");
        if (t) t.textContent = value;
      } else {
        a.href = value;
        a.target = "_blank";
        a.rel = "noopener";
        const file = kind === "resume" && document.querySelector("[data-resume]")?.getAttribute("download");
        if (file) a.download = file;
      }
    } else {
      // not there yet: a quiet placeholder, with a small "Soon" on hover
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("role", "link");
      a.setAttribute("tabindex", "0");
      a.dataset.soon = "Soon";
      a.setAttribute("aria-label", `${a.getAttribute("aria-label") || kind} (coming soon)`);
    }
  });

  /* ---------- the drop (from v5) ---------- */

  (function initDrop() {
    const N = 160;
    let W = 0, H = 0, R = 24, q = 0, target = 0, raf = 0, forced = false;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (t, a, b) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // the rounded box, sampled evenly along its edge from the top centre, clockwise
    function boxPoints() {
      const r = Math.min(R, W / 2, H / 2), arc = (Math.PI * r) / 2;
      const segs = [
        ["line", W / 2, 0, W - r, 0], ["arc", W - r, r, -Math.PI / 2, 0],
        ["line", W, r, W, H - r], ["arc", W - r, H - r, 0, Math.PI / 2],
        ["line", W - r, H, r, H], ["arc", r, H - r, Math.PI / 2, Math.PI],
        ["line", 0, H - r, 0, r], ["arc", r, r, Math.PI, Math.PI * 1.5],
        ["line", r, 0, W / 2, 0],
      ];
      const lens = segs.map((sg) => (sg[0] === "line" ? Math.hypot(sg[3] - sg[1], sg[4] - sg[2]) : arc));
      const total = lens.reduce((a, b) => a + b, 0);
      const pts = [];
      for (let k = 0; k < N; k++) {
        let d = (k / N) * total, j = 0;
        while (d > lens[j] && j < segs.length - 1) { d -= lens[j]; j++; }
        const sg = segs[j], u = lens[j] ? d / lens[j] : 0;
        if (sg[0] === "line") pts.push([lerp(sg[1], sg[3], u), lerp(sg[2], sg[4], u)]);
        else { const a = lerp(sg[3], sg[4], u); pts.push([sg[1] + r * Math.cos(a), sg[2] + r * Math.sin(a)]); }
      }
      return pts;
    }
    // a falling drop: a rounded body with a pointed top, clockwise from the top
    function dropPoints(cx, cy, rad, stretch) {
      const pts = [];
      for (let k = 0; k < N; k++) {
        const a = -Math.PI / 2 + (k / N) * Math.PI * 2;
        const up = Math.max(0, -Math.sin(a));
        pts.push([
          cx + rad * Math.cos(a) * (1 - 0.55 * Math.pow(up, 1.6)),
          cy + rad * Math.sin(a) * (1 + stretch * Math.pow(up, 2.2)),
        ]);
      }
      return pts;
    }
    // where the falling drop sits at phase progress u (0..1)
    function fallAt(u, minS) {
      const rad = lerp(minS * 0.05, minS * 0.3, u), st = lerp(1.5, 0.45, u);
      const cy = Math.max(lerp(minS * 0.12, H * 0.44, u), rad * (1 + st) + 6);
      return { rad, st, cy };
    }
    const FALL = 0.42;
    function shape(t) {
      const box = boxPoints();
      const minS = Math.min(W, H);
      let pts;
      if (t < FALL) {
        // the drop falls into the panel and swells, its tail drawing in
        const f = fallAt(easeInOut(t / FALL), minS);
        pts = dropPoints(W / 2, f.cy, f.rad, f.st);
      } else {
        // …then spreads into the box. It starts exactly where the fall
        // ended, and wobbles like a liquid settling, less and less
        const raw = (t - FALL) / (1 - FALL);
        const u = 1 - Math.pow(1 - raw, 3); // fast out, slow to settle
        const f = fallAt(1, minS);
        const from = dropPoints(W / 2, f.cy, f.rad, f.st);
        const wob = Math.sin(raw * Math.PI * 2.5) * Math.pow(1 - raw, 1.6) * Math.min(22, minS * 0.05);
        pts = from.map((p, k) => {
          const b = box[k];
          const x = lerp(p[0], b[0], u), y = lerp(p[1], b[1], u);
          const dx = x - W / 2, dy = y - H / 2, len = Math.hypot(dx, dy) || 1;
          const w = wob * Math.sin((k / N) * Math.PI * 2 * 3 + raw * 4);
          return [x + (dx / len) * w, y + (dy / len) * w];
        });
      }
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < N; i++) {
        const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
        d += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d + " Z";
    }
    let range = 400;
    function measure() {
      W = panel.offsetWidth;
      H = panel.offsetHeight;
      R = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 24;
      // use all the scrolling the panel has: it starts as it enters and settles at the very bottom
      const docTop = panel.getBoundingClientRect().top + scrollY;
      const endTop = docTop - Math.max(0, document.documentElement.scrollHeight - innerHeight);
      range = Math.max(160, (innerHeight - endTop) * 0.96);
    }
    function progress() {
      if (reduce.matches || forced) return 1;
      const r = panel.getBoundingClientRect();
      return clamp((innerHeight - r.top) / range, 0, 1);
    }
    function draw() {
      if (q >= 0.999) panel.style.clipPath = ""; // settled: the real rounded box
      else if (q <= 0.001) panel.style.clipPath = "circle(0px at 50% 0%)";
      else panel.style.clipPath = `path('${shape(q)}')`;
      panel.style.setProperty("--fo", smooth(q, 0.72, 0.98).toFixed(3));
    }
    // a critically damped spring after the scroll: smooth at any frame rate,
    // no overshoot, and it catches up with a fast scroll without jumping
    let vel = 0, lastT = 0;
    function tick(now) {
      const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); // never negative, even after a long sleep
      lastT = now;
      const K = 42, D = 2 * Math.sqrt(K);
      vel += ((target - q) * K - vel * D) * dt;
      q = clamp(q + vel * dt, 0, 1);
      if (Math.abs(target - q) < 0.0006 && Math.abs(vel) < 0.002) { q = target; vel = 0; }
      draw();
      raf = q !== target ? requestAnimationFrame(tick) : 0;
    }
    function update() {
      target = progress();
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    measure();
    q = target = progress();
    draw();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", () => { measure(); q = target = progress(); draw(); });
    reduce.addEventListener("change", update);
    // keyboard users get the whole panel at once
    panel.addEventListener("focusin", () => { forced = true; update(); });
    panel.addEventListener("focusout", (e) => { if (!panel.contains(e.relatedTarget)) { forced = false; update(); } });
    new ResizeObserver(() => { measure(); draw(); }).observe(panel);
    new ResizeObserver(() => { measure(); update(); }).observe(document.body); // page height moves the end point
  })();

  // the racket: a tap on touch screens plays the swing once
  const sig = foot.querySelector(".sig");
  if (sig) {
    sig.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      sig.classList.remove("is-playing");
      void sig.offsetWidth;
      sig.classList.add("is-playing");
    });
    sig.addEventListener("animationend", () => sig.classList.remove("is-playing"));
  }
})();
