/* The cursor: a terracotta dot that follows the pointer (css/cursor.css).
 *
 * Over anything you can click (the home page's project cards included) it
 * opens into a larger, see-through ring, so what's under it still reads.
 *
 * Only for a mouse or trackpad: on touch screens the system's own handling
 * stays. Text fields keep the normal pointer, and the dot steps aside there.
 * The dot sits exactly on the pointer, moved straight from the pointer's own
 * event: easing it after the pointer reads as lag, and a frame-loop would
 * wait behind the hero's 3D scene. Only its size eases (css/cursor.css).
 *
 * An open dialog (the badminton game) sits in the browser's top layer, above
 * anything on the page, so the dot is a popover: that puts it in the top
 * layer too, and it goes back in after a dialog opens to stay above it.
 * Browsers without popovers keep the system pointer everywhere.
 */
(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (!("popover" in HTMLElement.prototype)) return;

  const CLICKABLE = 'a[href], button:not(:disabled), [role="button"], label[for], summary, select, [data-case]';
  const NATIVE = 'input, textarea, [contenteditable="true"]';

  const dot = document.createElement("div");
  dot.className = "cursor";
  dot.setAttribute("aria-hidden", "true");
  dot.popover = "manual";
  document.body.append(dot);
  dot.showPopover();
  document.documentElement.classList.add("has-cursor");

  // the top layer stacks in the order things enter it
  const raise = new MutationObserver(() => { dot.hidePopover(); dot.showPopover(); });
  document.querySelectorAll("dialog").forEach((d) => raise.observe(d, { attributeFilter: ["open"] }));

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    dot.classList.add("is-on");
  }, { passive: true });

  // what's under it
  addEventListener("pointerover", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const native = t && t.closest(NATIVE);
    dot.classList.toggle("is-hidden", !!native);
    dot.classList.toggle("is-link", !native && !!(t && t.closest(CLICKABLE)));
  });

  // out of the window, and back
  document.documentElement.addEventListener("pointerleave", () => dot.classList.remove("is-on"));
  addEventListener("blur", () => dot.classList.remove("is-on"));
  addEventListener("pointerdown", () => dot.classList.add("is-down"));
  addEventListener("pointerup", () => dot.classList.remove("is-down"));
})();
