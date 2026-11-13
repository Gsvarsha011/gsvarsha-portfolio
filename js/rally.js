/* Rally — the badminton game, opened from the footer's racket signature.
 * Drawing, input and the loop; the rules are in js/rally-core.js.
 *
 * It lives in a <dialog>: clicking the racket (or its label) opens it, Esc
 * or the close button shuts it. Everything in the court is drawn into a
 * 320 × 176 canvas, pixel by pixel, and scaled up with sharp pixels; text
 * (score, messages, buttons) stays in the HTML. One key: Space to hit; your
 * legs move on their own and the shot is chosen for you. Singles rules: see
 * js/rally-core.js. Keys are only taken while a
 * match is running inside the open dialog, and the loop only runs while it
 * is open and the tab is visible.
 */
(() => {
  const root = document.querySelector("[data-rally]");
  if (!root || !window.RallyCore) return;
  const R = window.RallyCore;
  const { C } = R;

  const game = root.querySelector("[data-game]");
  const canvas = root.querySelector("[data-court]");
  const ctx = canvas.getContext("2d");
  const stage = root.querySelector("[data-stage]");
  const panel = root.querySelector("[data-panel]");
  const panelTitle = root.querySelector("[data-panel-title]");
  const startBtn = root.querySelector("[data-start]");
  const msg = root.querySelector("[data-msg]");
  const scoreYou = root.querySelector("[data-score-you]");
  const scoreGS = root.querySelector("[data-score-gs]");
  const pausedNote = root.querySelector("[data-paused]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  canvas.width = C.W;
  canvas.height = C.H;
  ctx.imageSmoothingEnabled = false;

  /* ---------- palette (the portfolio's, plus a few tones of it) ---------- */

  const P = {
    paper: "#F3EFE7", ink: "#24221F", terra: "#B66A4B", sand: "#D8C8B4", white: "#FFFFFF",
    wall: "#EEE6DA", wall2: "#E7DCCC", base: "#D9CAB5",
    floor: "#DED0BC", court: "#C7A58A", courtDark: "#B99479",
    skinGS: "#B8835F", hairGS: "#2C2420", shirtGS: "#B66A4B", shortsGS: "#3A3532",
    skinYou: "#C99470", hairYou: "#4A3A30", shortsYou: "#5A524B",
  };
  const SHIRTS = { charcoal: "#3A3532" };
  const look = { shirt: "charcoal", hair: "short" };

  /* ---------- pixel helpers ---------- */

  const px = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  function line(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = c;
    for (;;) {
      ctx.fillRect(x0, y0, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // a tiny 3 × 5 font for the labels drawn in the game
  const FONT = {
    G: "011100101101011", S: "011100010001110", Y: "101101010010010",
    O: "010101101101010", U: "101101101101111", "!": "010010010000010", "?": "110001010000010",
  };
  function text(str, x, y, c) {
    let cx = Math.round(x);
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === "1") px(cx + (i % 3), y + Math.floor(i / 3), c);
      cx += 4;
    }
  }
  const textWidth = (s) => s.length * 4 - 1;

  /* ---------- the court ---------- */

  const BACK = C.GROUND - 4, FRONT = C.GROUND + 9;
  // court edges in depth: x at a row y (sidelines lean toward the viewer)
  const edgeL = (y) => C.COURT_L + 3 - 10 * ((y - BACK) / (FRONT - BACK));
  const edgeR = (y) => C.COURT_R - 3 + 10 * ((y - BACK) / (FRONT - BACK));
  const netX = (y) => C.NET_X + 2 - 5 * ((y - BACK) / (FRONT - BACK));

  // the still background is drawn once
  const bg = document.createElement("canvas");
  bg.width = C.W;
  bg.height = C.H;
  (function drawBackground() {
    const b = bg.getContext("2d");
    const R1 = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    R1(0, 0, C.W, C.H, P.wall);
    // the wall's two tones, ordered-dithered where they meet
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 70; y < BACK - 8; y++) {
      const t = (y - 70) / (BACK - 78);
      for (let x = 0; x < C.W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < t) { b.fillStyle = P.wall2; b.fillRect(x, y, 1, 1); }
    }
    // a quiet window of light, high on the wall
    for (let i = 0; i < 3; i++) {
      R1(34 + i * 17, 22, 13, 24, "rgba(255,255,255,0.3)");
      R1(34 + i * 17, 33, 13, 1, "rgba(36,34,31,0.07)");
      R1(40 + i * 17, 22, 1, 24, "rgba(36,34,31,0.07)");
    }
    // skirting and floor
    R1(0, BACK - 8, C.W, 3, P.base);
    R1(0, BACK - 8, C.W, 1, "rgba(36,34,31,0.18)");
    R1(0, BACK - 5, C.W, C.H - BACK + 5, P.floor);
    for (let y = BACK - 4; y < C.H; y += 3) for (let x = (y * 5) % 9; x < C.W; x += 9) { b.fillStyle = "rgba(36,34,31,0.04)"; b.fillRect(x, y, 1, 1); }
    // the court mat
    for (let y = BACK; y <= FRONT; y++) {
      b.fillStyle = y > FRONT - 2 ? P.courtDark : P.court;
      b.fillRect(Math.round(edgeL(y)), y, Math.round(edgeR(y) - edgeL(y)), 1);
    }
    R1(Math.round(edgeL(FRONT)), FRONT + 1, Math.round(edgeR(FRONT) - edgeL(FRONT)), 2, "rgba(36,34,31,0.16)");
  })();

  function drawCourtLines(hover) {
    const c = `rgba(255,255,255,${0.78 + 0.22 * hover})`;
    for (let y = BACK; y <= FRONT; y++) {
      px(edgeL(y), y, c);
      px(edgeR(y) - 1, y, c);
      px(netX(y) - 40, y, c); // short service lines
      px(netX(y) + 40, y, c);
    }
    for (let x = edgeL(BACK); x < edgeR(BACK); x++) px(x, BACK, c);
    for (let x = edgeL(FRONT); x < edgeR(FRONT); x++) px(x, FRONT, c);
    if (hover > 0.01) {
      ctx.globalAlpha = 0.25 * hover;
      for (let x = edgeL(FRONT); x < edgeR(FRONT); x++) px(x, FRONT + 1, P.ink);
      ctx.globalAlpha = 1;
    }
  }

  function drawNet(part, shake) {
    if (part === "back") {
      rect(netX(BACK) - 1, BACK - C.NET_H, 2, C.NET_H, P.ink);
      // mesh between the tape and the bottom cord
      for (let y = BACK; y <= FRONT; y++) {
        const x = Math.round(netX(y)) + (shake ? Math.round(Math.sin(y + shake * 40) * 0.6) : 0);
        const t = y - C.NET_H;
        for (let k = 2; k < 14; k++) if ((k + y) % 2 === 0) px(x, t + k, "rgba(36,34,31,0.42)");
        px(x, t + 14, "rgba(36,34,31,0.7)");
      }
      for (let y = BACK; y <= FRONT; y++) {
        const x = Math.round(netX(y));
        px(x, y - C.NET_H, P.white);
        px(x, y - C.NET_H + 1, P.white);
      }
    } else {
      rect(netX(FRONT) - 1, FRONT - C.NET_H, 2, C.NET_H, P.ink);
      rect(netX(FRONT) - 2, FRONT - 1, 4, 2, P.ink);
    }
  }

  /* ---------- the players ---------- */

  function drawPlayer(p, who, t, fx) {
    const gs = who === "gs";
    const shirt = gs ? P.shirtGS : SHIRTS[look.shirt] || SHIRTS.charcoal;
    const skin = gs ? P.skinGS : P.skinYou;
    const hair = gs ? P.hairGS : P.hairYou;
    const shorts = gs ? P.shortsGS : P.shortsYou;
    const f = p.f;
    const x0 = Math.round(p.x);
    const air = p.h > 0.5;
    const moving = Math.abs(p.vx) > 12 && !air;
    // a breath while standing, a bob while running, a crouch when ready
    let bob = 0;
    if (moving) bob = -Math.round(Math.abs(Math.sin(p.run * 0.18)));
    else if (!reduce.matches) bob = Math.sin(t * 2.6 + (gs ? 1 : 0)) > 0.6 ? -1 : 0;
    if (fx.crouch) bob = 1;
    const top = Math.round(C.GROUND - p.h) + bob;

    // shadow
    const sw = Math.max(3, 8 - Math.round(p.h / 5));
    rect(x0 - sw / 2, C.GROUND, sw, 1, "rgba(36,34,31,0.22)");
    rect(x0 - sw / 2 + 1, C.GROUND + 1, sw - 2, 1, "rgba(36,34,31,0.12)");

    const X = (dx) => x0 + dx * f; // offsets in the facing direction
    const box = (dx, y, w, h, c) => {
      const a = X(dx), b = X(dx + w - 1);
      rect(Math.min(a, b), y, w, h, c);
    };

    // legs (alternating while running, tucked in the air)
    const stride = moving ? Math.round(Math.sin(p.run * 0.18) * 2) : 0;
    const legH = air ? 6 : 8;
    box(-3 + stride, top - legH, 3, legH, shorts);
    box(1 - stride, top - legH, 3, legH, shorts);
    box(-3 + stride, top - 3, 3, 3, skin);
    box(1 - stride, top - 3, 3, 3, skin);
    box(-3 + stride, top - 1, 4, 1, P.ink); // shoes, toes forward
    box(1 - stride, top - 1, 4, 1, P.ink);

    // torso
    const ty = top - 8 - 12;
    box(-4, ty, 9, 12, shirt);
    box(-4, ty, 1, 12, "rgba(36,34,31,0.16)");
    if (shirt === SHIRTS.paper) { box(-4, ty, 9, 1, "rgba(36,34,31,0.2)"); box(4, ty, 1, 12, "rgba(36,34,31,0.2)"); }
    if (gs) box(-1, ty + 4, 3, 1, "rgba(255,255,255,0.35)");

    // back arm
    const armSwing = moving ? Math.round(Math.sin(p.run * 0.18)) : 0;
    box(-6 - armSwing, ty + 1, 2, 4, shirt);
    box(-6 - armSwing, ty + 5, 2, 5, skin);

    // head, turned toward what it looks at
    const hy = ty - 8;
    let face = f;
    if (fx.lookAt !== undefined) face = Math.sign(fx.lookAt - p.x) || f;
    const H = (dx) => x0 + dx * face;
    const hbox = (dx, y, w, h, c) => { const a = H(dx), b = H(dx + w - 1); rect(Math.min(a, b), y, w, h, c); };
    hbox(-3, hy, 7, 8, skin);
    hbox(1, hy + 3, 1, 2, P.ink);
    hbox(3, hy + 3, 1, 2, P.ink);
    hbox(1, hy + 6, 3, 1, "rgba(36,34,31,0.55)");
    if (gs) {
      // GS: a dark bob with a fringe, long at the back
      hbox(-4, hy - 2, 9, 3, hair);
      hbox(-4, hy, 2, 8, hair);
      hbox(-4, hy + 8, 3, 2, hair);
      hbox(2, hy, 3, 2, hair);
      hbox(4, hy + 1, 1, 2, hair);
    } else if (look.hair === "cap") {
      hbox(-4, hy - 2, 8, 3, P.ink);
      hbox(4, hy, 3, 1, P.ink);
      hbox(-3, hy + 1, 1, 3, hair);
    } else if (look.hair === "bun") {
      hbox(-4, hy - 1, 8, 2, hair);
      hbox(-4, hy, 2, 5, hair);
      hbox(-5, hy - 4, 3, 3, hair);
    } else {
      hbox(-4, hy - 1, 8, 2, hair);
      hbox(-4, hy, 2, 4, hair);
      hbox(3, hy, 2, 1, hair);
    }

    // racket arm and racket
    let ang = R.racketAngle(p);
    if (fx.twirl) ang += fx.twirl * 360;
    if (fx.wave) ang = 80 + Math.sin(t * 16) * 30;
    const a = (ang * Math.PI) / 180;
    const sx = x0 + f * 2, sy = ty + 1;
    const hx = sx + f * 7 * Math.cos(a), hyy = sy - 7 * Math.sin(a);
    line(sx, sy, hx, hyy, skin, 2);
    rect(Math.min(sx, sx + f), sy - 1, 2, 3, shirt);
    const rx = sx + f * 10 * Math.cos(a), ry = sy - 10 * Math.sin(a);
    line(hx, hyy, rx, ry, P.ink);
    const cx = sx + f * C.REACH * Math.cos(a), cy = sy - C.REACH * Math.sin(a);
    const ux = f * Math.cos(a), uy = -Math.sin(a);
    for (let k = 0; k < 24; k++) {
      const th = (k / 24) * Math.PI * 2;
      const ex = Math.cos(th) * 3.4, ey = Math.sin(th) * 2.2;
      px(cx + ux * ex - uy * ey, cy + uy * ex + ux * ey, P.ink);
    }
    px(cx, cy, "rgba(255,255,255,0.7)");
    px(cx + ux, cy + uy, "rgba(255,255,255,0.5)");
    px(cx - ux, cy - uy, "rgba(255,255,255,0.5)");

    // label above the head
    const label = gs ? "GS" : "YOU";
    const lw = textWidth(label);
    const ly = hy - 18 + (fx.labelHop || 0);
    text(label, x0 - Math.floor(lw / 2), ly, gs ? P.terra : P.ink);
    if (fx.mark) text(fx.mark, x0 + Math.ceil(lw / 2) + 2, ly, P.terra);
  }

  /* ---------- the shuttle ---------- */

  let shuttleDir = { x: 0, y: 1 };
  const trail = [];
  function drawShuttle(s, tilt) {
    const v = Math.hypot(s.vx, s.vy);
    if (v > 25) shuttleDir = { x: s.vx / v, y: s.vy / v };
    else if (!s.live) shuttleDir = { x: tilt || 0, y: 1 }; // cork down when held
    const d = shuttleDir;
    // above the top of the screen: a small arrow at the edge
    if (s.y < 2) {
      line(s.x - 2, 4, s.x, 2, P.ink);
      line(s.x + 2, 4, s.x, 2, P.ink);
      return;
    }
    if (s.live && v > 160) for (let i = 0; i < trail.length; i++) px(trail[i].x, trail[i].y, `rgba(36,34,31,${0.06 * (i + 1)})`);
    if (s.live) {
      const w = C.GROUND - s.y > 40 ? 1 : 2;
      rect(s.x - w / 2, C.GROUND, w, 1, "rgba(36,34,31,0.25)");
    }
    // the feather skirt trails behind the cork, widening
    const nx = -d.y, ny = d.x;
    for (let k = 1; k <= 4; k++) {
      const bx = s.x - d.x * (k + 0.5), by = s.y - d.y * (k + 0.5);
      const w = Math.round(k * 0.6);
      for (let j = -w; j <= w; j++) px(bx + nx * j, by + ny * j, Math.abs(j) === w && k > 1 ? P.ink : P.white);
    }
    px(s.x, s.y, P.terra);
    px(s.x + d.x * 0.8, s.y + d.y * 0.8, P.white);
  }

  /* ---------- effects ---------- */

  const fx = [];
  function addFx(type, x, y) { fx.push({ type, x, y, t: 0 }); }
  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      e.t += dt;
      if (e.type === "hit") {
        const a = 1 - e.t / 0.16;
        if (a <= 0) { fx.splice(i, 1); continue; }
        const r = 2 + e.t * 30;
        for (let k = 0; k < 6; k++) {
          const th = (k / 6) * Math.PI * 2 + 0.4;
          px(e.x + Math.cos(th) * r, e.y + Math.sin(th) * r, `rgba(36,34,31,${a * 0.7})`);
        }
      } else {
        const a = 1 - e.t / 0.4;
        if (a <= 0) { fx.splice(i, 1); continue; }
        for (const s of [-1, 1]) for (let k = 1; k <= 2; k++) px(e.x + s * (k * 2 + e.t * 18), C.GROUND - 1 - Math.round(e.t * 6 * k), `rgba(185,148,121,${a})`);
      }
    }
  }

  /* ---------- state, messages and the panel ---------- */

  let g = R.newGame();
  g.server = "gs";
  g.shuttle.held = "gs";
  let running = false;
  let paused = false;
  let netShake = 0;
  let msgTimer = 0;

  function say(t, hold = 1.3) {
    msg.textContent = t;
    msg.toggleAttribute("data-on", !!t);
    msgTimer = t ? hold : 0;
  }
  // "Game point" / "Deuce" when the score calls for it
  function gamePoint() {
    const a = g.score.you, b = g.score.gs;
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (a === b && a >= C.TO_WIN - 1) return a >= C.CAP - 1 ? "Golden point" : "Deuce";
    if (hi >= C.TO_WIN - 1 && hi > lo) return "Game point";
    return "";
  }
  function setScore() {
    scoreYou.textContent = g.score.you;
    scoreGS.textContent = g.score.gs;
  }
  function showPanel(title, button) {
    panelTitle.textContent = title;
    startBtn.textContent = button;
    panel.hidden = false;
    root.removeAttribute("data-playing");
    if (root.open) fit();
  }

  function startMatch() {
    g = R.newGame();
    R.start(g);
    running = true;
    paused = false;
    panel.hidden = true;
    pausedNote.hidden = true;
    root.setAttribute("data-playing", "");
    setScore();
    fit();

    game.focus({ preventScroll: true });
    wake();
  }
  function pause() {
    if (!running || paused) return;
    paused = true;
    clearInput();
    pausedNote.hidden = false;
  }
  function resume() {
    if (!running || !paused) return;
    paused = false;
    pausedNote.hidden = true;
    game.focus({ preventScroll: true });
    wake();
  }
  startBtn.addEventListener("click", startMatch);

  /* ---------- input ---------- */

  const keys = new Set();
  const tapped = new Set(); // presses since the last step, so even a very quick tap counts
  const touch = { swing: false };
  const coarse = matchMedia("(pointer: coarse)");
  // one thing to do: hit (Space; J and Enter work too). Your legs move on their own.
  const KEYMAP = { Space: "swing", KeyJ: "swing", Enter: "swing" };
  const active = () => root.open && running && !paused && game.contains(document.activeElement);

  function onKeyDown(e) {
    if (!active()) return;
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault(); // only while playing: arrows and space don't scroll
    if (!e.repeat) tapped.add(k);
    keys.add(k);
  }
  function onKeyUp(e) {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  }
  function clearInput() {
    keys.clear();
    tapped.clear();
    for (const k in touch) touch[k] = false;
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  game.addEventListener("focusout", (e) => {
    if (!game.contains(e.relatedTarget)) pause();
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (paused) resume();
    else if (running) {
      game.focus({ preventScroll: true });
      if (e.pointerType === "touch") tapped.add("swing"); // a tap on the court hits
    }
  });
  pausedNote.addEventListener("click", resume);

  root.querySelectorAll("[data-touch]").forEach((b) => {
    const k = b.dataset.touch;
    const down = (e) => {
      e.preventDefault();
      if (paused) resume();
      touch[k] = true;
      if (b.setPointerCapture) b.setPointerCapture(e.pointerId);
    };
    const up = () => (touch[k] = false);
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
  });

  /* ---------- hover, before and between matches ---------- */

  const hover = { on: false, x: 0, y: 0, amt: 0, gsTwirl: 0, youWave: 0, nearGS: false, nearYou: false };
  stage.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    hover.x = ((e.clientX - r.left) / r.width) * C.W;
    hover.y = ((e.clientY - r.top) / r.height) * C.H;
    hover.on = true;
    wake();
  });
  stage.addEventListener("pointerleave", () => (hover.on = false));

  /* ---------- the loop ---------- */

  let raf = 0, last = 0, acc = 0, clock = 0;
  const live = () => root.open && !document.hidden;
  function wake() {
    if (raf || !live()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    if (!live()) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // never negative, even after a long sleep
    last = now;
    clock += dt;

    if (running && !paused) {
      const you = g.you;
      you.input.dir = 0;
      acc += dt;
      while (acc >= C.DT) {
        acc -= C.DT;
        you.input.jump = false;
        you.input.swing = keys.has("swing") || tapped.has("swing") || touch.swing;
        tapped.clear();
        R.update(g, C.DT);
        for (const e of g.events) handle(e);
      }
      trail.push({ x: g.shuttle.x, y: g.shuttle.y });
      if (trail.length > 3) trail.shift();
      if (g.state === "serve" && g.timer < 0.05) {
        // singles: an even score serves from the right court, odd from the left
        const mine = g.shuttle.held === "you";
        const court = g.score[mine ? "you" : "gs"] % 2 === 0 ? "right" : "left";
        const lead = gamePoint();
        say(`${lead ? lead + " · " : ""}${mine ? "Your serve" : "GS serves"} · ${court} court${mine ? (coarse.matches ? " · tap Hit" : " · press Space") : ""}`, mine ? 9 : 1.4);
      }
    } else if (!running || g.state === "over") {
      acc = 0;
      R.update(g, Math.min(dt, 0.05));
      g.events.length = 0;
    }
    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) say("");
    }
    if (netShake > 0) netShake = Math.max(0, netShake - dt);

    draw(dt);

    const busy = running && !paused;
    const idleAnim = !reduce.matches || hover.on || hover.amt > 0.01 || hover.gsTwirl > 0 || hover.youWave > 0 || fx.length;
    if (busy || idleAnim) raf = requestAnimationFrame(frame);
  }

  function handle(e) {
    if (e.type === "hit") {
      addFx("hit", e.x, e.y);
      if (msgTimer > 0 && g.rallyHits === 1) say("");
    }
    if (e.type === "net") netShake = 0.25;
    if (e.type === "land") addFx("dust", e.x, C.GROUND);
    if (e.type === "point") {
      setScore();
      const why = { out: "Out. ", short: "Short serve. ", fault: "Fault. " }[e.why] || "";
      say(e.winner === "you" ? `${why}Your point!` : `${why}Point to GS`, 1.2);
    }
    if (e.type === "over") {
      running = false;
      const close = g.score.you >= C.TO_WIN - 4;
      const title = e.winner === "you" ? "Okay, you’ve got game." : close ? "Rematch?" : "Told you I play.";
      setTimeout(() => {
        say("");
        showPanel(`${title} ${g.score.you}–${g.score.gs}`, "Play again");
        startBtn.focus({ preventScroll: true });
      }, 900);
    }
  }

  function draw(dt) {
    const idle = !running || paused;
    hover.amt += ((idle && hover.on ? 1 : 0) - hover.amt) * Math.min(1, dt * 8);

    ctx.drawImage(bg, 0, 0);
    drawCourtLines(hover.amt);
    drawNet("back", netShake);

    // hover reactions, only when no rally is being played
    const gsFx = {}, youFx = {};
    if (idle && hover.on) {
      const dGS = Math.hypot(hover.x - g.gs.x, hover.y - (C.GROUND - 18));
      const dYou = Math.hypot(hover.x - g.you.x, hover.y - (C.GROUND - 18));
      const nearNet = Math.abs(hover.x - C.NET_X) < 16 && hover.y > C.GROUND - 50;
      gsFx.lookAt = hover.x;
      youFx.lookAt = hover.x;
      if (dGS < 20 && !hover.nearGS && !reduce.matches) hover.gsTwirl = 1;
      if (dYou < 20 && !hover.nearYou && !reduce.matches) hover.youWave = 0.7;
      hover.nearGS = dGS < 20;
      hover.nearYou = dYou < 20;
      if (nearNet) { gsFx.crouch = youFx.crouch = true; gsFx.mark = "?"; }
    } else {
      hover.nearGS = hover.nearYou = false;
    }
    if (hover.gsTwirl > 0) {
      hover.gsTwirl = Math.max(0, hover.gsTwirl - dt / 0.55);
      gsFx.twirl = 1 - hover.gsTwirl;
      gsFx.labelHop = hover.gsTwirl > 0.5 ? -1 : 0;
    }
    if (hover.youWave > 0) {
      hover.youWave = Math.max(0, hover.youWave - dt);
      youFx.wave = true;
      youFx.labelHop = -1;
    }
    if (g.gs.cheer > 0 && !reduce.matches) gsFx.twirl = 1 - g.gs.cheer / 0.9;
    if (g.you.cheer > 0) youFx.mark = "!";

    // idle, GS tosses the shuttle gently, and it leans toward a near pointer
    const s = g.shuttle;
    let tilt = 0;
    if (!running && s.held && !reduce.matches) {
      s.y += -Math.abs(Math.sin(clock * 1.6)) * 5;
      if (hover.on && Math.hypot(hover.x - s.x, hover.y - s.y) < 26) tilt = Math.sign(hover.x - s.x) * 0.5;
    }

    drawPlayer(g.you, "you", clock, youFx);
    drawPlayer(g.gs, "gs", clock, gsFx);
    drawShuttle(s, tilt);
    drawFx(dt);
    drawNet("front");
  }

  /* ---------- opening and closing ---------- */

  // the court as large as the window allows: as wide as its column, and as
  // tall as the height left after everything around it (the title, score,
  // buttons); on phones the window is the whole screen
  const card = root.querySelector(".rally__card");
  const holder = root.querySelector(".rally__holder");
  function fit() {
    const full = root.clientHeight >= innerHeight - 2;
    const chrome = card.offsetHeight - stage.offsetHeight;
    const roomH = (full ? root.clientHeight : innerHeight - 24) - chrome;
    const avail = Math.min(holder.clientWidth, roomH * (C.W / C.H));
    const k = Math.min(4, Math.max(1, avail / C.W));
    stage.style.width = `${Math.floor(C.W * k)}px`;
    stage.style.height = `${Math.floor(C.H * k)}px`;
  }

  function open() {
    if (root.open) return;
    root.showModal();
    fit();
    setScore();
    draw(0);
    startBtn.focus({ preventScroll: true });
    wake();
  }
  root.addEventListener("close", () => {
    pause();
    hover.on = false;
  });
  root.querySelector("[data-close]").addEventListener("click", () => root.close());
  // a click on the backdrop closes it too
  root.addEventListener("click", (e) => {
    if (e.target === root) root.close();
  });
  document.querySelectorAll("[data-open-rally]").forEach((b) => b.addEventListener("click", open));
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : wake()));
  addEventListener("resize", () => root.open && fit());
  reduce.addEventListener("change", wake);
})();
