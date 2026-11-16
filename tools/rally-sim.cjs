// Plays many rallies (tuning tool, not loaded by the page). The visitor's
// legs move on their own, so the bot only times Space, with a human-ish
// timing error (sigma, seconds).
// Usage: node tools/rally-sim.cjs "$PWD/js/rally-core.js" [sigma] [games] [seed]
// With [games], plays that many whole games and reports who won them.
const R = require(process.argv[2]);
const { C } = R;
const sigma = Number(process.argv[3] || 0.05);
const GAMES = Number(process.argv[4] || 0); // play whole games instead of 3000 rallies
let seed = Number(process.argv[5] || 12345);
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const g = R.newGame(rand);
R.start(g);
const st = { rallies: 0, you: 0, gs: 0, hits: 0, why: {}, games: { you: 0, gs: 0 }, smash: { you: 0, gs: 0 }, smashWon: { you: 0, gs: 0 } };
let lastShot = null;
let pressAt = null, pressedFor = null, hold = 0;
for (let step = 0; step < 120 * 60 * 60 * 1000 && (GAMES ? st.games.you + st.games.gs < GAMES : st.rallies < 3000); step++) {
  const you = g.you, s = g.shuttle;
  if (g.state === "over") R.start(g);
  let press = false;
  if (g.state === "serve" && s.held === "you" && g.timer > 0.6 && !you.swing) press = true;
  const p = g.me.plan;
  if (g.state === "rally" && p && !p.leave && pressedFor !== p) {
    if (pressAt === null) pressAt = p.at - p.lead + gauss() * sigma;
    if (g.t >= pressAt) { press = true; pressedFor = p; pressAt = null; }
  }
  if (!p) pressAt = null;
  you.input.swing = press || hold > 0;
  hold = press ? 2 : Math.max(0, hold - 1);
  R.update(g, C.DT);
  for (const e of g.events) {
    if (e.type === "hit") { st.hits++; lastShot = e; if (e.shot === "smash") st.smash[e.by]++; }
    if (e.type === "over") st.games[e.winner]++;
    if (e.type === "point") { st.rallies++; st[e.winner]++; if (lastShot && lastShot.shot === "smash" && lastShot.by === e.winner) st.smashWon[e.winner]++; const k = e.winner + ":" + e.why; st.why[k] = (st.why[k] || 0) + 1; }
  }
}
console.log(`sigma ${sigma}: rallies ${st.rallies}, GS won ${(100 * st.gs / st.rallies).toFixed(1)}%, hits/rally ${(st.hits / st.rallies).toFixed(1)}, games you ${st.games.you} GS ${st.games.gs}, smashes you ${st.smash.you} (won ${st.smashWon.you}) GS ${st.smash.gs} (won ${st.smashWon.gs})`, JSON.stringify(st.why));
