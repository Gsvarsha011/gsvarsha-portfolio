/* Edit a frame exported from Figma, in a browser page (Playwright), then
   save it as WebP. A step up from swap-logo.js for frames where the logo
   is tilted, set in a particular face, or runs edge to edge.
     await page.addScriptTag({ path: "tools/frame-edit.js" })
     const url = await page.evaluate(o => frameEdit(o), { src, ops })
   ops, applied in order (all coordinates in the original's pixels):
     { wipe: [x0, y0, x1, y1] }
         refill each row of the box by blending the pixels just left and
         right of it, as swap-logo.js does: for a logo on a flat or
         vertically graded ground
     { fill: [x0, y0, x1, y1], from: x, ref: y, clip: [l, t, r, b, radius] }
         rebuild the ground under type that runs across a whole panel, so
         no pixels beside it are free: each row takes column `from`'s
         colour, shifted per column by how row `ref` (above the type)
         varies across. `from` must be clear of the type on every row;
         clip keeps the fill inside a rounded panel
     { text: "LOGO", x, y, size, weight, family, spacing, color, angle,
       align, scaleX, clip }
         draw text; y is the middle of the capitals, spacing is in em,
         angle in degrees (for a screen shown at a tilt), scaleX widens it
   Returns a WebP data URL at the original's full size. */
async function frameEdit({ src, ops = [], type = "image/webp", quality = 0.9 }) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);

  const roundRect = ([l, t, r, b, rad]) => {
    const p = new Path2D();
    p.roundRect(l, t, r - l, b - t, rad);
    return p;
  };

  for (const op of ops) {
    if (op.wipe) {
      const [x0, y0, x1, y1] = op.wipe;
      const d = g.getImageData(0, 0, W, H), p = d.data;
      for (let y = y0; y <= y1; y++) {
        const L = (y * W + (x0 - 2)) * 4, R = (y * W + (x1 + 2)) * 4;
        for (let x = x0; x <= x1; x++) {
          const t = (x - x0 + 2) / (x1 - x0 + 4), i = (y * W + x) * 4;
          for (let k = 0; k < 3; k++) p[i + k] = p[L + k] * (1 - t) + p[R + k] * t;
        }
      }
      g.putImageData(d, 0, 0);
    } else if (op.fill) {
      // each pixel = column `from` on its row, plus how far its own column
      // differed from `from` on row `ref` (clear of the type), so shading
      // across the panel, such as a darker rim, carries on through the box
      const [x0, y0, x1, y1] = op.fill, ref = op.ref ?? y0 - 4;
      const d = g.getImageData(0, 0, W, H), p = d.data;
      const at = (x, y, k) => p[(y * W + x) * 4 + k];
      const inside = (x, y) => {
        if (!op.clip) return true;
        const [l, t, r, b, rad] = op.clip;
        const cx = Math.min(Math.max(x + 0.5, l + rad), r - rad), cy = Math.min(Math.max(y + 0.5, t + rad), b - rad);
        return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad && x >= l && x < r && y >= t && y < b;
      };
      const delta = [];
      // averaged over a few rows, so grain in any one row doesn't streak down
      for (let x = x0; x <= x1; x++)
        delta[x] = [0, 1, 2].map(k => {
          let s = 0;
          for (let y = ref - 7; y <= ref; y++) s += at(x, y, k) - at(op.from, y, k);
          return s / 8;
        });
      for (let y = y0; y <= y1; y++) {
        const base = [0, 1, 2].map(k => at(op.from, y, k));
        for (let x = x0; x <= x1; x++) {
          if (!inside(x, y)) continue;
          const i = (y * W + x) * 4;
          for (let k = 0; k < 3; k++) p[i + k] = base[k] + delta[x][k];
        }
      }
      g.putImageData(d, 0, 0);
    } else if (op.text) {
      const { x, y, size, weight = 500, family = '"Helvetica Neue", Helvetica, Arial, sans-serif',
              spacing = 0.08, color = "rgba(255,255,255,0.94)", angle = 0, align = "left", scaleX = 1 } = op;
      await document.fonts.load(`${weight} ${size}px ${family}`);
      g.save();
      if (op.clip) g.clip(roundRect(op.clip));
      g.translate(x, y);
      g.rotate(angle * Math.PI / 180);
      g.scale(scaleX, 1);
      g.font = `${weight} ${size}px ${family}`;
      if ("letterSpacing" in g) g.letterSpacing = `${(size * spacing).toFixed(2)}px`;
      g.fillStyle = color;
      g.textAlign = align;
      g.textBaseline = "alphabetic";
      // put the middle of the capitals on y
      const m = g.measureText("H");
      g.fillText(op.text, 0, m.actualBoundingBoxAscent / 2);
      g.restore();
    }
  }
  return c.toDataURL(type, quality);
}
