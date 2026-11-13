/* Swap the client logo in a product screen for the word LOGO.
   Runs in a browser page (Playwright) served from the site, e.g.
     await page.addScriptTag({ path: "tools/swap-logo.js" })
     const url = await page.evaluate(o => swapLogo(o), {...})
   then save the data URL as a .webp in assets/work/<project>/.
   Options:
     src    the original screen (kept in incoming/)
     wipe   [x0, y0, x1, y1] the logo's box, in the original's pixels;
            each row is refilled by blending the pixels just left and right
            of it, so the badge's own colour or gradient carries through
     text   [cx, cy, size] where LOGO goes and its font size
     width  output width; leave it out to keep the original's full size
     type   output format, WebP by default
   Returns a data URL. Nothing outside the wiped box is touched. */
async function swapLogo({ src, wipe, text, width, type = "image/webp", quality = 0.9, color = "rgba(255,255,255,0.94)" }) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);

  // refill the logo's box row by row, from its left and right neighbours
  const [x0, y0, x1, y1] = wipe;
  const d = g.getImageData(0, 0, W, H), p = d.data;
  for (let y = y0; y <= y1; y++) {
    const L = (y * W + (x0 - 2)) * 4, R = (y * W + (x1 + 2)) * 4;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0 + 2) / (x1 - x0 + 4), i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) p[i + k] = p[L + k] * (1 - t) + p[R + k] * t;
    }
  }
  g.putImageData(d, 0, 0);

  const [cx, cy, size] = text;
  g.font = `500 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  if ("letterSpacing" in g) g.letterSpacing = `${(size * 0.08).toFixed(1)}px`;
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("LOGO", cx, cy + size * 0.04);

  if (!width || width === W) return c.toDataURL(type, quality);
  const o = document.createElement("canvas");
  o.width = width; o.height = Math.round(H * width / W);
  const og = o.getContext("2d");
  og.imageSmoothingQuality = "high";
  og.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL(type, quality);
}
