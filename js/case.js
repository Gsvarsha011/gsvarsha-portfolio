/* The case studies.
 *
 * The contents (.toc): its links are plain anchors to each section's id, so
 * they work without this script. A click jumps there through softJump
 * (js/nav.js). Here, the section being read is marked
 * aria-current="location". A thin line across the screen, 30% from the top,
 * says which section that is: the sections follow one another with no gaps,
 * so exactly one crosses it at a time (no flicker between neighbours). A
 * click marks its section at once and holds that until the scroll it starts
 * has finished. On tablets and phones the contents are a bar of links; the
 * current one is kept in view in it.
 *
 * The header's blur comes in once the page has scrolled, so nothing at the
 * very top sits under it.
 *
 * Carousels (.car): a row of screens that snaps one at a time. The round
 * buttons step through it, the caption under it follows the screen in
 * view, and the buttons fade out at either end. Swiping, a trackpad and the
 * arrow keys (the row takes focus) scroll it natively; this only listens.
 * Without the script it is still a row you can swipe.
 *
 * Screen recordings (.motion): each plays only while it's on screen, so a
 * page of them doesn't run all at once. With reduced motion they stay on
 * their first frame, with controls to play one.
 *
 * Blocks rise in once as they come into view. With reduced motion, or
 * without IntersectionObserver, everything is simply there.
 *
 * A preview that stops early (SpatialLite): "Get in touch" opens a small
 * card with Email and LinkedIn ([data-contact], the Spatial Key card's look;
 * the addresses come from js/outro.js).
 */
const initCase = () => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  /* ---------- the contents ---------- */
  const toc = document.querySelector("[data-toc]");
  if (toc) {
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const list = toc.querySelector("ol");
    let held = 0;

    // stuck under the header (tablets and phones): its paper reaches up to
    // the top of the screen (css/case.css)
    const stick = () => toc.toggleAttribute("data-stuck", getComputedStyle(toc).position === "sticky" && toc.getBoundingClientRect().top <= parseFloat(getComputedStyle(toc).top) + 0.5 && scrollY > 0);
    addEventListener("scroll", stick, { passive: true });
    addEventListener("resize", stick);
    stick();

    const mark = (id) => {
      const on = byId.get(id);
      if (!on || on.getAttribute("aria-current") === "location") return;
      links.forEach((a) => a.removeAttribute("aria-current"));
      on.setAttribute("aria-current", "location");
      // in the bar (tablets, phones), keep the current link in view
      if (list && list.scrollWidth > list.clientWidth + 1) {
        const left = on.offsetLeft - (list.clientWidth - on.offsetWidth) / 2;
        list.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
      }
    };

    // a click: its section is current straight away, until the scroll ends
    const release = () => { held = 0; };
    toc.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const id = decodeURIComponent(a.hash.slice(1));
      softJump(() => document.getElementById(id).scrollIntoView({ behavior: "instant" }));
      history.replaceState(null, "", a.hash);
      mark(id);
      clearTimeout(held);
      held = setTimeout(release, 1200);
    });
    if ("onscrollend" in window) addEventListener("scrollend", () => { clearTimeout(held); release(); });

    if (hasIO && sections.length) {
      const io = new IntersectionObserver((entries) => {
        if (held) return;
        entries.forEach((en) => { if (en.isIntersecting) mark(en.target.id); });
      }, { rootMargin: "-30% 0px -69.9% 0px", threshold: 0 });
      sections.forEach((s) => io.observe(s));
    }
    // a page opened at a section, or at the top
    const start = decodeURIComponent(location.hash.slice(1));
    mark(byId.has(start) ? start : sections[0] && sections[0].id);
  }

  /* ---------- carousels ---------- */
  document.querySelectorAll("[data-car]").forEach((car) => {
    const track = car.querySelector("[data-car-track]");
    const slides = [...track.children];
    const prev = car.querySelector("[data-car-prev]");
    const next = car.querySelector("[data-car-next]");
    const count = car.querySelector("[data-car-count]");
    const cap = car.querySelector("[data-car-cap]");
    let at = 0;
    const show = (k) => {
      if (k === at) return;
      at = k;
      if (count) count.textContent = `${k + 1} / ${slides.length}`;
      if (cap) cap.innerHTML = slides[k].dataset.cap;
      prev.disabled = k === 0;
      next.disabled = k === slides.length - 1;
    };
    const go = (k) => {
      k = Math.max(0, Math.min(slides.length - 1, k));
      track.scrollTo({ left: slides[k].offsetLeft - slides[0].offsetLeft, behavior: reduce ? "auto" : "smooth" });
    };
    prev.addEventListener("click", () => go(at - 1));
    next.addEventListener("click", () => go(at + 1));
    // the screen nearest the middle is the one in view
    const step = () => (slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth);
    track.addEventListener("scroll", () => show(Math.round(track.scrollLeft / step())), { passive: true });
  });

  /* ---------- the recordings ---------- */
  const vids = document.querySelectorAll("[data-motion]");
  if (reduce || !hasIO) vids.forEach((v) => { v.controls = true; v.preload = "metadata"; });
  else {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach((v) => vio.observe(v));
  }

  /* ---------- the contact card ---------- */
  const card = document.querySelector("[data-contact]");
  if (card) {
    document.querySelectorAll("[data-contact-open]").forEach((b) => b.addEventListener("click", () => {
      card.showModal();
      card.focus(); // the card, not its close button
    }));
    card.querySelector("[data-contact-close]").addEventListener("click", () => card.close());
    card.addEventListener("click", (e) => {
      if (e.target === card) card.close(); // the backdrop
    });
  }

  /* ---------- rising in ---------- */
  const items = document.querySelectorAll("[data-reveal]");
  if (reduce || !hasIO || !items.length) return;
  document.documentElement.classList.add("js-reveal");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
  items.forEach((el) => io.observe(el));
};
initCase();
