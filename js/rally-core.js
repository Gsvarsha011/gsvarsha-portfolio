/* Rally — the rules of the badminton game (opened from the footer's racket),
 * with no drawing.
 *
 * A side view in game pixels (320 × 176, y down). The visitor plays on the
 * left and faces right; GS plays on the right and faces left.
 *
 * Shuttle: gravity plus quadratic drag, so a hit leaves fast, slows hard and
 * then drops steeply (about 75° at the end of a clear). It never bounces.
 * Swings: the racket sweeps an arc (overhead or underarm); a hit only counts
 * if the shuttle is in the racket's zone while it sweeps.
 * GS: predicts the flight, picks a reachable contact point, moves there with
 * the same limits as the visitor, and swings on time. It makes the odd
 * human mistake (late, mistimed, misjudged line, loose shot).
 *
 * Runs in the browser (window.RallyCore) and in Node (tools/rally-sim.cjs).
 */
(function (root) {
  "use strict";

  const C = {
    W: 320, H: 176,
    GROUND: 150, COURT_L: 24, COURT_R: 296, NET_X: 160, NET_H: 26,
    G: 220, K: 0.0045,                 // gravity, drag (terminal ≈ 220 px/s)
    DT: 1 / 120,                       // fixed step
    ACC: 950, MAXV: 108, FRICTION: 1200,
    JUMP_V: 150, PG: 620,              // jump ≈ 18 px
    SHOULDER: 21, REACH: 13.5,         // shoulder height, shoulder → racket head
    WINDUP: 0.07, STRIKE: 0.1, FOLLOW: 0.16, RECOVER: 0.08,
    TO_WIN: 21, WIN_BY: 2, CAP: 30, // singles: 21, win by two, 30 caps it
    SHORT: 40,                       // short service line, from the net
    // the visitor's racket is forgiving: a wide timing window (about ±80 ms)
    // and a generous reach; GS gets the plain one
    ASSIST: { tol: 52, reach: 9 }, PLAIN: { tol: 20, reach: 6.5 },
  };
  C.NET_TOP = C.GROUND - C.NET_H;
  C.HOME = { you: C.COURT_L + 52, gs: C.COURT_R - 52 };

  const deg = Math.PI / 180;
  // racket angle from forward-horizontal, up positive, through each phase
  const SWINGS = {
    overhead: { ready: 40, cock: 150, end: 5, follow: -45 },
    underarm: { ready: 40, cock: -115, end: 65, follow: 100 },
  };
  const READY_ANGLE = 40; // racket up and forward, ready

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /* ---------- the shuttle ---------- */

  function stepShuttle(s, dt) {
    const v = Math.hypot(s.vx, s.vy);
    s.vx += -C.K * v * s.vx * dt;
    s.vy += (C.G - C.K * v * s.vy) * dt;
    const px = s.x, py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // the net: a plane at NET_X from the floor to NET_TOP
    if ((px - C.NET_X) * (s.x - C.NET_X) <= 0 && px !== s.x) {
      const t = (C.NET_X - px) / (s.x - px);
      const yAt = py + (s.y - py) * t;
      if (yAt > C.NET_TOP) {
        s.x = C.NET_X - Math.sign(s.vx) * 1.5;
        s.vx = -s.vx * 0.12;
        s.vy = Math.max(s.vy, 0) * 0.3;
        return "net";
      }
    }
    if (s.y >= C.GROUND) {
      s.y = C.GROUND;
      return "land";
    }
    if (s.x < -12 || s.x > C.W + 12) return "away";
    return null;
  }

  // where a shot lands (and whether it clips the net)
  function flight(x, y, vx, vy, maxT = 5) {
    const s = { x, y, vx, vy };
    let net = false, apex = y;
    let netY = null;
    for (let t = 0; t < maxT; t += C.DT) {
      const px = s.x, py = s.y;
      const r = stepShuttle(s, C.DT);
      if (netY === null && (px - C.NET_X) * (s.x - C.NET_X) <= 0 && r !== "net") netY = py;
      apex = Math.min(apex, s.y);
      if (r === "net") net = true;
      if (r === "land" || r === "away") return { x: s.x, t, net, apex, netY };
    }
    return { x: s.x, t: maxT, net, apex, netY };
  }

  // launch velocity at a given angle (rad, up positive) that lands near
  // targetX, raising the angle until the shot clears the net
  function solve(x0, y0, dir, angle, targetX) {
    let a = angle;
    let best = null;
    for (let tries = 0; tries < 9; tries++) {
      let lo = 30, hi = 560;
      const want = (targetX - x0) * dir;
      for (let i = 0; i < 22; i++) {
        const sp = (lo + hi) / 2;
        const f = flight(x0, y0, dir * sp * Math.cos(a), -sp * Math.sin(a));
        if ((f.x - x0) * dir < want) lo = sp; else hi = sp;
      }
      const sp = (lo + hi) / 2;
      const vx = dir * sp * Math.cos(a), vy = -sp * Math.sin(a);
      const f = flight(x0, y0, vx, vy);
      best = { vx, vy };
      const clears = !f.net && (f.netY === null || f.netY < C.NET_TOP - 6);
      // keep it on screen: a shot that would leave the top flattens a little
      if (clears && f.apex < 10 && a > angle - 0.3) { a -= 0.07; continue; }
      if (clears) return best;
      a += 0.09;
    }
    return best;
  }

  /* ---------- players ---------- */

  function newPlayer(id) {
    const side = id === "you" ? -1 : 1;
    return {
      id, side, f: -side, x: C.HOME[id], h: 0, vx: 0, vz: 0,
      swing: null, run: 0, input: { dir: 0, jump: false, swing: false },
      prevJump: false, prevSwing: false, look: 0, cheer: 0,
    };
  }

  function bounds(p) {
    return p.side < 0 ? [C.COURT_L - 14, C.NET_X - 11] : [C.NET_X + 11, C.COURT_R + 14];
  }

  // racket angle (deg) for a player right now
  function racketAngle(p) {
    const s = p.swing;
    if (!s) return READY_ANGLE;
    const k = SWINGS[s.kind];
    const t = s.t;
    if (t < C.WINDUP) return lerp(k.ready, k.cock, easeInOut(t / C.WINDUP));
    if (t < C.WINDUP + C.STRIKE) return lerp(k.cock, k.end, (t - C.WINDUP) / C.STRIKE);
    if (t < C.WINDUP + C.STRIKE + C.FOLLOW) return lerp(k.end, k.follow, easeInOut((t - C.WINDUP - C.STRIKE) / C.FOLLOW));
    return lerp(k.follow, k.ready, easeInOut((t - C.WINDUP - C.STRIKE - C.FOLLOW) / C.RECOVER));
  }

  function shoulder(p) {
    return { x: p.x + p.f * 1, y: C.GROUND - C.SHOULDER - p.h };
  }
  function racketHead(p, angleDeg = racketAngle(p)) {
    const s = shoulder(p);
    const a = angleDeg * deg;
    return { x: s.x + p.f * C.REACH * Math.cos(a), y: s.y - C.REACH * Math.sin(a) };
  }

  // head offset from the feet (forward, up) at strike progress u, standing
  function strikeOffset(kind, u) {
    const k = SWINGS[kind];
    const a = lerp(k.cock, k.end, u) * deg;
    return { dx: 1 + C.REACH * Math.cos(a), dy: C.SHOULDER + C.REACH * Math.sin(a) };
  }
  const SWING_TIME = C.WINDUP + C.STRIKE + C.FOLLOW + C.RECOVER;

  /* ---------- shots ---------- */

  const SHOTS = {
    serveHigh: { angle: 0.88, target: (d) => (d > 0 ? C.COURT_R - 24 : C.COURT_L + 24) },
    serveShort: { angle: 0.55, target: (d) => C.NET_X + d * 54 },
    clear: { angle: 0.74, target: (d) => (d > 0 ? C.COURT_R - 13 : C.COURT_L + 13) },
    lift: { angle: 0.92, target: (d) => (d > 0 ? C.COURT_R - 30 : C.COURT_L + 30) },
    drive: { angle: 0.18, target: (d) => C.NET_X + d * 88 },
    drop: { angle: 0.42, target: (d) => C.NET_X + d * 22 },
    // the visitor's sharper versions
    dropTight: { angle: 0.36, target: (d) => C.NET_X + d * 15 },
    clearDeep: { angle: 0.7, target: (d) => (d > 0 ? C.COURT_R - 7 : C.COURT_L + 7) },
  };

  // velocity for a shot type, from (x, y), going dir, with aim error ex (px)
  // and quality q (0..1; a poor contact loses pace)
  function shotVelocity(type, x, y, dir, ex = 0, q = 1) {
    if (type === "smash") {
      // the steepest angle that still clears the net and lands in
      const sp = 420 * (0.82 + 0.18 * q);
      const far = dir > 0 ? C.COURT_R : C.COURT_L;
      for (let a = -0.62; a < 0.2; a += 0.03) {
        const vx = dir * sp * Math.cos(a), vy = -sp * Math.sin(a);
        const f = flight(x, y, vx, vy);
        if (f.net || f.netY === null || f.netY > C.NET_TOP - 5 || (f.x - C.NET_X) * dir < 6) continue;
        if ((f.x - far) * dir > -4) break; // flatter would go long
        const err = (1 - q) * 0.22; // a poor contact flattens it
        return { vx: dir * sp * Math.cos(a + err), vy: -sp * Math.sin(a + err) };
      }
      return shotVelocity("drive", x, y, dir, ex, q);
    }
    const s = SHOTS[type];
    const v = solve(x, y, dir, s.angle, s.target(dir) + ex);
    const pace = q < 0.7 ? 1 - (0.7 - q) * 0.3 : 1; // only a poor contact loses pace
    return { vx: v.vx * pace, vy: v.vy * pace };
  }

  /* ---------- the game ---------- */

  function newGame(rand = Math.random) {
    const g = {
      rand, t: 0, state: "idle", timer: 0,
      score: { you: 0, gs: 0 }, server: "you",
      you: newPlayer("you"), gs: newPlayer("gs"),
      shuttle: { x: 0, y: 0, vx: 0, vy: 0, held: "you", last: null, live: false },
      ai: { plan: null, reactAt: 0, err: null },
      me: { plan: null, reactAt: 0 }, // the visitor's legs: they move on their own
      events: [], winner: null, rallyHits: 0,
    };
    holdShuttle(g);
    return g;
  }

  function holdShuttle(g) {
    const s = g.shuttle, p = g[g.server];
    s.held = g.server;
    s.live = false;
    s.last = null;
    s.vx = s.vy = 0;
    s.x = p.x + p.f * 6;
    s.y = C.GROUND - 15 - p.h;
  }

  function start(g) {
    g.score = { you: 0, gs: 0 };
    g.server = "you";
    g.winner = null;
    resetRally(g, true);
  }

  function resetRally(g, instant) {
    for (const id of ["you", "gs"]) {
      const p = g[id];
      p.swing = null;
      p.h = p.vz = 0;
      if (instant) { p.x = C.HOME[id]; p.vx = 0; }
    }
    g.ai.plan = null;
    g.me.plan = null;
    g.rallyHits = 0;
    holdShuttle(g);
    g.state = "serve";
    g.timer = 0;
  }

  function other(id) { return id === "you" ? "gs" : "you"; }

  function point(g, winner, why) {
    g.score[winner]++;
    g.server = winner;
    g.shuttle.live = false;
    g.events.push({ type: "point", winner, why });
    g[winner].cheer = 0.9;
    g.ai.plan = null;
    const a = g.score[winner], o = g.score[other(winner)];
    if ((a >= C.TO_WIN && a - o >= C.WIN_BY) || a >= C.CAP) {
      g.state = "over";
      g.winner = winner;
      g.events.push({ type: "over", winner });
    } else {
      g.state = "point";
      g.timer = 0;
    }
  }

  // a hit leaves from the shuttle's position toward the other side
  function launch(g, p, v) {
    const s = g.shuttle;
    s.serve = g.rallyHits === 0; // the serve is judged by its own lines
    s.held = null;
    s.live = true;
    s.last = p.id;
    s.vx = v.vx;
    s.vy = v.vy;
    g.rallyHits++;
    if (p.id === "gs") {
      // your legs read GS's shot (a moment later, like anyone's)
      g.me.plan = null;
      g.me.reactAt = g.t + 0.12;
    }
    g.events.push({ type: "hit", x: s.x, y: s.y, by: p.id });
    if (p.id === "you") {
      // GS reads the shot after a human-ish moment
      const m = g.ai;
      m.plan = null;
      m.reactAt = g.t + 0.15 + g.rand() * 0.09;
      m.err = rollMistake(g);
      if (m.err === "late") m.reactAt += 0.45;
    }
  }

  /* ---------- swings and contact ---------- */

  function startSwing(g, p, kind) {
    if (p.swing && p.swing.t < C.WINDUP + C.STRIKE + C.FOLLOW) return false;
    if (!kind) {
      const s = g.shuttle;
      kind = s.y < shoulder(p).y - 3 ? "overhead" : "underarm";
    }
    p.swing = { kind, t: 0, done: false, serve: g.shuttle.held === p.id };
    return true;
  }

  // the visitor only presses one key, so the shot is chosen for them, and
  // chosen well: a smash off a high shuttle, a tight drop when GS is at the
  // back, a deep clear when GS is up at the net
  function choosePlayerShot(g, kind, contactY) {
    const high = C.GROUND - contactY;
    const gsDeep = g.gs.x > C.HOME.gs - 4;
    if (kind === "overhead" && high > 31) return "smash";
    if (gsDeep) return "dropTight";
    return kind === "overhead" ? "clearDeep" : "lift";
  }

  function updateSwing(g, p, dt) {
    const sw = p.swing;
    if (!sw) return;
    const s = g.shuttle;
    sw.t += dt;
    const inStrike = sw.t >= C.WINDUP && sw.t - dt < C.WINDUP + C.STRIKE;

    // serving: the toss is part of the swing, contact is certain
    if (sw.serve && !sw.done && sw.t >= C.WINDUP + C.STRIKE * 0.5) {
      sw.done = true;
      let type;
      if (p.id === "you") type = "serveHigh";
      else type = sw.serveType || "serveHigh";
      s.x = p.x + p.f * 8;
      s.y = C.GROUND - 16 - p.h;
      launch(g, p, shotVelocity(type, s.x, s.y, p.f, p.id === "gs" ? (g.rand() - 0.5) * 10 : 0, 1));
    }

    if (inStrike && !sw.done && s.live && s.last !== p.id && (s.x - C.NET_X) * p.side > -2) {
      // the racket face is a zone, not a point: the shuttle has to be at
      // racket distance from the shoulder, within a few degrees of where the
      // racket is (or has just swept through). The visitor gets a wider
      // window (about ±50 ms) than GS.
      const zone = p.id === "you" ? C.ASSIST : C.PLAIN;
      const tol = zone.tol;
      const sh = shoulder(p);
      const dxf = (s.x - sh.x) * p.f, dyu = sh.y - s.y;
      const r = Math.hypot(dxf, dyu);
      const ang = Math.atan2(dyu, dxf) / deg;
      const a1 = racketAngle({ ...p, swing: { ...sw, t: Math.max(C.WINDUP, sw.t - dt) } });
      const a2 = racketAngle(p);
      const inArc = ang >= Math.min(a1, a2) - tol && ang <= Math.max(a1, a2) + tol;
      const radial = Math.abs(r - (C.REACH - 1));
      const reach = zone.reach;
      const best = inArc && radial <= reach
        ? Math.max(radial, (Math.min(Math.abs(ang - a2), Math.abs(ang - a1)) / tol) * reach)
        : Infinity;
      if (best <= reach) {
        sw.done = true;
        const q = clamp(1 - best / reach, 0, 1) * 0.6 + 0.4;
        let v;
        if (p.id === "you") {
          const type = choosePlayerShot(g, sw.kind, s.y);
          v = shotVelocity(type, s.x, s.y, p.f, (g.rand() * 2 - 1) * (1 - q) * 44, q);
        } else {
          const plan = g.ai.plan || {};
          let type = plan.shot || "clear";
          let ex = (g.rand() - 0.5) * 10;
          // a loose shot: long past the line, or short into the tape
          if (g.ai.err === "loose") ex += g.rand() < 0.55 ? 34 * -p.f + g.rand() * 14 * -p.f : -(70 + g.rand() * 20) * -p.f;
          if (type === "smash" && C.GROUND - s.y < 34) type = "drive";
          v = shotVelocity(type, s.x, s.y, p.f, ex, Math.max(q, 0.85));
        }
        launch(g, p, v);
      }
    }
    if (sw.t >= SWING_TIME) p.swing = null;
  }

  /* ---------- movement ---------- */

  function movePlayer(g, p, dt, wantVx) {
    const [lo, hi] = bounds(p);
    if (wantVx === undefined) {
      const d = p.input.dir;
      if (d) p.vx = clamp(p.vx + d * C.ACC * dt, -C.MAXV, C.MAXV);
      else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), C.FRICTION * dt);
    } else {
      p.vx += clamp(wantVx - p.vx, -C.ACC * dt, C.ACC * dt);
    }
    p.x += p.vx * dt;
    if (p.x < lo) { p.x = lo; p.vx = 0; }
    if (p.x > hi) { p.x = hi; p.vx = 0; }
    if (p.h > 0 || p.vz > 0) {
      p.h += p.vz * dt;
      p.vz -= C.PG * dt;
      if (p.h <= 0) { p.h = 0; p.vz = 0; g.events.push({ type: "step", x: p.x }); }
    }
    p.run += Math.abs(p.vx) * dt;
    if (p.cheer > 0) p.cheer -= dt;
  }

  function jump(p) {
    if (p.h === 0 && p.vz === 0) p.vz = C.JUMP_V;
  }

  /* ---------- GS ---------- */

  // Difficulty. Your legs move on their own, so the game is all timing.
  // GS's error rate is fixed (about one shot in seven); how often it wins is
  // set by how often it goes for a winner (SHARP) and its speed. Tuned with
  // tools/rally-sim.cjs: with a typical human timing spread (±40–60 ms) GS
  // wins roughly 60–75% of rallies.
  const MISTAKE = 0.14;
  const SHARP = 0.45;    // how often GS goes for a winner
  const GS_SPEED = 1; // GS's top speed and read, relative to yours
  function rollMistake(g) {
    if (g.rand() > MISTAKE) return null;
    const r = g.rand();
    return r < 0.3 ? "late" : r < 0.55 ? "mistime" : r < 0.8 ? "loose" : "line";
  }

  // where to meet the shuttle (GS, and the test bot). opts: { speed, slack, jumpOk }
  function plan(g, p, opts = {}) {
    const s = g.shuttle;
    const sim = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    const speed = (opts.speed || 1) * C.MAXV;
    const out = flight(s.x, s.y, s.vx, s.vy);
    const [lo, hi] = bounds(p);
    // a shot going out is left alone (unless GS misjudges the line)
    const landsIn = out.x >= C.NET_X && out.x <= C.COURT_R + 0.5 && !out.net;
    const lineCall = p.id === "gs" && g.ai.err === "line";
    if (!out.net && out.x > C.COURT_R + 0.5 && !lineCall) return { leave: true, x: C.HOME.gs - 10 };
    if (out.net) return { leave: true, x: p.x };
    if (lineCall && landsIn && out.x > C.COURT_R - 9) return { leave: true, x: C.HOME.gs };
    let best = null;
    let fallback = null;
    for (let t = 0; t < 4; t += C.DT) {
      const r = stepShuttle(sim, C.DT);
      if (r) break;
      if ((sim.x - C.NET_X) * p.side < 4) continue;
      const hy = C.GROUND - sim.y;
      for (const kind of ["overhead", "underarm"]) {
        for (const jumpH of opts.jumpOk === false ? [0] : [0, 17]) {
          if (jumpH && kind === "underarm") continue;
          // strike progress where the head passes the shuttle's height
          let u = null;
          for (let k = 0.15; k <= 0.85; k += 0.05) {
            const o = strikeOffset(kind, k);
            if (Math.abs(o.dy + jumpH - hy) < 1.6 && o.dx > 2) { u = k; break; }
          }
          if (u === null) continue;
          const o = strikeOffset(kind, u);
          const x = sim.x - p.f * o.dx;
          if (x < lo || x > hi) continue;
          const lead = C.WINDUP + u * C.STRIKE;
          const travel = Math.abs(x - p.x) / speed + 0.1;
          const slack = t - lead - travel - (opts.slack || 0);
          const c = { t, x, kind, jumpH, lead, u, hy, slack };
          if (slack >= 0) {
            const score = (kind === "overhead" ? 30 : 0) + hy + (jumpH ? 6 : 0) - t * 4 + Math.min(slack, 0.15) * 120;
            if (!best || score > best.score) best = { ...c, score };
          } else if (!fallback || slack > fallback.slack) fallback = c;
        }
      }
    }
    return best || fallback || { leave: true, x: p.x };
  }

  // GS rallies more than it goes for the kill: it mostly sends the shuttle
  // back, and only now and then (SHARP) smashes or drops to finish a point
  function chooseGSShot(g, c) {
    const deep = g.you.x < (C.COURT_L + C.NET_X) / 2 - 6;
    const r = g.rand();
    if (c.kind === "overhead" && c.jumpH && c.hy > 40) return r < SHARP ? "smash" : "clear";
    if (c.kind === "overhead") return deep && r < SHARP ? "drop" : r < 0.7 ? "clear" : "drive";
    return deep && r < SHARP ? "drop" : "lift";
  }

  function updateGS(g, dt) {
    const p = g.gs, s = g.shuttle, m = g.ai;
    let target = C.HOME.gs;
    if (g.state === "serve" && s.held === "gs") {
      if (g.timer > 0.9 && !p.swing) {
        startSwing(g, p, "underarm");
        p.swing.serveType = g.rand() < 0.65 ? "serveHigh" : "serveShort";
      }
    } else if (g.state === "rally" && s.live && s.last === "you" && g.t >= m.reactAt) {
      if (!m.plan) {
        const c = plan(g, p, { speed: GS_SPEED });
        if (!c.leave) {
          c.shot = chooseGSShot(g, c);
          c.at = g.t + c.t;
          c.swingAt = c.at - c.lead + (m.err === "mistime" ? (g.rand() < 0.5 ? -1 : 1) * 0.09 : 0);
          c.jumpAt = c.jumpH ? c.at - 0.24 : null;
        }
        m.plan = c;
      }
      const c = m.plan;
      target = c.x;
      if (!c.leave) {
        if (c.jumpAt !== null && g.t >= c.jumpAt) { jump(p); c.jumpAt = null; }
        if (!p.swing && g.t >= c.swingAt && g.t < c.at + 0.1) startSwing(g, p, c.kind);
      }
    } else if (g.state === "rally" && s.last === "gs") {
      // recover toward the middle of the half, leaning to cover the drop
      target = C.HOME.gs - 8;
    }
    // time-optimal approach: full speed, then brake to stop on the spot
    const d = target - p.x;
    const vmax = C.MAXV * GS_SPEED;
    const want = Math.abs(d) < 0.4 ? 0 : Math.sign(d) * Math.min(vmax, Math.sqrt(2 * C.ACC * 0.85 * Math.abs(d)));
    movePlayer(g, p, dt, want);
    p.look = s.x;
  }

  /* ---------- the step ---------- */

  function update(g, dt) {
    g.t += dt;
    g.timer += dt;
    g.events.length = 0;
    const you = g.you, gs = g.gs, s = g.shuttle;

    if (g.state === "idle" || g.state === "over") {
      for (const p of [you, gs]) movePlayer(g, p, dt, (C.HOME[p.id] - p.x) * 6);
      if (s.held) holdShuttle(g);
      return;
    }

    if (g.state === "point") {
      for (const p of [you, gs]) movePlayer(g, p, dt, clamp((C.HOME[p.id] - p.x) * 5, -60, 60));
      updateSwing(g, you, dt);
      updateSwing(g, gs, dt);
      if (g.timer > 1.25) resetRally(g, false);
      return;
    }

    // the visitor: one key to hit; the legs take you to the shuttle
    const inp = you.input;
    const me = g.me;
    if (inp.swing && !you.prevSwing && (g.state === "rally" || s.held === "you")) {
      startSwing(g, you, s.held === "you" ? "underarm" : me.plan && !me.plan.leave ? me.plan.kind : undefined);
    }
    you.prevSwing = inp.swing;
    let goal = C.HOME.you;
    if (g.state === "rally" && s.live && s.last === "gs" && g.t >= me.reactAt) {
      if (!me.plan) {
        me.plan = plan(g, you, { speed: 1, jumpOk: false });
        if (!me.plan.leave) me.plan.at = g.t + me.plan.t; // when to hit, for the curious
      }
      if (!me.plan.leave) goal = me.plan.x;
    } else if (g.state === "rally" && s.last === "you") goal = C.HOME.you + 8;
    if (g.state === "serve" && s.held === "you") movePlayer(g, you, dt, 0); // the server stays put
    else {
      const d = goal - you.x;
      movePlayer(g, you, dt, Math.abs(d) < 0.4 ? 0 : Math.sign(d) * Math.min(C.MAXV, Math.sqrt(2 * C.ACC * 0.85 * Math.abs(d))));
    }
    you.look = s.x;

    updateGS(g, dt);
    updateSwing(g, you, dt);
    updateSwing(g, gs, dt);

    if (s.held) {
      if (s.live) s.held = null;
      else {
        const p = g[s.held];
        s.x = p.x + p.f * 6;
        s.y = C.GROUND - 15 - p.h;
        return;
      }
    }
    if (g.state === "serve" && s.live) g.state = "rally";
    if (!s.live) return;

    const r = stepShuttle(s, dt);
    if (r === "net") g.events.push({ type: "net", x: s.x, y: s.y });
    if (r === "land" || r === "away") {
      const x = s.x;
      g.events.push({ type: "land", x, out: x < C.COURT_L || x > C.COURT_R });
      let winner, why;
      if (s.serve) {
        // a serve must land in the receiver's service court: past the short
        // service line, inside the back boundary line (singles)
        const dir = g[s.last].f;
        const d = (x - C.NET_X) * dir;
        const back = dir > 0 ? C.COURT_R : C.COURT_L;
        const good = d >= C.SHORT && (back - x) * dir >= 0;
        winner = good ? s.last : other(s.last);
        why = good ? "in" : d > 0 && d < C.SHORT ? "short" : (back - x) * dir < 0 ? "out" : "fault";
      } else if (x >= C.COURT_L && x < C.NET_X) { winner = "gs"; why = "in"; }
      else if (x > C.NET_X && x <= C.COURT_R) { winner = "you"; why = "in"; }
      else { winner = other(s.last); why = "out"; }
      point(g, winner, why);
    }
  }

  const api = { C, other, newGame, start, update, racketAngle, racketHead, shoulder, flight, plan, startSwing, jump, SWINGS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RallyCore = api;
})(typeof window !== "undefined" ? window : globalThis);
