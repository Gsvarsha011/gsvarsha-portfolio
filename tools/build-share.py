#!/usr/bin/env python3
"""Pack the site into one self-contained HTML file you can send to anyone.

index.html on its own only *points* at css/, js/, fonts/ and assets/, so a
lone copy shows bare text. This writes share/GS-Varsha-Portfolio.html with
every stylesheet, script, the PP Fragment font and the project images inlined.
(DM Sans and the greeting's Tamil/Devanagari still load from Google Fonts.)

Run from this folder after any change:  python3 tools/build-share.py
"""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# refresh the lens's copies of the card pictures first (js/work-images.js)
import subprocess, sys
subprocess.run([sys.executable, str(ROOT / "tools" / "make-work-images.py")], check=False)
OUT = ROOT / "share" / "GS-Varsha-Portfolio.html"


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix == ".otf":
        mime = "font/otf"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def inline_css(path: Path) -> str:
    css = path.read_text()

    def repl(m):
        ref = m.group(1).strip("'\"")
        if ref.startswith(("data:", "http")):
            return m.group(0)
        return f'url("{data_uri((path.parent / ref).resolve())}")'

    return re.sub(r"url\(([^)]+)\)", repl, css)


html = (ROOT / "index.html").read_text()

# the font preload is no longer needed: the font is inside the CSS now
html = re.sub(r'\s*<link rel="preload" href="fonts/[^>]*>', "", html)

# stylesheets → <style>
html = re.sub(
    r'<link rel="stylesheet" href="(css/[^"]+)">',
    lambda m: f"<style>\n{inline_css(ROOT / m.group(1))}\n</style>",
    html,
)

# deferred scripts → inline at the end of <body>, same order (deferred
# scripts run after the page is parsed; inline ones there do the same)
scripts = re.findall(r'\s*<script defer src="(js/[^"]+)"></script>', html)
html = re.sub(r'\s*<script defer src="js/[^"]+"></script>', "", html)
def script_text(name: str) -> str:
    return (ROOT / name).read_text().replace("</script", "<\\/script")


body_js = "".join(f"\n<script>\n{script_text(s)}\n</script>" for s in scripts)
html = html.replace("</body>", body_js + "\n</body>")

# images → data URIs (one that isn't there yet, like the portrait, keeps
# its path, so the page shows its placeholder)
html = re.sub(
    r'src="(assets/[^"]+)"',
    lambda m: f'src="{data_uri(ROOT / m.group(1))}"' if (ROOT / m.group(1)).exists() else m.group(0),
    html,
)

# the resume: there's no assets/ folder beside the one file, so the PDF goes
# inside it, and the Resume links download it
pdf = ROOT / "assets" / "G-S-Varsha-Resume.pdf"
if pdf.exists():
    html = html.replace(
        'href="assets/G-S-Varsha-Resume.pdf" target="_blank" rel="noopener"',
        f'href="{data_uri(pdf)}" download="G-S-Varsha-Resume.pdf"',
    )

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html)
print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1e6:.1f} MB, {len(scripts)} scripts inlined")
