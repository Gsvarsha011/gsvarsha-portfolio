// The desk: a blocky, toy-like (Roblox-style) scene in three.js.
//
// You sit at a desk behind a closed MacBook, with a tumbler, your phone,
// sticky notes, over-ear headphones, a cold coffee and a notebook. Everything is built
// from rounded boxes and cylinders in smooth plastic, lit by one warm sun
// with soft shadows.
//
// The camera follows the hero's scroll progress (see camAt): it holds a
// three-quarter view while the name and roles play, then swings round and
// over your shoulder, and dollies into the laptop as the lid opens, until
// the screen fills the frame. The screen shows the project panel, painted
// from the real HTML (js/screen.js); at the end the HTML panel itself fades
// in on top, in exactly the same place (js/hero.js).
import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.js";

/* ---------- look ---------- */

// Change these to change the avatar.
const LOOK = {
  skin: "#B8835F",
  hair: "#2C2420",
  shirt: "#B66A4B",
  pants: "#3A3532",
};

const COL = {
  desk: "#CDA982",
  deskTop: "#DCBE9B",
  chair: "#33302D",
  chairSeat: "#4A4440",
  rug: "#E2D3BE",
  laptop: "#C9C6C1",
  bezel: "#24221F",
  tumbler: "#EBD8D0",
  tumblerLid: "#F7F3EF",
  phoneCase: "#E6D7C3",
  cover: "#1F1D1B",
  pages: "#F6F2EA",
  band: "#151413",
  stickies: ["#EBB58C", "#E8D6B3", "#D98F6E"],
  phones: "#D3CFCA",
  phonesPad: "#6A4434",
  coffee: "#8C5B3B",
  cream: "#D7B995",
  straw: "#B66A4B",
};

/* ---------- camera keyframes (stage 1 / stage 2 / side / over the shoulder) ---------- */

const K = [
  { pos: [11.0, 12.6, 20.5], target: [0.2, 4.7, -1.2] },
  { pos: [8.2, 12.0, 21.4], target: [0.0, 4.6, -1.2] },
  { pos: [14.5, 9.5, -3.0], target: [0.0, 3.8, -1.0] },
  { pos: [4.6, 10.2, -10.5], target: [0.3, 3.9, 0.4] },
];
const FOV = 30;
const FOV_SCREEN = 50;
const LID_OPEN = 1.85; // radians, about 106°

/* ---------- helpers ---------- */

const mats = new Map();
function mat(color, { rough = 0.62, metal = 0, opacity = 1 } = {}) {
  const key = `${color}|${rough}|${metal}|${opacity}`;
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (opacity < 1) Object.assign(m, { transparent: true, opacity, depthWrite: false });
    mats.set(key, m);
  }
  return mats.get(key);
}
function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
const box = (w, h, d, r, color, opts) =>
  mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), typeof color === "string" ? mat(color, opts) : color);
const cyl = (rt, rb, h, color, opts, seg = 32) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === "string" ? mat(color, opts) : color);
const at = (obj, x, y, z) => (obj.position.set(x, y, z), obj);

// a cylinder with rounded rims, for the head and the cups
function roundCylinder(r, h, rc, color, seg = 40) {
  const pts = [new THREE.Vector2(0, -h / 2)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, -h / 2 + rc + Math.sin(a) * rc));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, h / 2 - rc + Math.sin(a) * rc));
  }
  pts.push(new THREE.Vector2(0, h / 2));
  return mesh(new THREE.LatheGeometry(pts, seg), mat(color));
}

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- the pieces ---------- */

const HEAD_Y = 2.48;
const ARM_X = -1.22; // arms reach down and forward, hands resting by the laptop

// your hair: shoulder length, parted a little to one side. A cap over the
// crown, a soft fringe, a long back panel and two side panels that frame the
// face and fall to just above the shoulders, each ending in a slight
// outward flick. Added to a head (head-local units; the head's centre is 0,
// its bottom about -0.61, the shoulders sit near -0.66).
function longHair(head) {
  const h = { rough: 0.8 };
  head.add(at(box(1.4, 0.44, 1.4, 0.2, LOOK.hair, h), 0, 0.52, -0.02)); // crown
  const fringe = at(box(1.32, 0.28, 0.32, 0.13, LOOK.hair, h), -0.06, 0.4, 0.52);
  fringe.rotation.z = 0.08; // swept a little to one side
  head.add(fringe);
  head.add(at(box(1.42, 1.32, 0.5, 0.2, LOOK.hair, h), 0, -0.08, -0.5)); // back
  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.position.set(s * 0.66, 0.42, -0.08);
    side.add(at(box(0.28, 1.06, 0.98, 0.13, LOOK.hair, h), 0, -0.53, 0));
    const tip = at(box(0.3, 0.26, 0.86, 0.12, LOOK.hair, h), s * 0.05, -1.08, -0.04);
    tip.rotation.z = s * 0.28; // the ends flick out
    side.add(tip);
    side.rotation.z = s * 0.03;
    head.add(side);
  }
}

function buildAvatar() {
  const g = new THREE.Group(); // origin: hips, on the seat
  // slimmer than a stock blocky avatar: a narrower torso, thin arms with
  // small hands, so nothing crowds the laptop
  const torso = at(box(1.6, 1.8, 0.82, 0.12, LOOK.shirt), 0, 0.92, 0);
  g.add(torso);

  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  head.add(roundCylinder(0.62, 1.22, 0.24, LOOK.skin));
  // the classic face, wrapped onto the front of the head
  const face = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#1E1B19";
    for (const x of [w * 0.43, w * 0.57]) {
      ctx.beginPath();
      ctx.ellipse(x, h * 0.4, w * 0.018, h * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#1E1B19";
    ctx.lineWidth = w * 0.016;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.075, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  });
  const faceMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.625, 0.625, 1.0, 48, 1, true, -Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.7, depthWrite: false })
  );
  head.add(faceMesh);
  longHair(head);
  g.add(head);

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    // a little slimmer and shorter than a stock avatar's, so the hands read
    // in proportion with the laptop
    arm.position.set(s * 1.04, 1.66, 0);
    arm.add(at(box(0.42, 1.5, 0.42, 0.12, LOOK.skin), 0, -0.75, 0));
    arm.add(at(box(0.48, 0.62, 0.48, 0.12, LOOK.shirt), 0, -0.26, 0)); // sleeve
    arm.add(at(box(0.46, 0.34, 0.5, 0.14, LOOK.skin), 0, -1.56, 0.02)); // hand
    arm.rotation.x = ARM_X;
    arm.rotation.z = s * -0.04;
    arms.push(arm);
    g.add(arm);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.41, 0.42, 0);
    leg.add(at(box(0.78, 1.9, 0.8, 0.12, LOOK.pants), 0, -0.95, 0));
    leg.rotation.x = -Math.PI / 2;
    g.add(leg);
  }
  return { group: g, head, torso, arms };
}

/* ---------- the footer's meditating you ----------
   The same avatar, cross-legged on a floor cushion like a meditation pose:
   back straight, hands resting on the knees, eyes closed, the same
   shoulder-length hair. Its eyes open when asked. Origin: the hips, on the
   cushion. */

function faceTexture(kind) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = ctx.strokeStyle = "#1E1B19";
    ctx.lineWidth = w * 0.014;
    ctx.lineCap = "round";
    const eye = (x, open) => {
      ctx.beginPath();
      if (open) {
        ctx.ellipse(x, h * 0.4, w * 0.018, h * 0.075, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // a closed eye: a soft downward curve
        ctx.arc(x, h * 0.37, w * 0.026, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    };
    eye(w * 0.43, kind === "open");
    eye(w * 0.57, kind === "open");
    // a calm, small smile
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.05, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  });
}

// a box from a to b (world points), w × d thick
function limb(a, b, w, d, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = box(w, len, d, Math.min(0.12, w / 2.2), color);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

export function buildMeditator() {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // the cushion
  g.add(at(box(3.4, 0.42, 2.9, 0.2, "#D8C8B4", { rough: 0.95 }), 0, -0.24, 0.45));
  g.add(at(box(3.3, 0.04, 2.8, 0.02, "#CDBBA3", { rough: 1 }), 0, -0.02, 0.45));

  g.add(at(box(1.6, 1.8, 0.82, 0.12, LOOK.shirt), 0, 0.92, 0));

  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  head.add(roundCylinder(0.62, 1.22, 0.24, LOOK.skin));
  const closed = faceTexture("closed"), open = faceTexture("open");
  const faceMat = new THREE.MeshStandardMaterial({ map: closed, transparent: true, roughness: 0.7, depthWrite: false });
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 1.0, 48, 1, true, -Math.PI / 2, Math.PI), faceMat));
  longHair(head);
  g.add(head);

  // legs crossed: each thigh goes forward and out to the knee, each shin
  // comes back across in front, one resting over the other
  const knees = [];
  for (const s of [-1, 1]) {
    const hip = V(s * 0.42, 0.28, 0.1);
    const knee = V(s * 1.42, 0.3, 1.05);
    const ankle = V(-s * 0.5, 0.3 + (s > 0 ? 0.2 : 0), 1.55 - (s > 0 ? 0.08 : 0));
    g.add(limb(hip, knee, 0.8, 0.78, LOOK.pants));
    g.add(limb(knee, ankle, 0.66, 0.62, LOOK.pants));
    // a bare foot, tucked under the opposite knee
    const foot = at(box(0.42, 0.34, 0.66, 0.14, LOOK.skin), ankle.x - s * 0.38, ankle.y - 0.02, ankle.z - 0.1);
    foot.rotation.y = s * 0.5;
    g.add(foot);
    knees.push(knee);
  }

  // arms hang from the shoulders to rest on the knees, palms up
  const arms = [];
  for (const [i, s] of [-1, 1].entries()) {
    const shoulder = V(s * 1.04, 1.66, 0);
    const hand = V(knees[i].x - s * 0.08, knees[i].y + 0.5, knees[i].z - 0.08);
    const arm = new THREE.Group();
    arm.position.copy(shoulder);
    arm.add(at(box(0.48, 0.62, 0.48, 0.12, LOOK.shirt), 0, -0.26, 0)); // sleeve
    const len = shoulder.distanceTo(hand);
    arm.add(at(box(0.42, len, 0.42, 0.12, LOOK.skin), 0, -len / 2, 0));
    arm.add(at(box(0.5, 0.3, 0.56, 0.14, LOOK.skin), 0, -len - 0.06, 0.04)); // the hand, in a mudra
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), hand.clone().sub(shoulder).normalize());
    arms.push(arm);
    g.add(arm);
  }

  return {
    group: g,
    // still, by design; only the eyes change
    setEyes(isOpen) {
      faceMat.map = isOpen ? open : closed;
    },
  };
}

/* ---------- the About section's cutout ----------
   The same avatar, standing on its own: no desk, no props, turned a little
   toward your photo beside it. The head can look about (look), and the
   right arm can give one small wave (wave). Origin: the ground, between
   the feet. */

export function buildCutout() {
  const g = new THREE.Group();
  const me = new THREE.Group();
  me.position.y = 1.98; // the hips, with the legs below
  g.add(me);
  me.add(at(box(1.6, 1.8, 0.82, 0.12, LOOK.shirt), 0, 0.92, 0));

  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  head.add(roundCylinder(0.62, 1.22, 0.24, LOOK.skin));
  head.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.625, 0.625, 1.0, 48, 1, true, -Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ map: faceTexture("open"), transparent: true, roughness: 0.7, depthWrite: false })
  ));
  longHair(head);
  me.add(head);

  for (const s of [-1, 1]) {
    me.add(at(box(0.78, 1.98, 0.8, 0.12, LOOK.pants), s * 0.41, -0.97, 0));
  }

  // arms hanging, a touch out from the sides
  const arms = {};
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 1.04, 1.66, 0);
    arm.add(at(box(0.48, 0.62, 0.48, 0.12, LOOK.shirt), 0, -0.26, 0)); // sleeve
    arm.add(at(box(0.42, 1.5, 0.42, 0.12, LOOK.skin), 0, -0.75, 0));
    arm.add(at(box(0.46, 0.34, 0.5, 0.14, LOOK.skin), 0, -1.56, 0.02)); // hand
    arm.rotation.z = s * 0.06;
    me.add(arm);
    arms[s] = arm;
  }

  // at rest the head turns toward the photo (to your right, as you look)
  const rest = { x: -0.08, y: 0.42 };
  return {
    group: g,
    // t: 0 at rest, 1 looking toward a point (x, y in -1..1 of the view)
    look(t, x = 0, y = 0) {
      head.rotation.x = rest.x * (1 - t) + (y * 0.22) * t;
      head.rotation.y = rest.y * (1 - t) + (x * 0.55) * t;
    },
    // w: 0..1 through one small wave of the arm by the photo
    wave(w) {
      const up = Math.sin(Math.min(1, w) * Math.PI); // up, then back down
      // raised out to the side, rocking a little at the top: the wave
      arms[1].rotation.z = 0.06 + up * (2.4 + Math.sin(w * Math.PI * 6) * 0.22);
      arms[1].rotation.x = -up * 0.15;
    },
  };
}

function buildChair() {
  const g = new THREE.Group();
  g.add(at(box(2.7, 0.36, 2.5, 0.14, COL.chairSeat), 0, -0.18, 0));
  g.add(at(box(2.7, 2.7, 0.36, 0.14, COL.chairSeat), 0, 1.25, -1.25));
  g.add(at(cyl(0.16, 0.16, 1.4, COL.chair, { rough: 0.4, metal: 0.3 }), 0, -1.06, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = at(box(0.3, 0.2, 1.5, 0.08, COL.chair), Math.sin(a) * 0.75, -1.72, Math.cos(a) * 0.75);
    leg.rotation.y = a;
    g.add(leg);
    g.add(at(mesh(new THREE.SphereGeometry(0.16, 16, 12), mat(COL.chair)), Math.sin(a) * 1.45, -1.84, Math.cos(a) * 1.45));
  }
  return g;
}

function buildDesk() {
  const g = new THREE.Group();
  g.add(at(box(9.2, 0.24, 4.4, 0.1, COL.deskTop), 0, 3.08, 0));
  for (const x of [-4.2, 4.2]) for (const z of [-1.8, 1.8]) g.add(at(box(0.36, 2.96, 0.36, 0.08, COL.desk), x, 1.48, z));
  return g;
}

// The laptop: a silver MacBook Pro. The deck (keys, speaker grilles,
// trackpad) is one canvas; the screen shows the project panel, painted from
// the real HTML by js/screen.js.
const SCREEN_W = 2.94, SCREEN_H = 1.9;

function appleShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.6);
  s.bezierCurveTo(0.1, 0.68, 0.32, 0.74, 0.43, 0.56);
  s.bezierCurveTo(0.3, 0.5, 0.28, 0.3, 0.46, 0.22); // the bite
  s.bezierCurveTo(0.42, 0.08, 0.34, -0.06, 0.24, -0.08);
  s.bezierCurveTo(0.14, -0.1, 0.08, -0.03, 0, -0.03);
  s.bezierCurveTo(-0.08, -0.03, -0.14, -0.1, -0.24, -0.08);
  s.bezierCurveTo(-0.4, -0.04, -0.5, 0.2, -0.48, 0.36);
  s.bezierCurveTo(-0.46, 0.6, -0.26, 0.74, -0.12, 0.68);
  s.bezierCurveTo(-0.06, 0.66, -0.03, 0.62, 0, 0.6);
  const leaf = new THREE.Shape();
  leaf.moveTo(0.02, 0.7);
  leaf.bezierCurveTo(0.02, 0.86, 0.12, 0.95, 0.24, 0.97);
  leaf.bezierCurveTo(0.24, 0.84, 0.14, 0.72, 0.02, 0.7);
  return [s, leaf];
}

function drawDeck(ctx, w, h) {
  ctx.fillStyle = COL.laptop;
  ctx.fillRect(0, 0, w, h);
  // speaker grilles either side of the keyboard
  ctx.fillStyle = "#8F8982";
  for (const x0 of [70, w - 70 - 130]) {
    for (let y = 80; y < 760; y += 16) for (let x = x0; x < x0 + 130; x += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // keys: a function row, four rows, then the space bar row
  const left = 250, right = w - 250, top = 70, gap = 12;
  const rows = [
    { h: 50, keys: Array(14).fill(1) },
    { h: 104, keys: [...Array(13).fill(1), 1.5] },
    { h: 104, keys: [1.5, ...Array(12).fill(1), 1] },
    { h: 104, keys: [1.8, ...Array(11).fill(1), 1.7] },
    { h: 104, keys: [2.3, ...Array(10).fill(1), 2.2] },
    { h: 104, keys: [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1] },
  ];
  ctx.fillStyle = "#1F1D1B";
  let y = top;
  for (const r of rows) {
    const units = r.keys.reduce((a, b) => a + b, 0);
    const unit = (right - left - gap * (r.keys.length - 1)) / units;
    let x = left;
    for (const k of r.keys) {
      ctx.beginPath();
      ctx.roundRect(x, y, k * unit, r.h, 12);
      ctx.fill();
      x += k * unit + gap;
    }
    y += r.h + gap;
  }
  // trackpad
  ctx.fillStyle = "#D3CEC7";
  ctx.strokeStyle = "#B4ADA4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 430, 835, 860, 500, 34);
  ctx.fill();
  ctx.stroke();
}

// the sticky note on the lid, in pencil: a little sun with a smile and
// "stay curious", drawn in wobbly graphite strokes
function drawNote(ctx, w, h) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const pencil = (draw, passes = 3) => {
    for (let i = 0; i < passes; i++) {
      ctx.save();
      ctx.translate(rnd() * 3, rnd() * 3);
      ctx.strokeStyle = `rgba(58, 52, 48, ${0.5 + i * 0.15})`;
      ctx.lineWidth = 6.5 - i * 1.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      draw();
      ctx.stroke();
      ctx.restore();
    }
  };
  // the sun
  const cx = w * 0.5, cy = h * 0.36, r = w * 0.13;
  pencil(() => ctx.ellipse(cx, cy, r, r * 0.96, 0.1, 0, Math.PI * 2));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    pencil(() => {
      ctx.moveTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3);
      ctx.lineTo(cx + Math.cos(a) * r * (i % 2 ? 1.62 : 1.78), cy + Math.sin(a) * r * (i % 2 ? 1.62 : 1.78));
    }, 2);
  }
  pencil(() => { ctx.moveTo(cx - r * 0.35, cy - r * 0.15); ctx.lineTo(cx - r * 0.33, cy - r * 0.02); }, 2);
  pencil(() => { ctx.moveTo(cx + r * 0.33, cy - r * 0.15); ctx.lineTo(cx + r * 0.35, cy - r * 0.02); }, 2);
  pencil(() => ctx.arc(cx, cy + r * 0.12, r * 0.42, 0.25 * Math.PI, 0.75 * Math.PI));
  // the words, in a handwriting face where there is one
  ctx.fillStyle = "rgba(54, 48, 44, 0.95)";
  ctx.textAlign = "center";
  ctx.font = `bold ${w * 0.125}px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive`;
  ctx.save();
  ctx.translate(w * 0.5, h * 0.82);
  ctx.rotate(-0.05);
  ctx.fillText("stay curious", 0, 0);
  ctx.restore();
  pencil(() => { ctx.moveTo(w * 0.22, h * 0.88); ctx.quadraticCurveTo(w * 0.5, h * 0.92, w * 0.78, h * 0.86); }, 2);
}

function buildLaptop(screenCanvas) {
  const g = new THREE.Group();
  const silver = mat(COL.laptop, { rough: 0.34, metal: 0.3 });
  g.add(at(box(3.1, 0.1, 2.15, 0.06, silver), 0, 0.05, 0));
  // the thumb notch in the front edge
  g.add(at(box(0.5, 0.03, 0.04, 0.012, "#ABA49C"), 0, 0.085, -1.07));
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 2.05),
    new THREE.MeshStandardMaterial({ map: canvasTexture(2048, 1400, drawDeck), roughness: 0.34, metalness: 0.3 })
  );
  deck.rotation.set(-Math.PI / 2, 0, Math.PI); // top of the canvas toward the hinge
  deck.position.set(0, 0.101, 0);
  deck.receiveShadow = true;
  g.add(deck);

  // lid: pivots on the hinge at the back edge; closed, it lies over the base
  const lid = new THREE.Group();
  lid.position.set(0, 0.1, 1.075);
  lid.add(at(box(3.1, 0.065, 2.15, 0.06, silver), 0, 0.033, -1.075));
  lid.add(at(box(3.04, 0.01, 2.09, 0.004, COL.bezel), 0, -0.002, -1.075));
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  // face down when closed; the texture's top is the lid's free edge
  screen.rotation.set(Math.PI / 2, 0, Math.PI);
  screen.position.set(0, -0.0085, -1.1);
  lid.add(screen);
  // the notch
  lid.add(at(box(0.34, 0.004, 0.075, 0.002, COL.bezel), 0, -0.0115, -2.012));
  // the apple on the back
  const logo = new THREE.Mesh(new THREE.ShapeGeometry(appleShape(), 24), mat("#B4ADA5", { rough: 0.18, metal: 0.65 }));
  logo.rotation.x = -Math.PI / 2;
  logo.scale.setScalar(0.5);
  logo.position.set(0, 0.067, -1.2);
  lid.add(logo);
  const note = at(box(0.6, 0.022, 0.6, 0.01, COL.stickies[0]), 0.95, 0.075, -1.6);
  note.rotation.y = 0.22;
  const doodle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.56),
    new THREE.MeshStandardMaterial({ map: canvasTexture(512, 512, drawNote), transparent: true, roughness: 0.9 })
  );
  doodle.rotation.x = -Math.PI / 2;
  doodle.position.y = 0.0125;
  note.add(doodle);
  lid.add(note);
  g.add(lid);
  return { group: g, lid, screen, screenTex };
}

// a pale pink tumbler: tapered body, steel band, lid, straw and handle
function buildTumbler() {
  const g = new THREE.Group();
  const pink = mat(COL.tumbler, { rough: 0.55 });
  const profile = [
    [0, 0], [0.27, 0], [0.3, 0.03], [0.31, 0.55], [0.34, 0.66], [0.41, 0.76], [0.42, 0.82], [0.42, 1.6], [0, 1.6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(profile, 48), pink));
  g.add(at(cyl(0.425, 0.425, 0.08, "#C9C6C2", { rough: 0.22, metal: 0.8 }), 0, 1.64, 0));
  g.add(at(roundCylinder(0.41, 0.16, 0.05, COL.tumblerLid), 0, 1.75, 0));
  g.add(at(roundCylinder(0.17, 0.1, 0.04, COL.tumbler), 0, 1.86, 0.05));
  g.add(at(cyl(0.045, 0.045, 0.75, "#FBF8F4", { rough: 0.3 }, 12), 0, 2.2, 0.05));
  const handle = new THREE.Group();
  handle.add(at(box(0.44, 0.14, 0.14, 0.06, pink), 0.56, 1.42, 0));
  handle.add(at(box(0.44, 0.14, 0.14, 0.06, pink), 0.56, 0.86, 0));
  handle.add(at(box(0.14, 0.7, 0.14, 0.06, pink), 0.74, 1.14, 0));
  g.add(handle);
  return g;
}

// rounded rectangle slab (for covers and pages): w along x, d along z
function slab(w, d, h, r, material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.012, h / 3), bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  return mesh(geo, material);
}

// a black hardcover notebook: white page edges, elastic band, grey ribbon
function buildNotebook() {
  const g = new THREE.Group();
  const black = mat(COL.cover, { rough: 0.72 });
  g.add(at(slab(1.72, 2.3, 0.04, 0.16, black), 0, 0.012, 0));
  g.add(at(slab(1.62, 2.22, 0.15, 0.12, mat(COL.pages, { rough: 0.9 })), 0.03, 0.06, 0));
  g.add(at(slab(1.72, 2.3, 0.04, 0.16, black), 0, 0.222, 0));
  g.add(at(box(0.06, 0.3, 2.34, 0.02, COL.band), 0.6, 0.14, 0));
  const ribbon = at(box(0.11, 0.012, 0.62, 0.004, "#8E8A86"), -0.48, 0.02, 1.32);
  ribbon.rotation.y = 0.25;
  g.add(ribbon);
  const note = at(box(0.6, 0.02, 0.6, 0.01, COL.stickies[1]), -0.3, 0.27, 0.45);
  note.rotation.y = -0.18;
  g.add(note);
  return g;
}

// a Galaxy S24 lying face down in a light beige case: three cameras in a
// column at the top left
function buildPhone() {
  const g = new THREE.Group();
  g.add(at(box(0.76, 0.1, 1.54, 0.05, COL.phoneCase, { rough: 0.7 }), 0, 0.05, 0));
  for (let i = 0; i < 3; i++) {
    const z = -0.56 + i * 0.22;
    g.add(at(cyl(0.085, 0.085, 0.035, "#BDB5AA", { rough: 0.25, metal: 0.7 }), -0.2, 0.115, z));
    g.add(at(cyl(0.058, 0.058, 0.04, "#1C1A19", { rough: 0.1 }), -0.2, 0.12, z));
  }
  g.add(at(cyl(0.03, 0.03, 0.02, "#E9E3D8", { rough: 0.4 }), -0.02, 0.105, -0.56)); // flash
  return g;
}

function buildStickies() {
  const g = new THREE.Group();
  COL.stickies.forEach((c, i) => {
    const n = at(box(0.66, 0.03, 0.66, 0.01, c), i * 0.08, 0.016 + i * 0.031, -i * 0.05);
    n.rotation.y = [0.1, -0.25, 0.32][i];
    g.add(n);
  });
  return g;
}

// over-ear headphones lying flat on the desk, cushions down: silver body,
// brown cushions and headband padding
function buildHeadphones() {
  const g = new THREE.Group();
  const silver = mat(COL.phones, { rough: 0.3, metal: 0.55 });
  const brown = mat(COL.phonesPad, { rough: 0.75 });
  for (const s of [-1, 1]) {
    const cushion = roundCylinder(0.44, 0.18, 0.08, COL.phonesPad);
    cushion.material = brown;
    g.add(at(cushion, s * 0.66, 0.09, 0));
    const shell = roundCylinder(0.41, 0.22, 0.09, COL.phones);
    shell.material = silver;
    g.add(at(shell, s * 0.66, 0.28, 0));
    // the yoke and slider that join the cup to the band
    g.add(at(box(0.16, 0.12, 0.3, 0.05, silver), s * 0.66, 0.16, -0.4));
  }
  // the band lies flat, arching back from the cups
  const band = mesh(new THREE.TorusGeometry(0.66, 0.075, 14, 48, Math.PI), silver);
  band.rotation.x = -Math.PI / 2;
  band.position.set(0, 0.08, -0.04);
  g.add(band);
  const pad = mesh(new THREE.TorusGeometry(0.57, 0.085, 14, 40, Math.PI * 0.72), brown);
  pad.rotation.set(-Math.PI / 2, 0, Math.PI * 0.14);
  pad.position.set(0, 0.09, -0.04);
  g.add(pad);
  return g;
}

function buildCoffee() {
  const g = new THREE.Group();
  const cup = mesh(new THREE.CylinderGeometry(0.44, 0.34, 1.2, 40, 1, true), mat("#FFFFFF", { rough: 0.15, opacity: 0.32 }), { cast: false });
  cup.position.y = 0.6;
  cup.renderOrder = 2;
  g.add(cup);
  g.add(at(cyl(0.34, 0.34, 0.03, "#FFFFFF", { opacity: 0.4 }), 0, 0.015, 0));
  g.add(at(cyl(0.4, 0.32, 0.86, COL.coffee, { rough: 0.35 }), 0, 0.45, 0));
  g.add(at(cyl(0.41, 0.4, 0.14, COL.cream, { rough: 0.4 }), 0, 0.92, 0));
  for (const [x, z, r] of [[-0.12, 0.08, 0.3], [0.14, -0.1, 0.9], [0.05, 0.16, 1.6]]) {
    const ice = at(box(0.24, 0.22, 0.24, 0.05, "#FFFFFF", { rough: 0.1, opacity: 0.7 }), x, 1.0, z);
    ice.rotation.set(r * 0.4, r, r * 0.2);
    g.add(ice);
  }
  const straw = at(cyl(0.045, 0.045, 1.5, COL.straw, { rough: 0.4 }, 12), 0.1, 1.05, 0.05);
  straw.rotation.set(0.12, 0, -0.2);
  g.add(straw);
  return g;
}

/* ---------- public ---------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const v3 = (a) => new THREE.Vector3(...a);

export function createScene(canvas, { mobile = false, screenCanvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight("#FFF6EC", "#C8A385", 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#FFF0DF", 2.4);
  sun.position.set(-7, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#F5E6D6", 0.6);
  fill.position.set(8, 5, -6);
  scene.add(fill);

  // a round rug grounds the scene; the rest of the floor only takes shadow
  const rug = at(mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.06, 64), mat(COL.rug, { rough: 0.95 }), { cast: false }), 0, 0.03, -1.2);
  scene.add(rug);
  const floor = mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.14 }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const desk = buildDesk();
  scene.add(desk);
  const chair = at(buildChair(), 0, 2.0, -3.5);
  scene.add(chair);
  const avatar = buildAvatar();
  at(avatar.group, 0, 2.03, -3.4); // a hair above the seat, so the surfaces never fight
  scene.add(avatar.group);

  const laptop = buildLaptop(screenCanvas);
  at(laptop.group, 0, 3.2, -0.15);
  scene.add(laptop.group);
  const coffee = at(buildCoffee(), 2.6, 3.2, -0.9);
  scene.add(coffee);
  const tumbler = at(buildTumbler(), 3.6, 3.2, 0.75);
  tumbler.rotation.y = -0.5;
  scene.add(tumbler);
  const notebook = at(buildNotebook(), -3.35, 3.2, 1.3);
  notebook.scale.setScalar(0.76);
  notebook.rotation.y = 0.2;
  scene.add(notebook);
  const stickies = at(buildStickies(), -1.95, 3.2, 1.45);
  scene.add(stickies);
  const phones = at(buildHeadphones(), -3.05, 3.2, -0.25);
  phones.rotation.y = 0.35;
  scene.add(phones);
  const phone = at(buildPhone(), 2.15, 3.2, 1.35);
  phone.rotation.y = -0.38;
  scene.add(phone);


  // the build-in after the greeting: each piece pops up from its base, in
  // order (delays are fractions of the intro)
  const pops = [
    [rug, 0], [desk, 0.08], [chair, 0.18], [avatar.group, 0.3], [laptop.group, 0.44],
    [phones, 0.52], [notebook, 0.58], [stickies, 0.64], [phone, 0.67], [coffee, 0.7], [tumbler, 0.76],
  ].map(([obj, delay]) => ({ obj, delay, base: obj.scale.clone() }));
  const backOut = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  let introShown = -1;
  function setIntro(v) {
    if (v === introShown) return;
    introShown = v;
    for (const { obj, delay, base } of pops) {
      const t = seg(v, delay, delay + 0.24);
      obj.visible = t > 0;
      obj.scale.copy(base).multiplyScalar(t >= 1 ? 1 : Math.max(0.0001, backOut(t)));
    }
  }

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const view = { w: 1, h: 1, aspect: 1 };

  // where the camera ends: square on to the open screen, filling the frame
  const screenPose = { center: new THREE.Vector3(), normal: new THREE.Vector3(), up: new THREE.Vector3(), pos: new THREE.Vector3() };
  // measure the laptop open and at full size, whatever the build-in and
  // the lid are doing right now
  function openLaptop() {
    const keep = { angle: laptop.lid.rotation.x, scale: laptop.group.scale.clone() };
    laptop.lid.rotation.x = LID_OPEN;
    laptop.group.scale.set(1, 1, 1);
    laptop.group.updateMatrixWorld(true);
    return () => {
      laptop.lid.rotation.x = keep.angle;
      laptop.group.scale.copy(keep.scale);
      laptop.group.updateMatrixWorld(true);
    };
  }

  function computeScreenPose() {
    const restore = openLaptop();
    const m = laptop.screen.matrixWorld;
    screenPose.center.setFromMatrixPosition(m);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    screenPose.normal.set(0, 0, 1).applyQuaternion(q);
    screenPose.up.set(0, 1, 0).applyQuaternion(q);
    restore();
    const t = Math.tan((FOV_SCREEN * Math.PI) / 360);
    const d = Math.min(SCREEN_H / 2 / t, SCREEN_W / 2 / (t * view.aspect)) * 0.97;
    screenPose.pos.copy(screenPose.center).addScaledVector(screenPose.normal, d);
  }

  // portrait frames: step back so the desk still fits
  function fitted(k) {
    const f = Math.min(1.8, Math.max(1, Math.pow(1.55 / view.aspect, 0.6)));
    const t = v3(k.target);
    return { pos: t.clone().add(v3(k.pos).sub(t).multiplyScalar(f)), target: t };
  }

  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: FOV };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  let curve = null, targets = null;
  function buildPaths() {
    const k = K.map(fitted);
    curve = new THREE.CatmullRomCurve3([k[1].pos, k[2].pos, k[3].pos], false, "centripetal");
    targets = new THREE.CatmullRomCurve3([k[1].target, k[2].target, k[3].target], false, "centripetal");
    cam.k = k;
  }

  // the timeline (progress 0..1 through the pinned hero)
  const T = { orbit: [0.46, 0.66], dolly: [0.64, 0.88], lid: [0.62, 0.84] };

  function camAt(p, pointer) {
    const k = cam.k;
    let fov = FOV;
    cam.up.set(0, 1, 0);
    if (p < T.orbit[0]) {
      const t = ease(seg(p, 0.0, 0.4));
      cam.pos.lerpVectors(k[0].pos, k[1].pos, t);
      cam.target.lerpVectors(k[0].target, k[1].target, t);
      // a little parallax with the pointer while the type is on screen
      cam.pos.x += pointer.x * 0.6;
      cam.pos.y -= pointer.y * 0.35;
    } else if (p < T.dolly[0]) {
      const t = ease(seg(p, T.orbit[0], T.orbit[1]));
      curve.getPoint(t, cam.pos);
      targets.getPoint(t, cam.target);
    } else {
      const t = ease(seg(p, T.dolly[0], T.dolly[1]));
      // over the head, then down to the screen
      const a = k[3].pos, b = screenPose.pos;
      const c = tmpA.set((a.x + b.x) / 2 + 0.8, Math.max(a.y, b.y) + 0.6, (a.z + b.z) / 2 + 1.2);
      cam.pos.set(0, 0, 0)
        .addScaledVector(a, (1 - t) * (1 - t))
        .addScaledVector(c, 2 * t * (1 - t))
        .addScaledVector(b, t * t);
      cam.target.lerpVectors(k[3].target, screenPose.center, ease(seg(t, 0, 0.7)));
      cam.up.lerp(screenPose.up, t).normalize();
      fov = FOV + (FOV_SCREEN - FOV) * t;
    }
    cam.fov = fov;
  }

  // the screen's rect on the frame once the camera has arrived (frame px)
  function finalScreenRect() {
    const cam = new THREE.PerspectiveCamera(FOV_SCREEN, view.aspect, 0.1, 200);
    cam.position.copy(screenPose.pos);
    cam.up.copy(screenPose.up);
    cam.lookAt(screenPose.center);
    cam.updateMatrixWorld();
    const restore = openLaptop();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const v = new THREE.Vector3((cx * SCREEN_W) / 2, (cy * SCREEN_H) / 2, 0).applyMatrix4(laptop.screen.matrixWorld).project(cam);
      const px = ((v.x + 1) / 2) * view.w, py = ((1 - v.y) / 2) * view.h;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    restore();
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // a point just above and to the right of your head, in frame px: where
  // the speech bubble comes from
  const anchor = new THREE.Vector3();
  function headPoint(ox = 0.5, oy = 0.9) {
    avatar.head.updateWorldMatrix(true, false);
    anchor.set(ox, oy, 0).applyMatrix4(avatar.head.matrixWorld).project(camera);
    return { x: ((anchor.x + 1) / 2) * view.w, y: ((1 - anchor.y) / 2) * view.h };
  }

  function resize(w, h) {
    view.w = w; view.h = h; view.aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = view.aspect;
    computeScreenPose();
    buildPaths();
  }

  let lidAngle = 0;
  function update(p, time, pointer = { x: 0, y: 0 }, intro = 1) {
    setIntro(intro);
    camAt(p, pointer);
    camera.position.copy(cam.pos);
    camera.up.copy(cam.up);
    camera.lookAt(cam.target);
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov;
    }
    camera.updateProjectionMatrix();

    lidAngle = ease(seg(p, T.lid[0], T.lid[1])) * LID_OPEN;
    laptop.lid.rotation.x = lidAngle;

    // idle: a breath, a small turn of the head, typing-ready hands
    const still = p > T.dolly[0];
    const t = still ? 0 : time;
    avatar.torso.scale.y = 1 + 0.012 * Math.sin(t * 1.6);
    avatar.head.rotation.y = 0.12 * Math.sin(t * 0.45) - (p > 0.4 ? 0.05 : 0);
    avatar.head.rotation.x = 0.05 * Math.sin(t * 0.7 + 1) + ease(seg(p, 0.5, 0.7)) * 0.18;
    avatar.head.position.y = HEAD_Y + 0.012 * Math.sin(t * 1.6);
    avatar.arms.forEach((a, i) => (a.rotation.x = ARM_X + 0.03 * Math.sin(t * 2.2 + i * 1.7)));
  }

  // compile every material's shader now (all pieces are still visible
  // here), so no piece stalls a frame when it first appears in the build-in
  try { renderer.compile(scene, camera); } catch (e) {}

  return {
    camera,
    laptop,
    resize,
    update,
    render() { renderer.render(scene, camera); },
    timeline: T,
    finalScreenRect,
    headPoint,
    dispose() {
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.map) o.material.map.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}
