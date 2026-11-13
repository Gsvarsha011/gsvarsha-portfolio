// About, Toolkit and Beyond the pixels (see css/about.css).
//
//   story    one scene that plays with the scroll: the three statements take
//            turns in the middle of the screen, word by word; the last one
//            rises to the top as your portrait comes up, your character
//            steps in (and waves, and looks at the pointer) and a few lines
//            about you appear. The photo comes into focus once it's up.
//   kit      one sentence; when it comes into view three cursors fly in with
//            the logos, the words part to make room, and each logo drops in
//            beside its name. Plays by itself, once per visit.
//   beyond   a bento of tiles that rise in once: photographs and artwork
//            filled from the lists in index.html, each opening the gallery
//            at its picture (full size, ← → and close); On repeat, which
//            opens the songs; and drawings & paintings (their own gallery).
//
// The About scene follows the scroll position (eased), so it plays
// backwards too; the toolset plays by itself. With reduced motion: nothing pins; the statements, you and the sentence
// with its logos are simply there.
import * as THREE from "three";
import { buildCutout } from "./scene.js";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const span = (v, a, b) => clamp01((v - a) / (b - a));
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initAbout() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const story = document.querySelector("[data-story]");
  const me = story ? initCutout(story, reduce) : null;
  if (story) initStory(story, me, reduce);
  initKit(reduce);
  initBeyond(reduce);
}

// a pinned section's scroll progress: 0 as it pins, 1 as it lets go (and a
// little below 0 on the way in)
function pinProgress(section) {
  const r = section.getBoundingClientRect();
  const travel = r.height - innerHeight;
  return travel > 0 ? Math.max(-0.4, Math.min(1, -r.top / travel)) : 1;
}

// runs paint(p) eased toward the scroll position, only while the section is
// near the screen
function follow(section, target, paint, rate = 8) {
  let shown = null, raf = 0, last = 0, visible = false;
  function tick(now) {
    raf = 0;
    // never a negative step: after a long sleep or idle tab a frame can
    // carry a time from before \`last\`, and a negative step would push
    // \`shown\` to Infinity / NaN and freeze the scene for good
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const want = target();
    shown = shown === null || !Number.isFinite(shown) ? want : shown + (want - shown) * (1 - Math.exp(-dt * rate));
    if (Math.abs(want - shown) < 0.0003) shown = want;
    paint(shown);
    if (shown !== want && visible) raf = requestAnimationFrame(tick);
  }
  const near = () => {
    const r = section.getBoundingClientRect();
    return r.bottom > -0.3 * innerHeight && r.top < 1.3 * innerHeight;
  };
  const wake = () => {
    // a missed or stale "on screen" report must never freeze the scene:
    // check where it really is before giving up
    if (!visible) visible = near();
    if (raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  // several reports can come at once (a fast scroll or a jump): the last
  // one is where it is now
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; wake(); }, { rootMargin: "30% 0px" }).observe(section);
  addEventListener("scroll", wake, { passive: true });
  return () => { shown = null; visible = true; wake(); };
}

// =====================================================================
// About: one scene
// =====================================================================
function initStory(section, me, reduce) {
  const stage = section.querySelector(".story__stage");
  const label = section.querySelector("[data-story-label]");
  const lines = [...section.querySelectorAll("[data-line]")];
  const meet = section.querySelector("[data-meet]");
  const pic = section.querySelector("[data-meet-pic]");
  const photo = section.querySelector("[data-portrait]");
  const text = section.querySelector("[data-meet-text]");
  const meBox = section.querySelector("[data-story-me]");
  const phone = matchMedia("(max-width: 760px)");

  // each statement in words (still readable text), so they can rise in turn
  const words = lines.map((line) => {
    const list = line.textContent.trim().split(/\s+/);
    const spans = [];
    line.replaceChildren(...list.flatMap((word, i) => {
      const w = document.createElement("span");
      w.className = "w";
      const inner = document.createElement("span");
      inner.textContent = word;
      w.append(inner);
      spans.push(inner);
      return i ? [" ", w] : [w];
    }));
    return spans;
  });

  // your character looks at the pointer and waves when pointed at
  if (me) {
    section.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || reduce.matches) return;
      me.lookAtPoint(e.clientX, e.clientY);
    });
    section.addEventListener("pointerleave", () => me.rest());
    meBox.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") me.wave(); });
    meBox.addEventListener("pointerdown", () => me.wave());
  }

  if (reduce.matches || !("IntersectionObserver" in window)) return;
  section.classList.add("is-live");

  // when each statement comes in and goes out (out: null, it stays)
  const T = [[-0.24, -0.04, 0.12, 0.2], [0.16, 0.27, 0.36, 0.44], [0.4, 0.51, null, null]];
  let vh = 0, fs = 0, h1Size = 60, waved = false;
  const measure = () => {
    vh = stage.clientHeight;
    fs = parseFloat(getComputedStyle(lines[2]).fontSize) || 100;
    // the H1 size (--t-h1), measured
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font-size:var(--t-h1)";
    document.body.append(probe);
    h1Size = parseFloat(getComputedStyle(probe).fontSize) || h1Size;
    probe.remove();
  };

  function paint(p) {
    if (!vh) return;
    lines.forEach((line, i) => {
      const [ia, ib, oa, ob] = T[i];
      words[i].forEach((w, k) => {
        const d = k * 0.014;
        const inn = outCubic(span(p, ia + d, ib + d));
        const out = oa === null ? 0 : inOut(span(p, oa + d, ob + d));
        w.style.transform = `translate3d(0, ${((1 - inn) * 112 - out * 112).toFixed(2)}%, 0)`;
      });
      line.style.visibility = p < ia - 0.02 || (oa !== null && p > ob + 0.06) ? "hidden" : "";
    });

    // the last statement rises to the top, smaller, as you arrive
    const up = inOut(span(p, 0.57, 0.71));
    const small = h1Size; // it settles at the H1 size
    const to = (phone.matches ? 0.19 : 0.21) - 0.5;
    lines[2].style.transform = `translate3d(0, ${(to * vh * up).toFixed(1)}px, 0) scale(${lerp(1, small / fs, up).toFixed(4)})`;
    label.style.opacity = (1 - span(p, 0.55, 0.63)).toFixed(3);

    // you: the portrait comes up, then your character, then the words
    const rise = outCubic(span(p, 0.6, 0.79));
    const step = outCubic(span(p, 0.72, 0.85));
    const say = outCubic(span(p, 0.68, 0.83));
    meet.style.visibility = rise > 0 ? "" : "hidden";
    pic.style.transform = `translate3d(0, ${((1 - rise) * vh * 0.55).toFixed(1)}px, 0)`;
    photo.style.transform = `scale(${lerp(1.08, 1, rise).toFixed(4)})`;
    meBox.style.opacity = step.toFixed(3);
    meBox.style.transform = `translate3d(0, ${((1 - step) * 18).toFixed(2)}%, 0) scale(${(0.92 + step * 0.08).toFixed(4)})`;
    text.style.opacity = say.toFixed(3);
    text.style.transform = `translate3d(0, ${((1 - say) * 28).toFixed(1)}px, 0)`;

    // your photo comes into focus once it's up, and again each time you arrive
    if (rise > 0.85) photo.classList.add("is-in");
    else if (rise <= 0) photo.classList.remove("is-in");

    // your character waves the first time it's all the way in
    if (step > 0.97 && !waved) { waved = true; if (me) setTimeout(() => me.wave(), 200); }
    if (step < 0.2) waved = false;
  }

  const restart = follow(section, () => pinProgress(section), paint, 9);
  new ResizeObserver(() => { measure(); restart(); }).observe(stage);
  measure();
}

// =====================================================================
// Toolset: a sentence, and three cursors that bring the logos in
// =====================================================================
// It plays by itself, on a clock, when the section comes into view: each
// cursor flies in from its own edge carrying a logo; as it nears, the
// logo's place in the sentence opens and pushes the words apart; it drops
// the logo in, goes back for the next, and leaves when it's done.
function initKit(reduce) {
  const section = document.querySelector("[data-kit]");
  if (!section) return;
  const stage = section.querySelector("[data-kit-stage]");
  const line = section.querySelector("[data-kit-line]");
  const chips = [...line.querySelectorAll("[data-chip]")];
  const cursors = [...section.querySelectorAll("[data-kit-cursor]")];
  if (reduce.matches || !("IntersectionObserver" in window)) return;
  section.classList.add("is-live");

  // a copy of each logo to carry
  const flies = chips.map((c) => {
    const f = document.createElement("span");
    f.className = "kit__fly";
    f.setAttribute("aria-hidden", "true");
    f.hidden = true;
    f.append(...[...c.childNodes].map((n) => n.cloneNode(true)));
    stage.append(f);
    return f;
  });

  // who brings what (chip numbers in sentence order: Figma 0, Framer 1,
  // Claude 2, Illustrator 3, Photoshop 4, Cursor 5, Premiere Pro 6), and
  // when each cursor sets off (seconds)
  const PLAN = [
    { cursor: 0, delay: 0, chips: [0, 1, 5] }, // Designer, from the left
    { cursor: 1, delay: 0.45, chips: [2, 6] }, // Thinker, from the top right
    { cursor: 2, delay: 0.9, chips: [3, 4] }, // Maker, from below
  ];
  const TRAVEL = 1.15, DROP = 0.25, BACK = 0.75, TRIP = TRAVEL + DROP + BACK;
  const END = Math.max(...PLAN.map((pl) => pl.delay + pl.chips.length * TRIP)) + 0.2;
  const home = (i, w, h) => [[-60, h * 0.42], [w + 60, h * 0.18], [w * 0.62, h + 60]][i];

  let t0 = 0, raf = 0, played = false;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  function frame(now) {
    raf = 0;
    const t = Math.max(0, (now - t0) / 1000);
    const box = stage.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(line).fontSize) * 1.08;
    stage.style.setProperty("--chip", `${size}px`);
    const off = size * 0.5 + 4; // the cursor's tip sits up and to the left of what it carries
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    };
    const putFly = (f, [x, y], scale) => {
      f.hidden = false;
      f.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    };
    const putCursor = (c, [x, y], o) => {
      c.style.transform = `translate3d(${(x - off).toFixed(1)}px, ${(y - off).toFixed(1)}px, 0)`;
      c.style.opacity = o.toFixed(3);
    };

    PLAN.forEach((pl) => {
      const c = cursors[pl.cursor];
      const start = home(pl.cursor, box.width, box.height);
      const local = t - pl.delay;
      // what's already done is done, whatever the frame rate
      pl.chips.forEach((ci, k) => {
        if (local >= k * TRIP + TRAVEL + DROP * 0.6) {
          chips[ci].classList.add("is-open", "is-in");
          flies[ci].hidden = true;
        }
      });
      if (local < 0) { putCursor(c, start, 0); return; }
      const k = Math.floor(local / TRIP);
      if (k >= pl.chips.length) { putCursor(c, start, 0); return; }
      const u = local - k * TRIP;
      const ci = pl.chips[k];
      const chip = chips[ci], fly = flies[ci];
      const target = centre(chip);
      const fadeIn = k === 0 ? Math.min(1, local / 0.25) : 1;
      if (u < TRAVEL) {
        const e = inOut(u / TRAVEL);
        const pos = mix(start, target, e);
        pos[1] -= Math.sin(Math.PI * e) * size * 1.6; // a little arc
        if (e > 0.55) chip.classList.add("is-open"); // make room as it nears
        putFly(fly, pos, 1.12);
        putCursor(c, pos, fadeIn);
      } else if (u < TRAVEL + DROP) {
        chip.classList.add("is-open");
        const d = (u - TRAVEL) / DROP;
        if (d < 0.6) putFly(fly, target, 1.12 - 0.12 * outCubic(d / 0.6));
        putCursor(c, target, 1);
      } else {
        const e = inOut((u - TRAVEL - DROP) / BACK);
        const last = k === pl.chips.length - 1;
        putCursor(c, mix(target, start, e), last ? 1 - e : 1);
      }
    });

    if (t < END) raf = requestAnimationFrame(frame);
  }

  function play() {
    if (played) return;
    played = true;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // plays once per visit, when the sentence is well in view (a reload or a
  // new visit plays it again)
  new IntersectionObserver((es, io) => {
    if (!es[es.length - 1].isIntersecting) return;
    play();
    io.disconnect();
  }, { threshold: 0.6 }).observe(line);
}

// =====================================================================
// Beyond the pixels
// =====================================================================
function initBeyond(reduce) {
  const section = document.querySelector("[data-beyond]");
  if (!section) return;
  const collections = {};
  section.querySelectorAll("[data-source]").forEach((list) => {
    collections[list.dataset.source] = readCollection(list);
  });
  fillThumbs(section, collections);
  fillTracks(section);
  initGallery(section, collections, reduce);
  initSongs(section);

  // the tiles rise in once, each as it comes into view; those that arrive
  // together rise one after another (--i in index.html)
  if (reduce.matches || !("IntersectionObserver" in window)) return;
  const bento = section.querySelector("[data-bento]");
  if (!bento) return;
  section.classList.add("is-live");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  bento.querySelectorAll(".tile").forEach((t) => io.observe(t));
}

// the songs on repeat: the record opens them in a dialog
function initSongs(section) {
  const dlg = section.querySelector("[data-songs]");
  const open = section.querySelector("[data-open-songs]");
  if (!dlg || !open || !dlg.showModal) return;
  open.addEventListener("click", () => dlg.showModal());
  dlg.querySelector("[data-songs-close]").addEventListener("click", () => dlg.close());
  initPlayer(dlg);
  // a click outside the card closes it
  dlg.addEventListener("click", (e) => {
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
}

// the songs play right here, in a little player: the song playing on the
// left with its cover, the songs on the right, back, play and next under
// them. Each plays its Apple Music preview, about 30 seconds from the part
// Apple picks to show the song off (usually the chorus), for anyone: no
// sign-in. It fades in and out, then the next one plays; after the last it
// stops. Each preview and cover is written on its song in index.html
// (data-preview, data-cover), so nothing has to be looked up first; closing
// the songs pauses the song.
const FADE = 1.2; // seconds of fade at each end
function initPlayer(dlg) {
  const btns = [...dlg.querySelectorAll("[data-song]")];
  const $ = (s) => dlg.querySelector(s);
  const audio = $("[data-audio]");
  const art = $("[data-now-art]");
  const toggle = $("[data-toggle]");
  if (!btns.length || !audio || !art || !toggle) return;
  let at = 0;          // the song shown
  const clock = (n) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  btns.forEach((b) => { if (!b.dataset.preview) b.disabled = true; });

  const playing = (on) => {
    dlg.classList.toggle("is-playing", on);
    toggle.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  btns.forEach((b) => b.insertAdjacentHTML("beforeend", '<span class="track__eq" aria-hidden="true"><i></i><i></i><i></i></span>'));

  // show a song on the left (and mark it in the list)
  const show = (i) => {
    at = i;
    const btn = btns[i];
    btns.forEach((b) => b.setAttribute("aria-current", String(b === btn)));
    $("[data-now-song]").textContent = btn.querySelector(".track__song").textContent;
    $("[data-now-artist]").textContent = btn.querySelector(".track__artist").textContent;
    $("[data-now-at]").textContent = "0:00";
    $("[data-now-fill]").style.width = "0%";
    art.classList.remove("is-in");
    if (btn.dataset.cover) {
      art.onload = () => art.classList.add("is-in");
      art.src = btn.dataset.cover;
    }
  };

  // play a song from the start of its preview (straight from the click:
  // Safari won't start sound any later)
  const play = (i) => {
    show(i);
    if (!btns[i].dataset.preview) return;
    audio.src = btns[i].dataset.preview;
    audio.play().catch(() => playing(false));
  };
  const step = (by) => {
    for (let k = 1; k <= btns.length; k++) {
      const j = (at + by * k + btns.length * k) % btns.length;
      if (!btns[j].disabled) return play(j);
    }
  };

  // the bar, and a soft fade in and out
  audio.addEventListener("timeupdate", () => {
    const t = audio.currentTime, len = audio.duration || 30;
    $("[data-now-at]").textContent = clock(t);
    $("[data-now-len]").textContent = clock(len);
    $("[data-now-fill]").style.width = `${(t / len) * 100}%`;
    audio.volume = Math.max(0, Math.min(1, t / FADE, (len - t) / FADE));
  });
  audio.addEventListener("play", () => playing(true));
  audio.addEventListener("pause", () => playing(false));
  audio.addEventListener("ended", () => {
    playing(false);
    const next = btns.findIndex((b, j) => j > at && !b.disabled);
    if (next > -1) play(next);
  });

  btns.forEach((btn, i) => btn.addEventListener("click", () => play(i)));
  $("[data-prev]").addEventListener("click", () => step(-1));
  $("[data-next]").addEventListener("click", () => step(1));
  toggle.addEventListener("click", () => {
    if (!audio.src || audio.ended) play(at);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  // the first song is up, ready to play, as soon as the songs open (its
  // cover loads only then)
  const first = new MutationObserver(() => { if (dlg.open) { first.disconnect(); show(0); } });
  first.observe(dlg, { attributes: true, attributeFilter: ["open"] });
  dlg.addEventListener("close", () => audio.pause());
}

// a list in index.html, or numbered slots marked "to be added"
function readCollection(list) {
  const kinds = (list.dataset.kind || "Image").split(",").map((k) => k.trim());
  const items = [...list.querySelectorAll("li")].map((li, i) => {
    const im = li.querySelector("img");
    return {
      src: im ? im.getAttribute("src") : "",
      alt: im ? im.getAttribute("alt") || "" : "",
      w: im ? Number(im.getAttribute("width")) || 0 : 0,
      h: im ? Number(im.getAttribute("height")) || 0 : 0,
      cap: (li.querySelector("p") || {}).textContent || "",
      kind: li.dataset.kind || kinds[i % kinds.length],
    };
  });
  if (!items.length) {
    const n = Number(list.dataset.slots) || 3;
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      items.push({ slot: true, kind, label: `${kind} ${String(i + 1).padStart(2, "0")}`, cap: "" });
    }
  }
  return { title: list.dataset.title || "", items };
}

function slotEl(item, note = true) {
  const ph = document.createElement("span");
  ph.className = "ph";
  ph.innerHTML = `<b></b>${note ? "<small>to be added</small>" : ""}`;
  ph.querySelector("b").textContent = item.label;
  return ph;
}

function fillThumbs(section, collections) {
  section.querySelectorAll("[data-gallery-open]").forEach((btn) => {
    const c = collections[btn.dataset.galleryOpen];
    if (!c) return;
    btn.querySelectorAll("[data-thumb]").forEach((slot) => {
      const item = c.items[Number(slot.dataset.thumb)];
      if (!item) return;
      if (item.slot) {
        slot.prepend(slotEl(item));
        return;
      }
      const im = document.createElement("img");
      im.src = item.src;
      im.alt = "";
      im.decoding = "async";
      im.loading = "lazy";
      im.style.objectFit = "cover";
      slot.prepend(im);
    });
    const n = c.items.filter((i) => !i.slot).length;
    btn.setAttribute("aria-label", `${c.title}: ${n ? `${n} pictures` : "pictures to be added"}. Open the gallery`);
  });
}

// the songs on repeat; until they're added, empty lines and a plain note
function fillTracks(section) {
  const list = section.querySelector("[data-tracks]");
  if (!list || list.children.length) return;
  for (let i = 0; i < 4; i++) {
    const li = document.createElement("li");
    li.className = "is-slot";
    li.setAttribute("aria-hidden", "true");
    li.innerHTML = '<span class="track__song"></span><span class="track__artist"></span>';
    list.append(li);
  }
  const note = document.createElement("p");
  note.className = "repeat__empty";
  note.textContent = "Songs to be added";
  list.after(note);
}

// ---------- the gallery: one picture, full size, ← → and close ----------
// It opens at the picture of the tile it came from, with a plain fade.
function initGallery(section, collections, reduce) {
  const g = section.querySelector("[data-gallery]");
  if (!g) return;
  const $ = (s) => g.querySelector(s);
  const media = $("[data-g-media]");
  const count = $("[data-g-count]");
  const canvas = section.querySelector(".beyond__canvas");
  const root = document.documentElement;
  let items = [], at = 0, opener = null, name = "";

  function show(i, dir = 0) {
    at = (i + items.length) % items.length;
    const it = items[at];
    let el;
    if (it.slot) {
      el = slotEl(it);
      el.style.setProperty("--ar", name === "photography" && at % 2 === 0 ? "1.5" : "0.8");
    } else {
      el = document.createElement("img");
      el.src = it.src;
      el.alt = it.alt;
      if (it.w && it.h) {
        el.width = it.w; el.height = it.h;
        // its own shape, at about the same weight as the others (css/about.css)
        el.style.setProperty("--ar", String(it.w / it.h));
        el.style.setProperty("--sq", String(Math.sqrt(it.w / it.h)));
      }
    }
    if (dir && !reduce.matches) {
      el.classList.add("is-in");
      el.style.setProperty("--dir", String(dir));
    }
    media.replaceChildren(el);
    count.textContent = `${it.slot ? it.label + ", to be added" : it.alt || "Picture"}. ${at + 1} of ${items.length}`;
  }

  function open(which, from) {
    const c = collections[which];
    if (!c) return;
    name = which;
    items = c.items;
    opener = from;
    g.setAttribute("aria-label", c.title);
    show(Number(from.dataset.galleryAt) || 0);
    g.hidden = false;
    root.classList.add("has-gallery");
    canvas.inert = true;
    $("[data-g-next]").focus({ preventScroll: true });
  }

  function close() {
    if (g.hidden) return;
    g.hidden = true;
    media.replaceChildren();
    root.classList.remove("has-gallery");
    canvas.inert = false;
    if (opener) opener.focus({ preventScroll: true });
  }

  section.querySelectorAll("[data-gallery-open]").forEach((b) =>
    b.addEventListener("click", () => open(b.dataset.galleryOpen, b)));
  $("[data-g-close]").addEventListener("click", close);
  $("[data-g-prev]").addEventListener("click", () => show(at - 1, -1));
  $("[data-g-next]").addEventListener("click", () => show(at + 1, 1));
  // a click around the picture closes it
  g.addEventListener("click", (e) => { if (e.target === g) close(); });

  // keys: ← → to move, Esc to close, Tab stays inside
  g.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1, -1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1, 1); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") {
      const f = [...g.querySelectorAll("button")];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // touch: swipe the picture
  let sx = null;
  media.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  media.addEventListener("pointerup", (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
}

// =====================================================================
// your character: drawn only when something changes
// =====================================================================
function initCutout(section, reduce) {
  const canvas = section.querySelector("[data-cutout]");
  if (!canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    section.classList.add("no-cutout");
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#FFF6EC", "#C8A385", 1.55));
  // warm light from the left, as in the footer
  const sun = new THREE.DirectionalLight("#FFF0DF", 2.3);
  sun.position.set(-3.5, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 7, bottom: -2, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#F5E6D6", 0.55);
  fill.position.set(8, 5, 5);
  scene.add(fill);

  const me = buildCutout();
  me.group.rotation.y = 0.38; // turned a little toward the portrait
  me.group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  scene.add(me.group);
  // only a soft shadow at the feet, nothing else
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(19, 0.72, 0.1, 100);
  camera.position.set(0.6, 3.3, 17);
  camera.lookAt(0.4, 2.75, 0);

  // the head eases toward its target; the wave runs once from 0 to 1
  const look = { t: 0, x: 0, y: 0, tt: 0, tx: 0, ty: 0 };
  let wave = 1, raf = 0, last = 0, visible = false;
  function draw() {
    me.look(look.t, look.x, look.y);
    me.wave(wave);
    renderer.render(scene, camera);
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); // never negative (see follow)
    last = now;
    const k = 1 - Math.exp(-dt * 5);
    look.t += (look.tt - look.t) * k;
    look.x += (look.tx - look.x) * k;
    look.y += (look.ty - look.y) * k;
    if (wave < 1) wave = Math.min(1, wave + dt / 1.5);
    draw();
    const settled = wave >= 1 && Math.abs(look.tt - look.t) < 0.002 && Math.abs(look.tx - look.x) < 0.002 && Math.abs(look.ty - look.y) < 0.002;
    if (!settled && visible) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  }
  new ResizeObserver(() => requestAnimationFrame(size)).observe(canvas);
  new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible) wake();
  }).observe(canvas);

  return {
    look(x, y) { look.tt = 1; look.tx = x; look.ty = y; wake(); },
    lookAtPoint(px, py) {
      const r = canvas.getBoundingClientRect();
      this.look(
        Math.max(-1, Math.min(1, (px - (r.left + r.width * 0.5)) / (r.width * 2.2))),
        Math.max(-1, Math.min(1, (py - (r.top + r.height * 0.25)) / (r.height * 1.4))),
      );
    },
    rest() { look.tt = 0; wake(); },
    wave() {
      if (reduce.matches || wave < 1) return;
      wave = 0;
      wake();
    },
  };
}
