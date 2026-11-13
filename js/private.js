/* Office work (SpatialLite): what comes after The problem is locked.
 *
 * It's in the page encrypted ([data-sealed], made by tools/seal.mjs from the
 * password in tools/private-password.txt), so without the password there's
 * nothing to read, not even in the page's code. The card ([data-private])
 * asks for it: the right one opens the rest, remembered for this tab, and
 * the page reloads at the first section it opened (so js/case.js sets up
 * its contents, carousels and recordings as usual). A wrong one says so.
 *
 * js/case.js waits on window.caseReady, so a tab that already has the key
 * opens the rest before anything else is set up.
 */
(() => {
  const box = document.querySelector("[data-sealed]");
  const gate = document.querySelector("[data-private]");
  if (!box || !gate) return;
  const ITERATIONS = 310000; // as in tools/seal.mjs
  const KEY = `case-key:${location.pathname}`;
  const sealed = JSON.parse(box.textContent);
  const subtle = window.crypto && crypto.subtle;
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const text = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set: (v) => { try { sessionStorage.setItem(KEY, v); return true; } catch { return false; } },
    drop: () => { try { sessionStorage.removeItem(KEY); } catch {} },
  };

  const keyFrom = async (password) => {
    const base = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", salt: bytes(sealed.salt), iterations: ITERATIONS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  };
  const open = async (key) => {
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: bytes(sealed.iv) }, key, bytes(sealed.data));
    return JSON.parse(new TextDecoder().decode(plain));
  };
  // the rest takes the card's place, and its sections join the contents
  const show = ({ toc, html }) => {
    document.querySelector("[data-locked-toc]").outerHTML = toc;
    document.querySelector("[data-unsealed]").outerHTML = html;
    gate.remove();
    const at = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (at) at.scrollIntoView();
  };

  // a tab that already opened it: straight in
  const saved = store.get();
  if ("scrollRestoration" in history && saved) history.scrollRestoration = "manual";
  window.caseReady = (async () => {
    if (!saved || !subtle) return;
    try {
      show(await open(await subtle.importKey("raw", bytes(saved), "AES-GCM", false, ["decrypt"])));
    } catch {
      store.drop();
    }
  })();

  const form = gate.querySelector("[data-private-form]");
  const input = gate.querySelector("[data-private-input]");
  const error = gate.querySelector("[data-private-error]");
  const btn = form.querySelector("button");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    error.textContent = "";
    if (!subtle) {
      error.textContent = "This needs a secure (https) connection to open.";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Opening…";
    try {
      const key = await keyFrom(input.value);
      const rest = await open(key);
      const first = (rest.html.match(/<section[^>]* id="([^"]+)"/) || [])[1];
      if (store.set(text(await subtle.exportKey("raw", key)))) {
        history.replaceState(null, "", `#${first}`);
        location.reload();
      } else {
        // no storage (a private window): open it here, without the extras
        history.replaceState(null, "", `#${first}`);
        show(rest);
      }
    } catch {
      error.textContent = "That’s not the password. Try again?";
      gate.classList.remove("is-wrong");
      void gate.offsetWidth;
      gate.classList.add("is-wrong");
      input.select();
      btn.disabled = false;
      btn.textContent = "Read more";
    }
  });
})();
