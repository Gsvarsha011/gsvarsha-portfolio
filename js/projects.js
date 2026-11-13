/* Projects: a gallery that travels through a curved field of focus,
 * driven by the page's own scroll.
 *
 * On roomy screens the section is tall and its stage sticks inside it;
 * scroll progress through it becomes a position p along the row (0 = the
 * first project in focus, n - 1 = the last). It never stops between
 * projects, it only slows as each one comes into focus.
 * Every card then works out its own look from u, its distance to the focal
 * point (u = its index - p), through one function (optical):
 *   x  = centre + u * spacing             (the row slides sideways)
 *   y  = centre + curve * u^2             (a gentle bowl: lower to the sides)
 *   f  = 1 - smoothstep(0, 1.15, |u|)     (focus: 1 in the middle)
 *   scale, blur, opacity and tilt all follow f and u
 * So the blur belongs to each card as it moves, not to a side of the
 * screen. Pure function of scroll: it reverses and catches up exactly.
 * Phones and short screens: the same row, centred on the screen; the page's
 * scroll slides it (the section sticks while it does) and a sideways swipe
 * moves it too. Reduced motion: a plain swipe row.
 */
(() => {
  const root = document.documentElement;
  const section = document.querySelector("[data-work]");
  if (!section) return;
  const stage = section.querySelector(".work__stage");
  const cards = [...section.querySelectorAll("[data-card]")];
  const abouts = [...section.querySelectorAll("[data-about]")];
  const gotos = [...section.querySelectorAll("[data-goto]")];
  const counter = section.querySelector("[data-work-index]");
  const steps = [...section.querySelectorAll("[data-step]")];
  const n = cards.length;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Case studies: put each page's path here once it's built (e.g.
  // "work/craft.html"). Until then the cards don't link anywhere.
  const CASES = {
    spacture: "work/spacture-ai.html",
    spatiallite: "work/spatiallite.html",
    craft: "work/craft.html",
    flex: "work/flex-academy.html",
  };
  section.querySelectorAll("[data-case]").forEach((a) => {
    const url = CASES[a.dataset.case];
    if (url) a.href = url;
  });
  // Spatial Key has no case study: its card opens a small card over the
  // projects with two ways to ask, and closing it leaves you where you were.
  // (Without the script its link still goes to Contact.)
  const keycard = document.querySelector("[data-keycard]");
  if (keycard) {
    section.querySelectorAll("[data-locked]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        keycard.showModal();
        keycard.focus(); // the card, not its close button
      })
    );
    keycard.querySelector("[data-keycard-close]").addEventListener("click", () => keycard.close());
    keycard.addEventListener("click", (e) => {
      if (e.target === keycard) keycard.close(); // the backdrop
    });
  }
  const roomy = matchMedia("(min-width: 900px) and (min-height: 620px)");

  // Opened straight from disk (file://), WebGL may not read the cards'
  // pictures. Then the lens waits for js/work-images.js (the same pictures
  // as data URIs, written by tools/make-work-images.py), swaps them in and
  // switches on; until then (or if it's missing) the cards bend in CSS.
  const shots = cards.map((li) => li.querySelector(".card3__body img")).filter(Boolean);
  // (once js/work-images.js has loaded, the lens runs even if a picture
  // isn't in it, e.g. a card's picture was renamed: that card then shows
  // its own picture, flat, over the bent panel, rather than every card
  // going flat)
  let diskLoaded = false;
  const picturesReadable = () => location.protocol !== "file:" || diskLoaded || shots.every((img) => img.src.startsWith("data:"));
  const here_ = document.currentScript && document.currentScript.src;
  function loadDiskPictures() {
    if (picturesReadable() || !here_) return;
    // not during the loader and the desk's build-in: decoding the pictures
    // takes a moment, so it waits until that is over and the page is idle
    // (watching the class itself, so it works whatever the loader is, and
    // even if it never says it's done: the <head> script's safety net
    // removes .greet too)
    if (root.classList.contains("greet")) {
      const mo = new MutationObserver(() => {
        if (root.classList.contains("greet")) return;
        mo.disconnect();
        setTimeout(loadDiskPictures, 1200);
      });
      mo.observe(root, { attributes: true, attributeFilter: ["class"] });
      return;
    }
    if ("requestIdleCallback" in window && !loadDiskPictures.idle) {
      loadDiskPictures.idle = true;
      requestIdleCallback(loadDiskPictures, { timeout: 1500 });
      return;
    }
    const tag = document.createElement("script");
    tag.src = here_.replace(/projects\.js(\?.*)?$/, "work-images.js");
    tag.onload = () => {
      const map = window.WORK_IMAGES || {};
      shots.forEach((img) => {
        const d = map[img.getAttribute("src")];
        if (d) img.src = d;
        else {
          img.closest(".card3__shot")?.classList.add("is-own");
          console.info(`Lens: ${img.getAttribute("src")} isn't in js/work-images.js yet; run python3 tools/make-work-images.py`);
        }
      });
      diskLoaded = true;
      setMode();
    };
    document.head.appendChild(tag);
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // between projects the row slows into each one but never stops: a cosine
  // ease, mixed with a little straight-line travel
  const glide = (t) => lerp(t, 0.5 - 0.5 * Math.cos(Math.PI * t), 0.7);

  let live = false;
  let W = 1, H = 1, CW = 640, BODY = 400, CY = 400, GAP = 60;
  let lens = null, lensOn = false;
  // phones: the same lens over the swipe row, driven by its sideways scroll.
  // ROWY: where the panels' centres sit on the canvas (null on roomy screens)
  let rowLens = false, ROWY = null;
  let current = -1;

  // the first and last steps: the same speed as glide where they meet the
  // middle steps (slope 0.3), but easing all the way to rest at the ends of
  // the row (slope 0), so the travel doesn't start or stop with a jolt
  const SLOPE = 0.3;
  const easeIn = (t) => 3 * t * t - 2 * t * t * t + SLOPE * (t * t * t - t * t); // Hermite: 0 -> 1, slope 0 -> 0.3
  // the row position for a raw progress r (0..n-1)
  const rowAt = (r) => {
    if (r <= 0) return 0;
    const i = Math.floor(r);
    if (i >= n - 1) return n - 1;
    const t = r - i;
    if (n > 2 && i === 0) return easeIn(t);
    if (n > 2 && i === n - 2) return i + 1 - easeIn(1 - t);
    return i + glide(t);
  };

  // the optical field: a card's look at distance u from the focal point
  const LENS = {
    gap: 0.94, // centre to centre, as a share of the card's width
    curve: 0.075, // how far the bowl drops, as a share of the screen's height, at u = 1
    minScale: 0.74,
    maxBlur: 4.5, // px
    minOpacity: 0.62,
    tilt: 2.2, // deg per card of distance, along the curve
  };
  function optical(u) {
    const a = Math.abs(u);
    const f = 1 - smoothstep(0, 1.15, a);
    // with the lens (WebGL) the cards are drawn on the canvas, bent by where
    // they are on screen; the page's own cards only sit flat over them, for
    // links, focus and the header line
    if (lensOn) return { x: W / 2 + u * (CW + GAP), y: CY, s: 1, rz: 0, blur: 0, o: 1, f };
    return {
      x: W / 2 + u * CW * LENS.gap,
      y: CY + (LENS.curve * H * u * u) / (1 + 0.15 * u * u),
      s: LENS.minScale + (1 - LENS.minScale) * f,
      // tilt and the extra blur far out level off smoothly (no clamps)
      rz: 4 * Math.tanh((u * LENS.tilt) / 4),
      blur: LENS.maxBlur * Math.pow(1 - f, 1.3) + 2 * smoothstep(1.2, 2.2, a),
      o: (LENS.minOpacity + (1 - LENS.minOpacity) * f) * (1 - smoothstep(1.35, 2.05, a)),
      f,
    };
  }

  /* ---------- the lens: the cards on a curved field, in WebGL ----------
     One canvas behind the cards. Each card is a strip of 64 columns; the
     vertex shader stretches each column vertically by where it is on the
     screen (warp): flat through the middle, taller towards the edges, as if
     the row ran round the inside of a curve. The fragment shader blurs and
     fades by the same screen position, so a card sharpens as it reaches the
     middle and softens as it leaves. Each card's picture is its panel,
     painted once into a texture (paintPanel) and redrawn on resize. */
  function createLens() {
    const canvas = document.createElement("canvas");
    canvas.className = "work__lens";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!gl) return null;
    const VS = `#version 300 es
      in vec2 aPos;
      uniform vec2 uView;
      uniform vec4 uCard; // centre x, centre y, width, height (px, flat)
      uniform float uFlat, uWarp;
      out vec2 vUv;
      out float vD;
      void main() {
        vec2 p = vec2(uCard.x + (aPos.x - 0.5) * uCard.z, uCard.y + (aPos.y - 0.5) * uCard.w);
        float half_ = uView.x * 0.5;
        float side = sign(p.x - half_);
        float d = abs(p.x - half_) / half_;
        // past the flat middle, the row turns away round a curve: what's
        // further out is squeezed closer together (smoothly, from a slope
        // of 1), so more of the next card shows, foreshortened
        // The squeeze is eased in over a short window (w), so not only the
        // slope but the bend itself starts from nothing: no visible crease
        // where the flat middle ends.
        float t = max(0.0, d - uFlat) / (1.0 - uFlat);
        float k = 0.55, w = 0.35;
        float lost = (t - (1.0 - exp(-k * t)) / k) * smoothstep(0.0, w, t);
        float dd = d - (1.0 - uFlat) * lost;
        p.x = half_ + side * dd * half_;
        // and it stretches taller as it turns: eased in, and easing out
        // towards a ceiling it never passes, so whatever lies past the
        // edge of the screen doesn't flare (smooth everywhere, no kink)
        float s = max(0.0, dd - uFlat) / (1.0 - uFlat);
        p.y = uCard.y + (p.y - uCard.y) * (1.0 + uWarp * (1.0 - exp(-1.5 * s * s)) / (1.0 - exp(-1.5)));
        vUv = aPos;
        vD = dd;
        gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
      }`;
    const FS = `#version 300 es
      precision highp float;
      in vec2 vUv;
      in float vD;
      uniform sampler2D uTex;
      uniform vec2 uSize;     // the card, css px
      uniform float uDpr, uRadius, uMaxBlur, uBlurFrom, uFadeFrom;
      out vec4 outColor;
      void main() {
        float b = uMaxBlur * smoothstep(uBlurFrom, 0.98, vD); // blur, css px
        // sharp and blurred, always both, blended by b: no seam where the
        // blur begins
        vec4 sharp = texture(uTex, vUv);
        float lod = log2(1.0 + b * uDpr * 0.6);
        vec2 r = vec2(b) / uSize;
        vec4 blurred = textureLod(uTex, vUv, lod) * 2.0;
        for (int i = 0; i < 12; i++) {
          float a = 6.2831853 * (float(i) + 0.5) / 12.0;
          float k = (i % 2 == 0) ? 1.0 : 0.55;
          blurred += textureLod(uTex, vUv + vec2(cos(a), sin(a)) * r * k, lod);
        }
        blurred /= 14.0;
        vec4 c = mix(sharp, blurred, smoothstep(0.0, 1.2, b));
        // the card's rounded edge, softer as it blurs
        vec2 px = vUv * uSize;
        vec2 q = abs(px - uSize * 0.5) - (uSize * 0.5 - uRadius);
        float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
        float soft = max(0.6, b * 0.9);
        float mask = 1.0 - smoothstep(-soft, soft, sd);
        float fade = smoothstep(uFadeFrom, 1.0, vD) * 0.35;
        float a = mask * (1.0 - fade);
        outColor = vec4(c.rgb * a, a);
      }`;
    const sh = (type, src) => {
      const x = gl.createShader(type);
      gl.shaderSource(x, src);
      gl.compileShader(x);
      if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x));
      return x;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn("Project lens unavailable, using the flat gallery.", e);
      return null;
    }
    gl.useProgram(prog);
    // a strip of 64 columns, top and bottom
    const COLS = 96;
    const verts = new Float32Array((COLS + 1) * 4);
    for (let i = 0; i <= COLS; i++) verts.set([i / COLS, 0, i / COLS, 1], i * 4);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const k of ["uView", "uCard", "uFlat", "uWarp", "uTex", "uSize", "uDpr", "uRadius", "uMaxBlur", "uBlurFrom", "uFadeFrom"]) U[k] = gl.getUniformLocation(prog, k);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const tex = cards.map(() => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    const paper = document.createElement("canvas");
    let dpr = 1, lastP = 0;

    // each card's panel, painted at its on-screen size
    function paintTextures() {
      cards.forEach((li, j) => {
        const body = li.querySelector(".card3__body");
        const w = body.offsetWidth, h = body.offsetHeight;
        if (!w || !h) return;
        paper.width = Math.round(w * dpr);
        paper.height = Math.round(h * dpr);
        const ctx = paper.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        paintPanel(ctx, body, w, h);
        gl.bindTexture(gl.TEXTURE_2D, tex[j]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paper);
        gl.generateMipmap(gl.TEXTURE_2D);
      });
    }

    function draw(p) {
      lastP = p;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const step = CW + GAP;
      const flat = Math.min(0.9, (CW / 2 + GAP * 0.5) / (W / 2));
      gl.uniform2f(U.uView, W, H);
      gl.uniform1f(U.uFlat, flat);
      gl.uniform1f(U.uWarp, 0.3);
      gl.uniform1f(U.uDpr, dpr);
      gl.uniform1f(U.uRadius, 14);
      gl.uniform1f(U.uMaxBlur, 4);
      gl.uniform1f(U.uBlurFrom, Math.min(0.9, flat + (1 - flat) * 0.45));
      gl.uniform1f(U.uFadeFrom, Math.min(0.95, flat + (1 - flat) * 0.6));
      gl.uniform2f(U.uSize, CW, BODY);
      gl.uniform1i(U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      // the panel's centre: the card's centre, below its header line
      cards.forEach((li, j) => {
        const x = W / 2 + (j - p) * step;
        if (Math.abs(x - W / 2) > W * 2.2) return;
        const body = li.querySelector(".card3__body");
        const y = ROWY !== null ? ROWY : CY - li.offsetHeight / 2 + body.offsetTop + BODY / 2;
        gl.bindTexture(gl.TEXTURE_2D, tex[j]);
        gl.uniform4f(U.uCard, x, y, CW, BODY);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (COLS + 1) * 2);
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      paintTextures();
      draw(lastP);
    }

    stage.insertBefore(canvas, stage.querySelector(".work__cards"));
    // pictures (and fonts) that arrive later: paint them in
    const repaint = () => { if (lensOn || rowLens) { paintTextures(); draw(lastP); } };
    section.querySelectorAll(".card3__body img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", repaint, { once: true });
    });
    if (document.fonts) document.fonts.ready.then(repaint);
    return { canvas, draw, resize };
  }

  function setCurrent(i) {
    if (i === current) return;
    current = i;
    if (counter) counter.textContent = String(i + 1).padStart(2, "0");
    cards.forEach((c, j) => {
      c.toggleAttribute("data-current", j === i);
      c.inert = j !== i;
    });
    abouts.forEach((a, j) => {
      a.toggleAttribute("data-current", j === i);
      a.setAttribute("aria-hidden", String(j !== i));
    });
    gotos.forEach((g, j) => (j === i ? g.setAttribute("aria-current", "true") : g.removeAttribute("aria-current")));
    steps.forEach((b) => { b.disabled = (b.dataset.step === "-1" && i <= 0) || (b.dataset.step === "1" && i >= n - 1); });
  }

  // the card in focus fills the room between the heading and the notes
  // (with a margin), no wider than half the screen
  const topEl = section.querySelector(".work__top");
  const sideEl = section.querySelector(".work__side");
  function measure() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    const above = topEl.offsetTop + topEl.offsetHeight;
    const below = sideEl ? sideEl.offsetTop : H - Math.max(36, H * 0.06);
    const head = 38; // the card's header line
    const room = Math.max(160, below - above - head - Math.max(48, H * 0.075));
    BODY = Math.min(room, (W * 0.5) / 1.6, H * 0.46);
    CW = BODY * 1.6;
    CY = (above + below) / 2;
    GAP = Math.max(36, CW * 0.1);
    section.style.setProperty("--card-w", `${CW.toFixed(1)}px`);
    if (lensOn) lens.resize();
  }

  // After the hero hands over, the first project rests a little longer
  // before the row starts to move.
  const lead = () => (root.classList.contains("motion") ? innerHeight * 0.3 : 0);
  function progress() {
    const r = section.getBoundingClientRect();
    const L = lead();
    const total = r.height - innerHeight - L;
    return total > 0 ? clamp01((-r.top - L) / total) * (n - 1) : 0;
  }

  function place(p = rowAt(progress())) {
    cards.forEach((c, j) => {
      const o = optical(j - p);
      const st = c.style;
      st.setProperty("--x", `${o.x.toFixed(1)}px`);
      st.setProperty("--y", `${o.y.toFixed(1)}px`);
      st.setProperty("--s", o.s.toFixed(4));
      st.setProperty("--rz", o.rz.toFixed(3));
      st.setProperty("--blur", o.blur.toFixed(2));
      st.setProperty("--o", o.o.toFixed(3));
      st.setProperty("--f", o.f.toFixed(3));
      st.setProperty("--z", String(100 - Math.round(Math.abs(j - p) * 10)));
    });
    if (lensOn) lens.draw(p);
    setCurrent(Math.round(p));
  }

  // the row glides after the scroll rather than jumping with each wheel
  // step: it eases toward where the scroll says it should be
  let queued = false;
  let shown = null;
  let lastT = 0;
  function tick(now) {
    queued = false;
    const target = rowAt(progress());
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    if (shown === null) shown = target;
    else shown += (target - shown) * (1 - Math.exp(-dt * 6.5));
    if (Math.abs(target - shown) < 0.0004) shown = target;
    place(shown);
    if (shown !== target) {
      queued = true;
      requestAnimationFrame(tick);
    }
  }
  const schedule = () => {
    if (!live || queued) return;
    queued = true;
    lastT = performance.now();
    requestAnimationFrame(tick);
  };

  // the swipe row: the notes, the count and the dots follow the card you are on
  const row = section.querySelector(".work__cards");
  const dots = document.createElement("div");
  dots.className = "work__dots";
  dots.setAttribute("aria-hidden", "true");
  dots.append(...cards.map(() => document.createElement("i")));
  row.after(dots);
  const onRow = () => {
    if (live) return;
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1;
    const i = Math.max(0, Math.min(n - 1, Math.round(row.scrollLeft / step)));
    if (i === current) return;
    current = i;
    if (counter) counter.textContent = String(i + 1).padStart(2, "0");
    abouts.forEach((a, j) => a.toggleAttribute("data-current", j === i));
    [...dots.children].forEach((d, j) => d.toggleAttribute("data-on", j === i));
  };
  row.addEventListener("scroll", onRow, { passive: true });

  // the lens on the swipe row: the canvas covers the row (plus room above
  // and below for the stretch at the sides) and the row's own scroll says
  // where the focal point is, so a swipe bends the cards exactly as the
  // page's scroll does on roomy screens
  let rowStep = 1, rowPad = 0;
  function measureRow() {
    const body = cards[0].querySelector(".card3__body");
    CW = body.offsetWidth;
    BODY = body.offsetHeight;
    rowStep = n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : CW;
    GAP = rowStep - CW;
    W = row.clientWidth;
    rowPad = Math.round(BODY * 0.25);
    H = row.offsetHeight + rowPad * 2;
    const c = lens.canvas.style;
    c.top = `${row.offsetTop - rowPad}px`;
    c.left = `${row.offsetLeft}px`;
    c.width = `${W}px`;
    c.height = `${H}px`;
    lens.resize();
  }
  function rowP() {
    const rr = row.getBoundingClientRect();
    const b = cards[0].querySelector(".card3__body").getBoundingClientRect();
    ROWY = b.top - rr.top + rowPad + BODY / 2;
    return (W / 2 - (b.left - rr.left + CW / 2)) / rowStep;
  }
  let rowQueued = false;
  function drawRow() {
    rowQueued = false;
    if (!rowLens) return;
    const p = rowP();
    cards.forEach((c, j) => c.style.setProperty("--f", (1 - smoothstep(0, 0.6, Math.abs(j - p))).toFixed(3)));
    lens.draw(p);
  }
  const onRowLens = () => {
    if (!rowLens || rowQueued) return;
    rowQueued = true;
    requestAnimationFrame(drawRow);
  };
  row.addEventListener("scroll", onRowLens, { passive: true });

  // phones (with motion): the page's own scroll moves the row as well. The
  // section is tall and its stage sticks (.work-rowdrive, css/projects.css);
  // the scroll through it becomes the row's position, eased as on roomy
  // screens (rowAt), so it rests on each project. A sideways swipe still
  // moves the row and the page's scroll follows it, so the two always agree;
  // when the swipe settles, the page glides to the nearest project.
  let drive = false, touching = false, swiping = false, settleTimer = 0;
  const stepNow = () => (n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1);
  // the block that sticks (heading to dots) and the screen's small height
  // (100svh, as the CSS uses it), measured
  let stageH = 0;
  const svh = document.createElement("div");
  svh.style.cssText = "position:absolute;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none";
  section.append(svh);
  function measureStage() {
    if (!drive) { section.style.removeProperty("--stage-h"); return; }
    const cs = getComputedStyle(stage);
    const span = dots.getBoundingClientRect().bottom - topEl.getBoundingClientRect().top;
    const h = Math.ceil(span + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
    if (h === stageH) return;
    stageH = h;
    section.style.setProperty("--stage-h", `${stageH}px`);
    changed(); // the laptop's picture of this view, painted again
  }
  new ResizeObserver(() => { measureStage(); driveRow(); }).observe(topEl);
  // the ride: from the section reaching the top (where the hero lets go)
  // until the section's end meets the block's foot
  const driveTotal = () => section.offsetHeight - (svh.offsetHeight + stageH) / 2;
  function driveFrac() {
    const total = driveTotal();
    return total > 0 ? clamp01(-section.getBoundingClientRect().top / total) : 0;
  }
  // rowAt only ever rises, so it can be turned back by halving
  function fracFor(p) {
    let lo = 0, hi = n - 1;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (rowAt(mid) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2 / (n - 1);
  }
  const scrollForFrac = (f) => section.getBoundingClientRect().top + scrollY + f * driveTotal();
  function driveRow() {
    if (!drive || swiping) return;
    const left = rowAt(driveFrac() * (n - 1)) * stepNow();
    if (Math.abs(row.scrollLeft - left) < 0.5) return;
    row.scrollLeft = left;
    // the dots and the lens now, not on the row's own (later) scroll event
    onRow();
    onRowLens();
  }
  addEventListener("scroll", driveRow, { passive: true });
  function settle() {
    if (touching) return;
    swiping = false;
    const i = Math.max(0, Math.min(n - 1, Math.round(row.scrollLeft / stepNow())));
    scrollTo({ top: scrollForFrac(fracFor(i)), behavior: reduce.matches ? "auto" : "smooth" });
  }
  row.addEventListener("touchstart", () => {
    if (!drive) return;
    touching = swiping = true;
    clearTimeout(settleTimer);
  }, { passive: true });
  const lift = () => {
    if (!touching) return;
    touching = false;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 160);
  };
  row.addEventListener("touchend", lift, { passive: true });
  row.addEventListener("touchcancel", lift, { passive: true });
  row.addEventListener("scroll", () => {
    if (!drive || !swiping) return;
    const y = scrollForFrac(fracFor(row.scrollLeft / stepNow()));
    if (Math.abs(scrollY - y) >= 0.5) scrollTo({ top: y, behavior: "instant" });
    if (!touching) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 160);
    }
  }, { passive: true });

  function setMode() {
    live = !reduce.matches && roomy.matches;
    root.classList.toggle("work-live", live);
    root.classList.toggle("work-row", !live);
    cards.forEach((c) => {
      for (const k of ["--x", "--y", "--s", "--rz", "--blur", "--o", "--f", "--z"]) c.style.removeProperty(k);
      c.removeAttribute("data-current");
      c.inert = false;
    });
    abouts.forEach((a) => {
      a.removeAttribute("data-current");
      a.removeAttribute("aria-hidden");
    });
    current = -1;
    // the lens: only where WebGL 2 works and the pictures can be read (not
    // from a file:// page); otherwise the cards bend in CSS instead
    if (!reduce.matches && !lens && picturesReadable()) lens = createLens();
    lensOn = live && !!lens;
    rowLens = !live && !reduce.matches && !!lens;
    ROWY = null;
    if (lens) for (const k of ["top", "left", "width", "height"]) lens.canvas.style.removeProperty(k);
    root.classList.toggle("work-lens", lensOn || rowLens);
    root.classList.toggle("work-rowlens", rowLens);
    drive = !live && !reduce.matches && root.classList.contains("motion");
    root.classList.toggle("work-rowdrive", drive);
    section.style.setProperty("--n", String(n));
    measureStage();
    if (rowLens) {
      measureRow();
      drawRow();
    }
    if (live) {
      measure();
      shown = rowAt(progress());
      place(shown);
    } else onRow();
    driveRow();
    changed();
  }

  // the index and the arrows: go to a project (scroll to where it's in
  // focus; on the swipe row, slide to it)
  function goTo(i) {
    i = Math.max(0, Math.min(n - 1, i));
    const behavior = reduce.matches ? "auto" : "smooth";
    if (drive) {
      scrollTo({ top: scrollForFrac(fracFor(i)), behavior });
      return;
    }
    if (!live) {
      row.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior });
      return;
    }
    const top = section.getBoundingClientRect().top + scrollY;
    const L = lead();
    const total = section.offsetHeight - innerHeight - L;
    scrollTo({ top: top + L + (i / (n - 1)) * total, behavior });
  }
  const onGoto = (e) => goTo(Number(e.currentTarget.dataset.goto));
  gotos.forEach((g) => g.addEventListener("click", onGoto));
  // where the row is right now, from the scroll itself (not the last frame)
  const here = () => (live ? Math.round(rowAt(progress())) : Math.max(0, current));
  const onStep = (e) => goTo(here() + Number(e.currentTarget.dataset.step));
  steps.forEach((b) => b.addEventListener("click", onStep));
  // with the keyboard on the gallery, ← → move between projects
  section.addEventListener("keydown", (e) => {
    if (!live || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    if (e.target.closest("input, textarea")) return;
    e.preventDefault();
    goTo(here() + (e.key === "ArrowRight" ? 1 : -1));
  });

  // A sideways swipe on a trackpad (or a sideways wheel) moves the row too:
  // it becomes the page scroll that would move the row as far, so the row
  // follows the fingers and glides to rest just as it does for an up-down
  // scroll. Only while the gallery fills the screen. There it never reaches
  // the browser, so a fast swipe that runs past the first or last project
  // can't turn into the two-finger swipe for Back or Forward; everywhere
  // else on the page that swipe works as usual.
  const onWheel = (e) => {
    if (!live || e.ctrlKey) return; // ctrl: a pinch to zoom
    const dx = e.deltaX, dy = e.deltaY;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    const r = section.getBoundingClientRect();
    if (r.top > 1 || r.bottom < innerHeight - 1) return; // not pinned
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerWidth : 1;
    const L = lead();
    const total = section.offsetHeight - innerHeight - L;
    // one project's worth of scroll for one card's step on screen
    const k = total / (n - 1) / (CW + GAP);
    const top = r.top + scrollY;
    const from = top + L, to = top + L + total;
    const y = scrollY;
    const want = y + dx * unit * k;
    // stay among the projects (in the first one's rest, only go forward)
    const next = dx < 0 ? Math.max(want, Math.min(y, from)) : Math.min(want, Math.max(y, to));
    if (next !== y) scrollTo({ top: next, behavior: "instant" });
  };
  addEventListener("wheel", onWheel, { passive: false });

  /* ---------- the carousel's opening view, painted for the laptop ----------
   The hero's 3D laptop shows the carousel before the real one fades in
   over it (js/hero.js). paintWork(canvas, rect) draws what the carousel
   looks like at its start, where rect is the part of the viewport the
   laptop screen covers once the camera arrives. Cards are drawn from their
   layout (offsets, which ignore transforms) and the start pose; text from
   its own fonts and positions. */
  const metrics = new Map();
  function fontOf(ctx, cs) {
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let m = metrics.get(font);
    if (!m) {
      ctx.font = font;
      const t = ctx.measureText("Hg");
      m = { asc: t.fontBoundingBoxAscent, desc: t.fontBoundingBoxDescent };
      metrics.set(font, m);
    }
    ctx.font = font;
    ctx.fillStyle = cs.color;
    if ("letterSpacing" in ctx) ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    return m;
  }
  const baselineIn = (box, m) => box.y + (box.h - (m.asc + m.desc)) / 2 + m.asc;
  // WebGL refuses images read from local files (but not ones written into
  // the page itself, as in the single-file copy)
  const canUseImages = (img) => location.protocol !== "file:" || img.src.startsWith("data:");
  const range = document.createRange();

  // every word inside el, at its place relative to origin (+dy)
  function paintText(ctx, el, origin, dy = 0, skip = () => false) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const host = node.parentElement;
      if (skip(host)) continue;
      const cs = getComputedStyle(host);
      const m = fontOf(ctx, cs);
      const upper = cs.textTransform === "uppercase";
      const re = /\S+/g;
      let w;
      while ((w = re.exec(node.data))) {
        range.setStart(node, w.index);
        range.setEnd(node, w.index + w[0].length);
        const r = range.getClientRects()[0];
        if (!r) continue;
        const box = { x: r.left - origin.left, y: r.top - origin.top + dy, h: r.height };
        ctx.fillText(upper ? w[0].toUpperCase() : w[0], box.x, baselineIn(box, m));
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function cover(ctx, img, x, y, w, h) {
    if (!img || !canUseImages(img) || !img.complete || !img.naturalWidth) return;
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  // a card's own contents, in its untransformed box: the header line,
  // then the panel with its screen (and its way in, when it's in focus)
  function paintCard(ctx, li, withCta = true, withPanel = true) {
    const head = li.querySelector(".card3__head");
    if (head) {
      for (const span of head.children) {
        const scs = getComputedStyle(span);
        const m = fontOf(ctx, scs);
        const text = scs.textTransform === "uppercase" ? span.textContent.toUpperCase() : span.textContent;
        ctx.fillText(text, head.offsetLeft + span.offsetLeft, baselineIn({ y: head.offsetTop + span.offsetTop, h: span.offsetHeight }, m));
      }
    }
    const body = li.querySelector(".card3__body");
    const bx = body.offsetLeft, by = body.offsetTop;
    const w = body.offsetWidth, h = body.offsetHeight;
    const cs = getComputedStyle(body);
    ctx.save();
    ctx.translate(bx, by);
    if (!withPanel) {
      const cta = withCta && body.querySelector(".card3__cta");
      if (cta) {
        const ccs = getComputedStyle(cta);
        ctx.fillStyle = ccs.backgroundColor;
        roundRect(ctx, cta.offsetLeft, cta.offsetTop, cta.offsetWidth, cta.offsetHeight, cta.offsetHeight / 2);
        ctx.fill();
        const m = fontOf(ctx, ccs);
        ctx.fillText(cta.textContent.trim(), cta.offsetLeft + parseFloat(ccs.paddingLeft), baselineIn({ y: cta.offsetTop, h: cta.offsetHeight }, m));
      }
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.shadowColor = "rgba(60, 40, 28, 0.3)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = cs.backgroundColor;
    roundRect(ctx, 0, 0, w, h, 14);
    ctx.fill();
    ctx.restore();
    roundRect(ctx, 0, 0, w, h, 14);
    ctx.clip();
    const shot = body.querySelector(".card3__shot");
    if (shot) cover(ctx, shot.querySelector("img"), 0, 0, w, h);
    paintSeal(ctx, body, (c) => shot && cover(c, shot.querySelector("img"), 0, 0, w, h));
    // SpatialLite's lettering
    const type = body.querySelector(".card3__type");
    if (type) {
      for (const span of type.children) {
        const m = fontOf(ctx, getComputedStyle(span));
        ctx.fillText(span.textContent, type.offsetLeft + span.offsetLeft, baselineIn({ y: type.offsetTop + span.offsetTop, h: span.offsetHeight }, m));
      }
    }
    const cta = withCta && body.querySelector(".card3__cta");
    if (cta) {
      const ccs = getComputedStyle(cta);
      ctx.fillStyle = ccs.backgroundColor;
      roundRect(ctx, cta.offsetLeft, cta.offsetTop, cta.offsetWidth, cta.offsetHeight, cta.offsetHeight / 2);
      ctx.fill();
      const m = fontOf(ctx, ccs);
      ctx.fillText(cta.textContent.trim(), cta.offsetLeft + parseFloat(ccs.paddingLeft), baselineIn({ y: cta.offsetTop, h: cta.offsetHeight }, m));
    }
    ctx.restore();
  }

  // a card's panel alone, in its own box (0,0 .. w,h): its colour, its
  // screen, SpatialLite's lettering and note, Spatial Key's glass. For the
  // lens's textures; the header line and the way in stay in the page.
  function paintPanel(ctx, body, w, h) {
    const cs = getComputedStyle(body);
    ctx.fillStyle = cs.getPropertyValue("--panel").trim() || cs.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    const shot = body.querySelector(".card3__shot");
    if (shot) {
      const img = shot.querySelector("img");
      if (img && img.complete && img.naturalWidth) {
        // object-position: top, as on the page
        const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
        ctx.drawImage(img, (w - iw) / 2, 0, iw, ih);
      }
    }
    const type = body.querySelector(".card3__type");
    if (type) {
      for (const span of type.children) {
        const m = fontOf(ctx, getComputedStyle(span));
        ctx.fillText(span.textContent, type.offsetLeft + span.offsetLeft, baselineIn({ y: type.offsetTop + span.offsetTop, h: span.offsetHeight }, m));
      }
    }
    const note = body.querySelector(".card3__note");
    if (note) paintText(ctx, note, (() => { const r = body.getBoundingClientRect(); return { left: r.left, top: r.top }; })());
    paintSeal(ctx, body, (c) => {
      const img = shot && shot.querySelector("img");
      if (!img || !img.complete || !img.naturalWidth) return;
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      c.drawImage(img, (w - img.naturalWidth * k) / 2, 0, img.naturalWidth * k, img.naturalHeight * k);
    });
  }

  // Spatial Key's pane of frosted glass (.card3__seal), as css/projects.css
  // draws it. The blur: the screen drawn very small, then doubled in size
  // step by step back up to the pane (every browser can do that; not every
  // canvas has filters, and one big step leaves blocks). drawShot(c) draws
  // the screen in the panel's own box.
  const SHACKLE = new Path2D("M3.2 6V4.2a2.8 2.8 0 0 1 5.6 0V6");
  function paintSeal(ctx, body, drawShot) {
    const seal = body.querySelector(".card3__seal");
    if (!seal) return;
    const w = body.offsetWidth, h = body.offsetHeight;
    const x = seal.offsetLeft, y = seal.offsetTop, sw = seal.offsetWidth, sh = seal.offsetHeight;
    let pic = document.createElement("canvas");
    const k = 1 / Math.max(12, w / 36);
    pic.width = Math.max(1, Math.round(w * k));
    pic.height = Math.max(1, Math.round(h * k));
    const sctx = pic.getContext("2d");
    sctx.scale(pic.width / w, pic.height / h);
    drawShot(sctx);
    while (pic.width * 2 < w) {
      const up = document.createElement("canvas");
      up.width = pic.width * 2;
      up.height = pic.height * 2;
      const uctx = up.getContext("2d");
      uctx.imageSmoothingQuality = "high";
      uctx.drawImage(pic, 0, 0, up.width, up.height);
      pic = up;
    }
    // edge to edge, no outline (as .card3__seal)
    ctx.save();
    roundRect(ctx, x, y, sw, sh, 14);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(pic, 0, 0, w, h);
    ctx.fillStyle = "rgba(36, 34, 31, 0.34)";
    ctx.fillRect(x, y, sw, sh);
    ctx.restore();
    ctx.lineWidth = 1;
    // the lock in its ring
    const lock = seal.querySelector(".card3__lock");
    if (lock) {
      const d = lock.offsetWidth, cx = x + lock.offsetLeft + d / 2, cy = y + lock.offsetTop + d / 2;
      ctx.fillStyle = "rgba(243, 239, 231, 0.14)";
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2 - 0.5, 0, Math.PI * 2);
      ctx.stroke();
      const s = (d * 0.38) / 12; // the icon: 38% of the ring, from its 12 x 14 box
      ctx.save();
      ctx.translate(cx - 6 * s, cy - 7 * s);
      ctx.scale(s, s);
      ctx.strokeStyle = ctx.fillStyle = "#F3EFE7";
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      ctx.stroke(SHACKLE);
      roundRect(ctx, 1.5, 6, 9, 7, 1.6);
      ctx.fill();
      ctx.restore();
    }
    // the line, centred under it
    const ask = seal.querySelector(".card3__ask");
    if (ask) {
      const m = fontOf(ctx, getComputedStyle(ask));
      ctx.textAlign = "center";
      ctx.fillText(ask.textContent, x + ask.offsetLeft + ask.offsetWidth / 2, baselineIn({ y: y + ask.offsetTop, h: ask.offsetHeight }, m));
      ctx.textAlign = "start";
    }
  }

  // where a card's corners land in the stage: transform-origin is its
  // centre; the row (.work__cards, filling the stage) adds the perspective
  function cornersOf(li, w, h) {
    const rowEl = li.parentElement;
    const rcs = getComputedStyle(rowEl);
    const d = parseFloat(rcs.perspective) || 0;
    const [pox, poy] = rcs.perspectiveOrigin.split(" ").map(parseFloat);
    const own = new DOMMatrix(getComputedStyle(li).transform);
    let m = new DOMMatrix().translate(li.offsetLeft + w / 2, li.offsetTop + h / 2).multiply(own).translate(-w / 2, -h / 2);
    if (d) {
      const persp = new DOMMatrix();
      persp.m34 = -1 / d;
      m = new DOMMatrix().translate(pox, poy).multiply(persp).translate(-pox, -poy).multiply(m);
    }
    return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => {
      const p = m.transformPoint(new DOMPoint(x, y, 0, 1));
      return { x: p.x / p.w, y: p.y / p.w };
    });
  }

  function paintWork(canvas, rect) {
    const ctx = canvas.getContext("2d");
    const sx = canvas.width / rect.w, sy = canvas.height / rect.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // stage coordinates (the viewport) -> canvas
    ctx.setTransform(sx, 0, 0, sy, -rect.x * sx, -rect.y * sy);
    ctx.fillStyle = live ? "#F0EBE3" : "#F3EFE7"; // the stage's own paper
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    // where the stage will sit on the screen when it shows: its own top
    // (0, or on phones the block centred on the screen, css/projects.css)
    const stageBox = stage.getBoundingClientRect();
    const stageTop = parseFloat(getComputedStyle(stage).top) || 0;
    const origin = { left: stageBox.left, top: stageBox.top - stageTop };

    if (live && lensOn) {
      // the lens at the start, exactly as it draws, then the first card's
      // header line and its way in on top
      lens.draw(0);
      if (lens.canvas.width && lens.canvas.height) ctx.drawImage(lens.canvas, 0, 0, W, H);
      // the header line and the way in, from where they are on screen
      const li = cards[0];
      paintText(ctx, li.querySelector(".card3__head"), origin);
      const cta = li.querySelector(".card3__cta");
      if (cta) {
        const r = cta.getBoundingClientRect();
        const ccs = getComputedStyle(cta);
        ctx.fillStyle = ccs.backgroundColor;
        roundRect(ctx, r.left - origin.left, r.top - origin.top, r.width, r.height, r.height / 2);
        ctx.fill();
        paintText(ctx, cta, origin);
      }
    }
    if (live) {
      // the cards at the start: the first in focus, the next soft and smaller
      for (const j of lensOn ? [] : [1, 0]) {
        const li = cards[j];
        const o = optical(j);
        ctx.save();
        ctx.globalAlpha = o.o;
        if (o.blur > 0.05) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
        // the card as the browser places it (its 2D transform), drawn from
        // its four corners
        const cw = li.offsetWidth, chh = li.offsetHeight;
        const c = cornersOf(li, cw, chh);
        const ax = ((c[1].x - c[0].x) + (c[2].x - c[3].x)) / 2 / cw;
        const ay = ((c[1].y - c[0].y) + (c[2].y - c[3].y)) / 2 / cw;
        const bx = ((c[3].x - c[0].x) + (c[2].x - c[1].x)) / 2 / chh;
        const by = ((c[3].y - c[0].y) + (c[2].y - c[1].y)) / 2 / chh;
        const mx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, my = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
        ctx.transform(ax, ay, bx, by, mx - (ax * cw + bx * chh) / 2, my - (ay * cw + by * chh) / 2);
        paintCard(ctx, li, o.f > 0.9);
        ctx.restore();
      }
      // the heading
      paintText(ctx, section.querySelector(".work__top"), origin);
      // the index, with the first one current, and the arrows
      gotos.forEach((g, j) => {
        const r = g.getBoundingClientRect();
        const bx = r.left - origin.left, by = r.top - origin.top;
        if (j === 0) {
          ctx.fillStyle = "rgba(216, 200, 180, 0.45)";
          roundRect(ctx, bx, by, r.width, r.height, r.height / 2);
          ctx.fill();
        }
        ctx.fillStyle = j === 0 ? "#24221F" : "rgba(36, 34, 31, 0.5)";
        const gcs = getComputedStyle(g);
        const m = fontOf(ctx, gcs);
        ctx.fillStyle = j === 0 ? "#24221F" : "rgba(36, 34, 31, 0.5)";
        ctx.fillText(g.textContent.trim(), bx + parseFloat(gcs.paddingLeft), baselineIn({ y: by, h: r.height }, m));
      });
      steps.forEach((b) => {
        const r = b.getBoundingClientRect();
        ctx.save();
        ctx.globalAlpha = b.disabled ? 0.3 : 1;
        ctx.strokeStyle = "rgba(36, 34, 31, 0.12)";
        ctx.beginPath();
        ctx.arc(r.left - origin.left + r.width / 2, r.top - origin.top + r.height / 2, r.width / 2 - 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = b.disabled ? 0.3 : 1;
        paintText(ctx, b, origin);
        ctx.restore();
      });
      // the first project's notes (undo the offset of a hidden note)
      const a0 = abouts[0];
      if (a0) {
      const t = getComputedStyle(a0).translate.split(" ");
      const dy = a0.hasAttribute("data-current") ? 0 : -(parseFloat(t[1] || t[0]) || 0);
      paintText(ctx, a0, origin, dy);
      }
    } else {
      // phones: the swipe row at its start, exactly as its stage lays it
      // out, so the real one can fade in over it (css/projects.css)
      const row = section.querySelector(".work__cards");
      if (rowLens) {
        // the lens over the row, as it draws now, then the first card's
        // header line and way in on top
        drawRow();
        const c = lens.canvas.getBoundingClientRect();
        // (not yet sized, e.g. mid-resize: skip it, the next paint has it)
        if (lens.canvas.width && lens.canvas.height) ctx.drawImage(lens.canvas, c.left - origin.left, c.top - origin.top, c.width, c.height);
        const r = cards[0].getBoundingClientRect();
        ctx.save();
        ctx.translate(r.left - origin.left, r.top - origin.top);
        paintCard(ctx, cards[0], true, false);
        ctx.restore();
      }
      for (const li of rowLens ? [] : cards) {
        const r = li.querySelector(".card3__body").getBoundingClientRect();
        ctx.save();
        ctx.translate(r.left - origin.left + row.scrollLeft, r.top - origin.top);
        paintCard(ctx, li);
        ctx.restore();
      }
      paintText(ctx, section.querySelector(".work__top"), origin);
      const a0 = abouts[0];
      if (a0) paintText(ctx, a0, origin, a0.offsetTop - (abouts.find((a) => a.hasAttribute("data-current")) || a0).offsetTop);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.filter = "none";
  }
  window.paintWork = paintWork;
  const changed = () => document.dispatchEvent(new Event("work:changed"));
  section.querySelectorAll("img").forEach((img) => !img.complete && img.addEventListener("load", changed, { once: true }));

  const onResize = () => {
    measureStage();
    if (rowLens) { measureRow(); drawRow(); }
    if (live) { measure(); schedule(); }
    // the hero's laptop shows a painted copy of this: paint it again
    changed();
  };
  if (document.fonts) document.fonts.ready.then(changed);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", onResize);
  reduce.addEventListener("change", setMode);
  roomy.addEventListener("change", setMode);

  setMode();
  loadDiskPictures();
})();
