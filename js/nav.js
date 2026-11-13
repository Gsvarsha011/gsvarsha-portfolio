/* Navigation: the slab, the current section, and the Resume placeholder.
 * The slab means one thing: where you are. It sits under the current section
 * and never follows the pointer; hover has its own look (css/base.css).
 * A link to a section jumps there, with no scroll to watch: softJump crossfades
 * the two views (css/base.css). On a case study Work stays selected: its link
 * carries aria-current in the markup and goes back to the projects. */
(() => {
  // true: the PDF is at assets/G-S-Varsha-Resume.pdf (false shows "soon")
  const RESUME_READY = true;

  const nav = document.querySelector(".dock__nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll(".dock__link")];

  // how you last moved: a tap or click (pointer) or the keyboard (key). The
  // header shows its focus rings only for the keyboard (css/base.css): some
  // browsers ring a link after it is tapped
  const input = (how) => () => document.documentElement.setAttribute("data-input", how);
  addEventListener("pointerdown", input("pointer"), { passive: true, capture: true });
  addEventListener("keydown", input("key"), { passive: true, capture: true });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  window.softJump = (go) => {
    if (document.startViewTransition && !reduce.matches) document.startViewTransition(go);
    else go();
  };

  // every Resume link (the nav's and the footer's) until the PDF is in place
  document.querySelectorAll("[data-resume]").forEach((resume) => {
    if (RESUME_READY) return;
    resume.setAttribute("aria-disabled", "true");
    resume.removeAttribute("href");
    resume.removeAttribute("target");
    resume.setAttribute("role", "link");
    resume.setAttribute("tabindex", "0");
    resume.insertAdjacentHTML("beforeend", ' <span class="dock__soon">· soon</span>');
  });

  // the slab rests under the current section's link
  const caseLink = nav.querySelector('.dock__link[aria-current="true"]');
  let current = caseLink;
  const moveTo = (link) => {
    if (!link) {
      nav.removeAttribute("data-slab-on");
      return;
    }
    const n = nav.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    nav.style.setProperty("--slab-x", `${r.left - n.left - 1}px`);
    nav.style.setProperty("--slab-w", `${r.width}px`);
    nav.setAttribute("data-slab-on", "");
  };
  // a mouse click leaves no focus ring behind; the keyboard keeps it
  links.forEach((link) => link.addEventListener("click", (e) => e.detail && link.blur()));

  // Work is "current" while the projects are on screen (in the scroll
  // sequence hero.js announces it, on the still page we watch the panel);
  // About while About, the toolset or Beyond the pixels crosses the middle
  // of the screen; Contact while the footer is well on screen
  const work = document.getElementById("work");
  const about = document.getElementById("about");
  const aboutParts = [about, document.querySelector("[data-kit]"), document.querySelector("[data-beyond]")].filter(Boolean);
  const aboutHits = new Set();
  const workLink = nav.querySelector('[data-section-link="work"]');
  const aboutLink = nav.querySelector('[data-section-link="about"]');
  const contactLink = nav.querySelector('.dock__link[href="#contact"]');
  // arriving at the projects from a case study: Work is current from the start
  const arriving = location.hash === "#work";
  let workOn = arriving, workInView = arriving, aboutOn = false, contactOn = false;
  // the header's blur: never over the hero; it comes in with the projects
  // and stays from there on (on a case study, once you scroll)
  const blur = document.querySelector("[data-dock-blur]");
  const syncBlur = () => {
    if (!blur) return;
    const pastWork = work && work.getBoundingClientRect().bottom < innerHeight * 0.5;
    blur.toggleAttribute("data-on", work ? (workOn && workInView) || aboutOn || pastWork : scrollY > 8);
  };
  const update = () => {
    const pick = contactOn ? contactLink : aboutOn ? aboutLink : workOn && workInView ? workLink : caseLink;
    for (const l of [workLink, aboutLink, contactLink, caseLink]) {
      if (!l) continue;
      l === pick ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current");
    }
    current = pick;
    moveTo(current);
    syncBlur();
  };
  const setWork = (on) => {
    workOn = on;
    update();
  };
  document.addEventListener("work:visible", (e) => setWork(e.detail));
  if (work && !document.documentElement.classList.contains("motion")) {
    new IntersectionObserver((es) => setWork(es[es.length - 1].isIntersecting), { threshold: 0.35 }).observe(work);
  }
  // hero.js says when the projects take over, but not when you scroll past
  // them, so Work also needs its section to still be on screen
  if (work) {
    new IntersectionObserver((es) => {
      workInView = es[es.length - 1].isIntersecting;
      update();
    }).observe(work);
  }
  if (aboutParts.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? aboutHits.add(e.target) : aboutHits.delete(e.target)));
      aboutOn = aboutHits.size > 0;
      update();
    }, { rootMargin: "-45% 0px -45% 0px" });
    aboutParts.forEach((el) => io.observe(el));
  }
  const foot = document.getElementById("contact");
  if (foot && contactLink) {
    new IntersectionObserver((es) => {
      contactOn = es[es.length - 1].isIntersecting;
      update();
    }, { rootMargin: "0px 0px -35% 0px" }).observe(foot);
  }
  // the header's soft blur: as tall as the header (and a fade below it)
  const header = document.querySelector("[data-dock]");
  if (header && blur) {
    new ResizeObserver(() => document.documentElement.style.setProperty("--dock-h", `${header.offsetHeight}px`)).observe(header);
    addEventListener("scroll", syncBlur, { passive: true });
    syncBlur();
  }

  // links to a section on this page (About, and Contact: the footer): a
  // jump there; About's own top padding keeps it clear of the header
  document.querySelectorAll('a[href="#about"], a[href="#contact"]:not([data-locked])').forEach((a) =>
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      softJump(() => {
        if (target.id === "contact") scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
        else target.scrollIntoView({ behavior: "instant", block: "start" });
      });
      history.replaceState(null, "", a.getAttribute("href"));
    })
  );
  addEventListener("resize", () => moveTo(current));
  // a case study has no sections to watch, so the slab rests under Work from
  // the first frame, already in place (this script holds the first paint
  // there); arriving back at the projects it starts there too
  if (!work || arriving) {
    if (arriving) { current = workLink; workLink.setAttribute("aria-current", "true"); }
    const slab = nav.querySelector("[data-slab]");
    slab.style.transition = "none";
    moveTo(current);
    requestAnimationFrame(() => requestAnimationFrame(() => (slab.style.transition = "")));
    document.fonts?.ready.then(() => moveTo(current));
  }

  // phones: the menu button opens the links; a link, Esc or a tap outside closes it
  const dock = document.querySelector("[data-dock]");
  const burger = dock.querySelector("[data-burger]");
  if (burger) {
    const setOpen = (on) => {
      dock.toggleAttribute("data-open", on);
      burger.setAttribute("aria-expanded", String(on));
    };
    burger.addEventListener("click", () => setOpen(!dock.hasAttribute("data-open")));
    links.forEach((l) => l.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dock.hasAttribute("data-open")) {
        setOpen(false);
        burger.focus();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (dock.hasAttribute("data-open") && !nav.contains(e.target) && !burger.contains(e.target)) setOpen(false);
    });
    addEventListener("scroll", () => dock.hasAttribute("data-open") && setOpen(false), { passive: true });
  }
})();
