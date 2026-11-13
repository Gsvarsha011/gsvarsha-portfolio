"""Writes the case studies, work/*.html, from the project data below.

    python3 tools/make-cases.py

Each project is one entry in PROJECTS: its facts, optional links, and its
sections, each a list of blocks (helpers below). The contents on the left
of each page are made from the sections, so adding, renaming or removing a
section updates them. The site's own footer (and the badminton game) is
copied from index.html, so it stays the same as the home page's.

Rules for the words: they rest on the Portfolio V6 case-study copy, your
own project notes, the real screens and the source builds in the Portfolio
folder. Design reasoning is written as reasoning, never as a finding:
nothing about research, testing, metrics, dates, team or outcomes is
invented, and what is still unvalidated says so. Where material is still to
come, a placeholder (ph) says exactly what to add and where; see the
"ADD:" comments in the generated pages.

Links: `live` and `figma` are optional. Leave them None until there is a
real, shareable URL; nothing is shown for them until then. For `figma`,
say what it is: {"url": "...", "label": "View prototype"} or
{"url": "...", "label": "Explore the Figma file"}.
"""
import html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "work")
HERE = os.path.join(ROOT, "tools")
e = html.escape

# ---------------------------------------------------------------------------
# blocks
# ---------------------------------------------------------------------------


def img(src, w, h, alt, cls="plate__img", style="", lazy=True):
    load = 'loading="lazy" ' if lazy else 'fetchpriority="high" '
    st = f' style="{style}"' if style else ""
    return f'<img class="{cls}" src="{src}" alt="{e(alt)}" width="{w}" height="{h}" {load}decoding="async"{st}>'


def caption(title, text=""):
    """No line under a screen: the words around it do the explaining, and
    the alt text describes it. Kept so blocks can still pass a title."""
    return ""


def plate(src, w, h, alt, title, text="", bare=False, crop=None, lazy=True, tall=False, narrow=False):
    """A real image on a mat. crop: (ratio, object-position) to frame it.
    tall: a phone screen, kept narrower when the page stacks on a phone.
    narrow: a long page section, shown at about half the column so it
    doesn't run several screens deep."""
    cls, style = "plate__img", ""
    if crop:
        cls += " plate__img--crop"
        style = f"--ratio:{crop[0]};--pos:{crop[1]}"
    b = (" plate--bare" if bare else "") + (" plate--tall" if tall else "") + (" plate--narrow" if narrow else "")
    return f'''<figure class="plate{b}" data-reveal>
          <div class="plate__mat">{img(src, w, h, alt, cls, style, lazy)}</div>
          {caption(title, text)}
        </figure>'''


def ph(project, kind, what, path, ratio="16 / 10", required=True, note="", dark=False, bare=False, title=None):
    """A placeholder for an asset still to come, at the asset's shape.
    kind: e.g. "ADD FIGMA FRAME", "ADD FIGJAM EXPORT", "ADD IMAGE".
    To replace it: swap the <div class="ph"> for
      <img class="plate__img" src="<path>" alt="..." width=".." height="..">
    (keep the figure and caption around it)."""
    need = "Required for this section" if required else "Optional · only if available"
    d = " ph--dark" if dark else ""
    b = " plate--bare" if bare else ""
    n = f" {note}" if note else ""
    return f'''<!-- ADD: {project}: {what} ({kind.replace("ADD ", "").lower()}). {need}.
             Replace the .ph block below with the real image.
             Suggested path: {path}. Aspect ratio about {ratio.replace(" ", "")}.{n} -->
        <figure class="plate{b}" data-reveal>
          <div class="plate__mat"><div class="ph{d}" style="--ratio:{ratio}" role="img" aria-label="{e(kind.title())}: {e(what)} (to be added)">
            <span class="ph__in"><span class="tag ph__kind">{e(kind)}</span><span class="ph__what">{e(what)}</span><span class="ph__meta">{e(path)} · {e(ratio.replace(" ", ""))}</span><span class="tag ph__need">{e(need)}</span></span>
          </div></div>
          {caption(title or what)}
        </figure>'''


def lead(t):
    return f'<p class="lead" data-reveal>{e(t)}</p>'


def prose(*ps):
    return '<div class="prose" data-reveal>' + "".join(f"<p>{e(p)}</p>" for p in ps) + "</div>"


def pull(t):
    return f'<p class="pull" data-reveal>{e(t)}</p>'


def point(head, *ps, n=None):
    """A bold one-line takeaway, then the paragraphs that explain it.
    n: numbers it, for a run of problems or decisions."""
    num = f'<span class="point__n">{n}.</span> ' if n else ""
    return (f'<div class="point" data-reveal><h3>{num}{e(head)}</h3>'
            + "".join(f"<p>{e(p)}</p>" for p in ps) + "</div>")


def quote(text, who):
    """Something a user, client or mentor actually said, with who said it."""
    return (f'<figure class="quote" data-reveal><blockquote><p>{e(text)}</p></blockquote>'
            f"<figcaption>{e(who)}</figcaption></figure>")


def tbd(what, kind="Content"):
    """Room for words still to come: says what goes here, so it can be
    written in later. Shows on the page until it's replaced."""
    return (f"<!-- ADD: {e(what)} -->\n        "
            f'<div class="tbd" data-reveal><span class="tag tbd__tag">{e(kind)} to add</span><p>{e(what)}</p></div>')


def ruled(items):
    return '<ol class="ruled" data-reveal>' + "".join(f"<li>{e(i)}</li>" for i in items) + "</ol>"


def split(cols):
    """A labelled heading with a line under it, e.g. Craft's stage headings.
    cols: (tag, heading, text). One only: text never runs in side-by-side
    columns (it reads as a form, not a page); write prose instead."""
    if len(cols) != 1:
        sys.exit("split(): one column only; put side-by-side text into prose()")
    inner = "".join(f'<div><span class="tag">{e(t)}</span><h3>{e(h)}</h3>{f"<p>{e(p)}</p>" if p else ""}</div>' for t, h, p in cols)
    return f'<div class="split" style="--n:{len(cols)}" data-reveal>{inner}</div>'


def caption_lines(fig, width):
    """About how many lines a figure's caption takes in a column this wide
    (14px DM Sans runs about 7.2px a character)."""
    m = re.search(r"<figcaption>(.*?)</figcaption>", fig, re.S)
    if not m:
        return 0
    text = html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))
    per_line = max(1, int(width / 7.2))
    return -(-len(text) // per_line)


def duo(a, b, wide_left=False, ratios=None):
    """ratios: the two images' width / height, e.g. a laptop screen beside a
    phone: the columns are then sized so both images, and so both frames,
    stand exactly the same height (css/case.css works it out, frame
    padding and gap included). The two captions must wrap to the same
    number of lines at the full reading width, or the build stops: a
    one-line caption beside a three-line one looks unfinished. Shorten the
    longer one."""
    fr = list(ratios) if ratios else ([1.6, 1] if wide_left else [1, 1])
    room = 860 - 24  # the story's width (--story), less the gap
    la, lb = (caption_lines(f, room * w / sum(fr)) for f, w in zip((a, b), fr))
    if la != lb:
        sys.exit(f"duo(): captions wrap to {la} and {lb} lines; even them out:\n  "
                 + "\n  ".join(html.unescape(re.sub(r"<[^>]+>", "", m)) for m in re.findall(r"<figcaption>(.*?)</figcaption>", a + b, re.S)))
    cls = " duo--wide-left" if wide_left else " duo--match" if ratios else ""
    st = f' style="--ra:{ratios[0]:.4f};--rb:{ratios[1]:.4f}"' if ratios else ""
    return f'<div class="duo{cls}"{st}>{a}{b}</div>'


def row3(a, b, c):
    return f'<div class="row3">{a}{b}{c}</div>'


def labelled(label, block):
    return f'<div><span class="tag ba__label">{e(label)}</span>{block}</div>'


def annot(src, w, h, alt, title, notes):
    """notes: (x%, y%, heading, text): a pin on the screen and its note."""
    pins = "".join(f'<span class="annot__pin" style="--x:{x}%;--y:{y}%" aria-hidden="true">{i + 1}</span>' for i, (x, y, _, _) in enumerate(notes))
    items = "".join(f"<li><div><b>{e(t)}</b><p>{e(p)}</p></div></li>" for _, _, t, p in notes)
    return f'''<figure class="plate annot" data-reveal>
          <div class="plate__mat"><div class="annot__pic">{img(src, w, h, alt)}{pins}</div></div>
          <figcaption><ol>{items}</ol></figcaption>
        </figure>'''


def cardset(groups, title, text="", wall=False):
    """Interface cards at their real size, never scaled up, on a soft panel.
    groups: (label or None, [(src, w, h, dpr, alt, state or None)]): dpr is
    the export's scale (2 for a 2x export), so a card shows at w / dpr.
    Each group is a row: its label on a square sticky note first, then the
    cards, each with a small sticky above it for its state. Any text on a
    board is a FigJam-style sticky, never plain type.
    wall=True: one group laid out in columns, for many versions at once."""
    rows = []
    for label, items in groups:
        lis = ""
        for src, w, h, dpr, alt, st in items:
            state = f'<span class="sticky sticky--small">{e(st)}</span>' if st else ""
            lis += (f'<li>{state}<img src="{src}" alt="{e(alt)}" width="{w}" height="{h}" '
                    f'loading="lazy" decoding="async" style="width:{w / dpr:.0f}px"></li>')
        head = f'<span class="sticky sticky--note">{e(label)}</span>' if label else ""
        cls = "cardset__group" + (" cardset__group--labelled" if label else "")
        rows.append(f'<div class="{cls}">{head}<ul class="{"cardset__wall" if wall else "cardset__row"}">{lis}</ul></div>')
    return f'''<figure class="plate cardset" data-reveal>
          <div class="cardset__panel">{"".join(rows)}</div>
          {caption(title, text)}
        </figure>'''


def annot_pics(pics, title, notes):
    """annot() over several screens side by side, numbered in one run.
    pics: (src, w, h, alt, [(x%, y%)]): a pin per note, in order across them.
    notes: (heading, text). Columns follow the screens' ratios, so they stand
    the same height."""
    k, cells, cols = 0, [], []
    for src, w, h, alt, pins in pics:
        ps = ""
        for x, y in pins:
            k += 1
            ps += f'<span class="annot__pin" style="--x:{x}%;--y:{y}%" aria-hidden="true">{k}</span>'
        tall = " annot__pic--tall" if h > w else ""
        cells.append(f'<div class="annot__pic{tall}">{img(src, w, h, alt)}{ps}</div>')
        cols.append(f"{w / h:.3f}fr")
    items = "".join(f"<li><div><b>{e(t)}</b><p>{e(p)}</p></div></li>" for t, p in notes)
    return f'''<figure class="plate annot" data-reveal>
          <div class="plate__mat annot__pics" style="--cols:{" ".join(cols)}">{"".join(cells)}</div>
          <figcaption><ol>{items}</ol></figcaption>
        </figure>'''


def annot_ph(project, kind, what, path, ratio, title, notes, note=""):
    """annot() before its screen arrives: the slot, then the numbered notes.
    notes: (heading, text). Once the screen is in, swap this for annot()
    and place a pin for each note."""
    box = ph(project, kind, what, path, ratio, note=note)
    items = "".join(f"<li><div><b>{e(t)}</b><p>{e(p)}</p></div></li>" for t, p in notes)
    box = box.replace('<figure class="plate"', '<figure class="plate annot"', 1)
    return box.replace(caption(what), f"<figcaption><ol>{items}</ol></figcaption>")


CHEV = '<svg viewBox="0 0 8 12" aria-hidden="true"><path d="{}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
CHEV_L, CHEV_R = CHEV.format("M6.5 1 1.5 6l5 5"), CHEV.format("M1.5 1l5 5-5 5")


def carousel(slides, title=None):
    """Screens that belong together, one at a time in a frame, with round
    previous / next buttons on its edges and the screen's own caption under
    it (js/case.js). Without the script it is a row you swipe or scroll.
    slides: (src, w, h, alt, head, line): head in bold, then its line; a
    head of None takes the carousel's title. One slide: just the frame.
    The tallest screen sets the frame's shape; shorter ones sit centred."""
    _, w0, h0 = min((sl[:3] for sl in slides), key=lambda sl: sl[1] / sl[2])
    n = len(slides)
    cap = lambda hd, ln: e(ln or hd or title)
    items = "".join(
        f'<div class="car__slide" role="group" aria-roledescription="slide" aria-label="{k + 1} of {n}" data-cap="{e(cap(hd, ln))}">'
        f'{img(s, w, h, a, cls="car__img")}</div>'
        for k, (s, w, h, a, hd, ln) in enumerate(slides))
    many = n > 1
    btns = (f'<button class="car__btn car__btn--prev" type="button" aria-label="Previous screen" data-car-prev disabled>{CHEV_L}</button>'
            f'<button class="car__btn car__btn--next" type="button" aria-label="Next screen" data-car-next>{CHEV_R}</button>') if many else ""
    return f'''<figure class="car" style="--ratio:{w0} / {h0}" aria-roledescription="carousel" aria-label="{e(title or slides[0][4])}"{" data-car" if many else ""} data-reveal>
          <div class="car__frame">
            <div class="car__track"{' tabindex="0"' if many else ""} data-car-track>{items}</div>
            {btns}
          </div>

        </figure>'''


def board(steps):
    """A run of a page's sections as a carousel, each screen captioned with
    its label and heading. steps: (label, heading, text, src, w, h, alt)."""
    return carousel([(src, w, h, alt, lab, head + (f" {text}" if text else ""))
                     for lab, head, text, src, w, h, alt in steps])


def seq(items):
    """Versions in order: (src, w, h, alt, title)."""
    figs = "".join(plate(s, w, h, a, t, bare=True, crop=("16 / 10", "50% 0")) for s, w, h, a, t in items)
    return f'<div class="seq" style="--n:{len(items)}">{figs}</div>'


def tallpair(left, right, title, text=""):
    """A tall screen on the right, two (or more) wide ones stacked on the
    left, in one frame under one caption, so a long screen doesn't run
    several screens deep on its own. The columns follow the screens' ratios,
    so both sides stand the same height. left: [(src, w, h, alt)];
    right: (src, w, h, alt). Phones: one column, the tall one narrower."""
    lh = sum(h / w for _, w, h, _ in left)
    rh = right[2] / right[1]
    stack = "".join(img(s, w, h, a) for s, w, h, a in left)
    return f'''<figure class="plate tallpair" data-reveal>
          <div class="plate__mat tallpair__grid" style="--cols:{rh:.3f}fr {lh:.3f}fr">
            <div class="tallpair__stack">{stack}</div>
            <div class="tallpair__tall">{img(*right)}</div>
          </div>
          {caption(title, text)}
        </figure>'''


def motion(rows):
    """Screen recordings in rows, each on its own mat with a short caption,
    as the reference case study shows its motion: muted, looping, no
    controls. A row's clips are sized by their ratios so they all stand the
    same height whatever their shape (css/case.css); on phones they stack.
    js/case.js plays a clip only while it's on screen; with reduced motion
    they stay still on their first frame, with controls.
    rows: [[(src, poster, w, h, label, head, line), ...], ...]. A row's
    captions must wrap to the same number of lines, or the build stops."""
    room = 640  # the story's width on a laptop (1024), the narrowest with rows
    out = []
    for row in rows:
        rs = [w / h for _, _, w, h, *_ in row]
        figs = [f'''<figure class="plate motion__clip" style="--r:{r:.4f}">
            <div class="plate__mat"><video class="motion__vid" src="{s}" poster="{p}" width="{w}" height="{h}" muted loop playsinline preload="none" aria-label="{e(lab)}" data-motion></video></div>
            {caption(head, line)}
          </figure>''' for r, (s, p, w, h, lab, head, line) in zip(rs, row)]
        lines = {caption_lines(f, (room - 20 * (len(row) - 1)) * r / sum(rs)) for f, r in zip(figs, rs)}
        if len(lines) > 1:
            sys.exit("motion(): a row's captions wrap to different line counts; even them out:\n  "
                     + "\n  ".join(f"{c[5]}. {c[6]}" for c in row))
        out.append('<div class="motion__row">' + "".join(figs) + "</div>")
    return '<div class="motion" data-reveal>' + "".join(out) + "</div>"


def phones(screens, title, text="", n=4, stack=False):
    """Screens side by side in one frame, under one caption: n to a row; on
    a phone two to a row, or one under another with stack.
    screens: [(src, w, h, alt)]."""
    cls = " phones--stack" if stack else ""
    return f'''<figure class="plate" data-reveal>
          <div class="plate__mat phones{cls}" style="--n:{n}">{"".join(img(*sc) for sc in screens)}</div>
          {caption(title, text)}
        </figure>'''


def mockups(phones_, title, text=""):
    """Phone mockups cut out on transparency, straight on the page with no
    frame. phones_: [(src, w, h, alt)]."""
    pics = "".join(img(s_, w, h, a, cls="mockups__img") for s_, w, h, a in phones_)
    return f'''<figure class="plate" data-reveal>
          <div class="mockups">{pics}</div>
          {caption(title, text)}
        </figure>'''


def zoom(src, w, h, alt, pos="50% 50%", scale=1.3, note="", ratio="21 / 9"):
    return f'''<figure class="plate" data-reveal>
          <div class="plate__mat"><div class="zoom" style="--pos:{pos};--scale:{scale};--zr:{ratio}">{img(src, w, h, alt, cls="")}</div></div>

        </figure>'''


def flow(steps, title, note=""):
    """A journey drawn as steps in a row. steps: (name, question, shown):
    shown=True for steps a screen on the page already shows."""
    items = "".join(
        f'<li class="{"is-shown" if shown else ""}"><span class="flow__n">{k + 1:02d}</span><b>{e(n)}</b><span>{e(q)}</span></li>'
        for k, (n, q, shown) in enumerate(steps))
    t = f" {e(note)}" if note else ""
    return f'''<figure class="flow" style="--n:{len(steps)}" data-reveal>
          <ol>{items}</ol>

        </figure>'''


def funnel(cols, title, note=""):
    """Narrowing down, left to right. cols: (stage, [(name, detail)]); the
    last column is where it lands."""
    out = []
    for stage, items in cols:
        chips = "".join(f'<li><b>{e(n)}</b>{f"<span>{e(d)}</span>" if d else ""}</li>' for n, d in items)
        out.append(f'<div class="funnel__col"><span class="tag">{e(stage)}</span><ul>{chips}</ul></div>')
    t = f" {e(note)}" if note else ""
    return f'''<figure class="funnel" style="--n:{len(cols)}" data-reveal>
          <div class="funnel__cols">{"".join(out)}</div>

        </figure>'''


def spacture_hero():
    """Spacture AI's first screen: the Figma frame's type and buttons, set in
    HTML over its background video (muted, looping; still for reduced motion).
    css/spacture-hero.css places everything as the frame does."""
    v = "../assets/work/spacture-ai/"
    return f'''<figure class="plate cs-cover" data-reveal>
          <div class="plate__mat"><div class="sx-hero" role="img" aria-label="Spacture AI homepage, first screen: the Spacture AI logo and menu over a security camera lens in close-up behind the headline Know Sooner. Respond Faster., with Book a demo and Download app">
            <video class="sx-hero__vid" src="{v}hero.mp4" poster="{v}hero-poster.webp" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>
            <script>matchMedia("(prefers-reduced-motion: reduce)").matches && document.currentScript.previousElementSibling.removeAttribute("autoplay")</script>
            <div class="sx-hero__ui" aria-hidden="true">
              <img class="sx-hero__logo" src="{v}logo.webp" alt="" width="1235" height="122">
              <span class="sx-hero__nav"><span>PRODUCT</span><span>SOLUTION</span><span>INDUSTRIES</span><span>RESOURCES</span><span>COMPANY</span></span>
              <span class="sx-hero__btn sx-hero__btn--top">BOOK A DEMO</span>
              <span class="sx-hero__alert">Live Alert</span>
              <span class="sx-hero__h">Know Sooner.<br>Respond Faster.</span>
              <span class="sx-hero__sub">For those who want to stay one step ahead.</span>
              <span class="sx-hero__ctas"><span class="sx-hero__btn">BOOK A DEMO</span><span class="sx-hero__link">DOWNLOAD APP</span></span>
            </div>
          </div></div>

        </figure>'''


# Spacture's type and colour, from the Figma file's style panels, set as one
# live brand board (css/spacture-system.css) so it stays sharp at any size.
# Style names follow a standard system; the Figma names were working names.
PJS, INTER = "Plus Jakarta Sans", "Inter"
# (family, role, the weights it uses)
SX_FAMILIES = [(PJS, "Display", [(400, "Regular"), (500, "Medium"), (600, "SemiBold"), (700, "Bold")]),
               (INTER, "Text", [(400, "Regular"), (500, "Medium")])]
SX_SET = "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz"
# (name, family, weight, weight name, size, line height: px, "100%" or "Auto")
SX_SCALE = [("Display", PJS, 700, "Bold", 56, "100%"),
            ("Heading 1", PJS, 600, "SemiBold", 40, "100%"),
            ("Heading 2", PJS, 400, "Regular", 28, 36),
            ("Body Large", INTER, 400, "Regular", 18, "Auto"),
            ("Body", INTER, 400, "Regular", 16, "Auto"),
            ("Body Small", INTER, 400, "Regular", 14, "Auto"),
            ("Caption", INTER, 400, "Regular", 12, "Auto"),
            ("Button Primary", PJS, 600, "SemiBold", 16, "Auto"),
            ("Button Secondary", PJS, 500, "Medium", 16, "Auto"),
            ("Nav Link", INTER, 500, "Medium", 14, "Auto")]
# (group, name, hex): the brand colours on the first row, neutrals and surfaces on the second
SX_COLOURS = [("Neutral", "Ink", "#09111D"), ("Brand", "Primary", "#355CFF"),
              ("Brand", "Secondary", "#6EA8FE"), ("Brand", "Accent", "#B8C7FF"),
              ("Feedback", "Alert", "#FF3737"), ("Neutral", "Grey", "#A0A0A0"),
              ("Neutral", "Border", "#DEE6F2"), ("Surface", "Background", "#F8FAFC"),
              ("Surface", "Section Tint", "#F3F9FF"), ("Surface", "Card", "#FFFFFF")]


def sx_board():
    def lh(s, l):  # the sample's line height, and how the board shows it
        if l == "Auto":
            return "normal", "Auto"
        if l == "100%":
            return "1", "100%"
        return f"{l / s:.4f}", f"{l}px"
    fonts = ""
    for fam, role, weights in SX_FAMILIES:
        styles = ""
        for n, f, w, wn, s, l in SX_SCALE:
            if f != fam:
                continue
            styles += (f'<li><span style="font-weight:{w}">{n}</span>'
                       f'<span class="sxb__meta">{s} / {lh(s, l)[1]} · {wn}</span></li>')
        # one column per weight, each with a big cropped "a" in it
        cols = "".join(f'<div class="sxb__weight"><span class="sxb__label">{wn}</span>'
                       f'<span class="sxb__a" style="font-weight:{w}" aria-hidden="true">a</span></div>'
                       for w, wn in weights)
        fonts += (f'<div class="sxb__type" style="font-family:\'{fam}\';--n:{len(weights)}">'
                  f'<div class="sxb__spec"><span class="sxb__label">{role} typeface</span>'
                  f'<p class="sxb__name">{fam}</p>'
                  f'<div class="sxb__cols"><div><span class="sxb__label">Style</span><ol class="sxb__styles">{styles}</ol></div>'
                  f'<div><span class="sxb__label">Type</span>'
                  f'<p class="sxb__set" style="font-weight:{weights[0][0]}">{SX_SET}</p>'
                  f'<p class="sxb__set" style="font-weight:{weights[-1][0]}">{SX_SET}</p></div></div></div>'
                  f'{cols}</div>')
    light = ("#F8FAFC", "#F3F9FF", "#FFFFFF", "#DEE6F2")  # need an edge on the board
    dark = ("#09111D", "#355CFF", "#FF3737")  # take white text
    colours = "".join(
        f'<li class="sxb__tile{" is-dark" if c in dark else ""}{" is-light" if c in light else ""}" style="--c:{c}">'
        f'<span><span class="sxb__group">{g}</span><b>{n}.</b></span>'
        f'<span class="sxb__hex"><span>Hex</span>{c}</span></li>'
        for g, n, c in SX_COLOURS)
    return f'''<figure class="plate sxds" data-reveal>
          <div class="sxb">
            {fonts}
            <div class="sxb__palette">
              <span class="sxb__label sxb__label--rule">Brand colours</span>
              <ul class="sxb__colours">{colours}</ul>
            </div>
          </div>
          {caption("Type and colour", "Plus Jakarta Sans for display, Inter for text, and ten colours built around one blue")}
        </figure>'''


def figma_link(p):
    f = p.get("figma")
    if not f or not f.get("url"):
        return ""
    return (f'<a class="cs-link" href="{e(f["url"])}" target="_blank" rel="noopener">{e(f["label"])} '
            f'<span aria-hidden="true">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>')


# ---------------------------------------------------------------------------
# the projects
# ---------------------------------------------------------------------------
# Head: the project's name, then desc (what it is, in a sentence or two),
# then the facts. line is the one-line summary used in the page's meta
# description. Facts: every page gives the same details in the same order:
# project type, organisation or context, role, tools. A value of None shows
# "To be added" (with an ADD: comment) until it is confirmed; nothing is
# guessed. Figures that appear inside the screens are the designs' own
# placeholder content, not real data, and the copy says so where it matters.
C = "../assets/work/craft/"
CS = C + "sections/"
FX = "../assets/work/flex-academy/"
FS, FM, FF, FP = FX + "sections/", FX + "motion/", FX + "flows/", FX + "phones/"
W = "../assets/work/spatiallite/"
WM = W + "motion/"
K = W + "cards/"
SX = "../assets/work/spacture-ai/sections/"
SM = "../assets/work/spacture-ai/motion/"
PX = "../assets/work/spacture-ai/process/"
A = "assets/case-studies/"
# each project's home-card picture (index.html), for the next-project link
THUMBS = {
    "spatiallite": ("../assets/projects/spatiallite-thumb.jpg", 1672, 941),
    "spacture-ai": ("../assets/projects/spacture-thumb.jpg", 1536, 1024),
    "craft": ("../assets/projects/craft-thumb.jpg", 1672, 941),
    "flex-academy": ("../assets/projects/flex-thumb.jpg", 1536, 1024),
}  # where future Figma / FigJam exports go

PROJECTS = []

# ===================== SpatialLite: real product work at PropVR ==========
P = "SpatialLite"
PROJECTS.append(dict(
    slug="spatiallite", name=P, mark="L",
    kicker="Product design · PropVR",
    line="Designing how people move from a whole development down to a single home.",
    headline="Helping home buyers go from a city map to a single home, without getting lost",
    intro=["SpatialLite (previously WebLite) is PropVR's browser-based tool for exploring real-estate developments. A buyer can start at a city map, open a master plan, pick a building and a floor, and end up looking at one unit's plan, all in one place.",
           "I worked on how that journey holds together: the cards, the pins and plans you move through, and the unit-level screens at the end of it."],
    facts=[("My role", "UX Designer"),
           ("Tools", "Figma, Figma Make"),
           ("Company", "PropVR")],
    live=None,
    figma=None,  # only if a shareable prototype exists and it's cleared to share
    # office work: the sections after this one are locked with a password
    # (tools/private-password.txt); a card asks for it to read on
    private_after="journey",
    # not the home thumbnail: the journey's first level, from the product
    cover=(W + "location.webp", 2000, 1125, "SpatialLite's location view of Dubai: projects and landmarks pinned on a satellite map, with a list of project cards on the right and a city switcher at the bottom", "The location view: a city's projects on the map, with their cards beside it"),
    sections=[
        ("context", "Context", "Standing in for the site visit", lambda P=P: [
            prose("A buyer can't always walk the site or step onto a balcony, so the product has to stand in for the visit: where the project is, what's around it, which tower, which floor, which home.",
                  "SpatialLite runs for real-estate developers across the Middle East and India. Each one brings its own brand, imagery and inventory, but the way a buyer moves through it is the same product underneath."),
            prose("SpatialLite started out as WebLite. As more developers and more kinds of projects came onto it, each part of the journey had grown to fit the project in front of it: a new card here, a different pin there. It worked, but it didn't feel like one product any more, and that's what I set out to fix."),
        ]),
        ("problem", "The problem", "Four kinds of view that had to feel like one journey", lambda P=P: [
            prose("A buyer arrives with a broad question (where is this, and what's in it?) and leaves with a narrow one (which home, on which floor?). In between they pass through a satellite map, a master plan, a 3D building and a floor plan. Each of those views works differently, which makes it very easy to lose your place."),
            point("Every level had to speak the same language",
                  "A pin on the city map, on the master plan and on a building should all mean the same thing: something you can open. If one opens a card and another jumps straight to the next level, people stop trusting the pins.", n=1),
            point("The way back had to stay in sight",
                  "Buyers compare: this tower against that one, this floor against the next. Three levels deep, getting back up shouldn't take guessing.", n=2),
            point("Cards had to stop being one-offs",
                  "Project, community, unit and landmark cards each had their own layout and their own order of facts, so every new card had to be read from scratch.", n=3),
        ]),
        ("journey", "The journey", "One path, from the city down to a unit", lambda P=P: [
            prose("I started by laying the whole journey out as levels, and agreeing what every level must always give you: where you are, what you can open, and how to get back."),
            flow([("Location", "Where is it?", True),
                  ("Master plan", "What's in it?", True),
                  ("Phase", "Which part?", True),
                  ("Building", "Which tower?", True),
                  ("Floor", "Which level?", True),
                  ("Unit", "Which home?", True)],
                 "The journey, level by level", "Filled steps are the ones this page's screens cover"),
            point("It starts with the neighbourhood, not the building",
                  "Before anyone cares about floor plans, they want to know where the project is and what's around it. So the first level is a map: the project outlined, with schools, hospitals, malls and landmarks pinned by kind. Choosing a landmark draws the route and shows how long it takes to get there."),
            duo(plate(W + "location-amenities.webp", 2000, 1125, "SpatialLite's location view: the project outlined on a satellite map of Dubai, with pins for landmarks, healthcare, religious places, shopping, restaurants and education, and a row of category filters at the bottom",
                      "Where it is", "The project, and what's around it by kind"),
                plate(W + "location-route.webp", 2000, 1125, "SpatialLite's location view with one landmark chosen: a route drawn from the project to it, and the landmark's card with its distance and travel times",
                      "How far", "A landmark's route, distance and travel times")),
            point("Then the same few things on every level",
                  "From the master plan down, every screen has a breadcrumb at the top, the same rail of sections on the left, and pins that open a card before they take you anywhere. Once you've learned one level, you've learned them all."),
            annot_pics([
                (W + "master-plan.webp", 1920, 1080, "A SpatialLite master plan on desktop: a breadcrumb at the top, a section rail on the left, Phase 1 outlined with its pin, and its card open at the top right",
                 [(37.2, 3.6), (6.8, 50), (45.8, 37), (82.6, 21.3)]),
                (W + "phone-floor.webp", 750, 1624, "SpatialLite on a phone: a building's floor plan with a floor selector on the right and a unit-type key at the top",
                 [(80, 43)]),
            ], "The journey, in two screens", [
                ("Where you are", "A breadcrumb runs from the region down to the master plan, so every level above is one tap away."),
                ("The same places, every time", "A rail of the development's sections (location, master plan, home, gallery, amenities) stays put as you move around it."),
                ("A pin, then a boundary", "Each phase is a named pin. Choosing one outlines its boundary on the plan, so the selection shows on the map itself, not only in a panel."),
                ("A card before a commitment", "The phase's card sums it up (picture, type, units, sizes, configurations) with one action, Explore, to go a level deeper."),
                ("Floors as a ladder", "Inside a building, a floor selector steps through the levels while the plan follows, with unit types colour-coded in the key above."),
            ]),
            point("And it ends at one home",
                  "Pick a phase and its towers appear in 3D, each with a named pin. Pick a tower, then a floor, and you land on a unit's plan, drawn room by room, with its price, size, view and facing in a card beside it."),
            duo(plate(W + "phase-buildings.webp", 2000, 1125, "SpatialLite's Phase 1 view: the phase's towers in 3D, each with a named pin, a prompt to choose one, and a filter panel on the right",
                      "A building", "Phase 1's towers, each a named pin"),
                plate(W + "unit-plan.webp", 2000, 1125, "SpatialLite unit plan of Unit 245: the ground floor drawn room by room with dimensions, the unit's card at the top right with price, size, view and facing, a floor switcher at the bottom, and the unit's place on its floor in a small map",
                      "A unit", "Its plan room by room, its card beside it")),
        ]),
        ("cards", "Cards", "The card is where people actually decide", lambda P=P: [
            prose("Maps and plans get people to a place, but the card is what they read before deciding to go deeper. That's why the cards went through more rounds than anything else."),
            point("One order for every card",
                  "What it is, where it sits, the few facts that matter, then a single action. A project card, a building card and a unit card all follow it, so the facts are always where you expect them."),
            point("The pin stays lit while its card is open",
                  "A card opens from its pin, and the pin stays marked on the plan the whole time, so you never lose track of which place you're reading about."),
            duo(plate(W + "floor-unit.webp", 2000, 1125, "SpatialLite floor plan of one floor in a tower: units colour-coded by type, one unit chosen with its card open, showing type, unit number, price, size, style and two actions, View Plan and VR Tour",
                      "A unit's card, on its floor"),
                plate(W + "phone-building.webp", 750, 1624, "SpatialLite on a phone: a tower outlined with its pin, and its card at the bottom with type, units, bedrooms, floors and an Explore button",
                      "A building's card", tall=True),
                ratios=(2000 / 1125, 750 / 1624)),
            point("Five or six rounds to get there",
                  "These are the earlier versions. Each one solved a single case (a project, a community, a landmark), and none of them worked as a set. Each round pushed them closer to one system: consistent enough to reuse, flexible enough for what each project needs to say."),
            # earlier rounds, grouped by kind; not in order, since that isn't recorded
            cardset([(None, [
                (K + "earlier-01.webp", 657, 840, 2, "Earlier project card: a large render with a 3D Tour badge, name, type, price range, bedrooms and area, a description, and two buttons, View Experience and Download Brochure", None),
                (K + "earlier-02.webp", 657, 651, 2, "Earlier project card: the same layout without the description and buttons", None),
                (K + "earlier-03.webp", 645, 486, 2, "Earlier project card: a rounded render above the name, type, price range, bedrooms and area", None),
                (K + "earlier-04.webp", 1076, 472, 2, "Earlier project card, landscape and light: render on the left; status, name, type, bedrooms, area, floors, total units and View Experience on the right", None),
                (K + "earlier-05.webp", 1076, 472, 2, "Earlier project card, landscape and dark: the same layout on black", None),
                (K + "earlier-06.webp", 608, 699, 2, "Earlier community card: render, status, name, bedrooms, total units and floors as a list, and an Explore button", None),
                (K + "earlier-07.webp", 660, 634, 2, "Earlier community card: render, status, name, and bedrooms, total units and floors as three chips, with an Explore button", None),
                (K + "earlier-09.webp", 740, 388, 2, "Earlier sub-community card, dark: a master-plan image on the left; name, developer, villas, bedrooms and an Explore button on the right", None),
                (K + "earlier-08.webp", 634, 360, 2, "Earlier unit card, dark: unit number, availability, a favourite button, beds, baths, area, facing, and a Book Unit button", None),
                (K + "earlier-10.webp", 736, 190, 2, "Earlier landmark card, dark: a photo of the Burj Khalifa beside its distance, drive time and train time", None),
            ])], "Earlier versions", "Project, community, unit and landmark cards from earlier rounds", wall=True),
            cardset([
                ("Project card", [
                    (K + "project-closed.webp", 347, 216, 1, "Project card, closed: a render with a status badge and favourite, the project's name, type and starting price", "Closed"),
                    (K + "project-open.webp", 347, 357, 1, "Project card, open: the same summary, then location, bedrooms, area, a short description and an Explore button", "Open"),
                ]),
                ("Landmark card", [
                    (K + "landmark-closed.webp", 254, 191, 1, "Landmark card, closed: a photo, the landmark's name, and its distance, drive time and train time", "Closed"),
                    (K + "landmark-open.webp", 254, 301, 1, "Landmark card, open: the same summary with a short description below", "Open"),
                ]),
            ], "The cards today, closed and open", "Opening a card adds detail below the same summary"),
            point("Closed first, open when you want more",
                  "Today a card shows a short summary when closed. Opening it adds the detail below that same summary, so nothing you've already read moves."),
            point('The biggest change: from everything at once to a summary first', "The earlier cards tried to say everything up front: a big render, a long list of facts, a description and two buttons. Today's cards lead with a short summary and a single action, and only open up when you ask for more. That made them easier to scan on a busy map, and gave every kind of card the same shape."),
        ]),
        ("patterns", "One system", "Built once, used across every developer", lambda P=P: [
            prose("Because the same product runs for every developer, I kept a clear line between what's fixed and what changes. What a pin means, the order of a card and the way back stay fixed. The brand, the imagery and the facts change per project."),
            point('Built to swap, not to redraw', "Each card, pin and panel is a component with fixed slots: the picture, the name, a few facts and one action. A new developer's project fills those slots with its own brand and content, so it looks like theirs without anyone redesigning the journey."),
        ]),
        # the videos are still to come; a slot for them until then
        # screen recordings of the live product: the map first, then the 3D views
        ("motion", "Motion", "Small movements that say what's clickable", lambda P=P: [
            prose("On a map full of pins, hover states do a lot of the explaining. Pins show their names, buildings light up, and 360° views give a quick peek, so people know what something is before they commit to opening it."),
            motion([[(WM + "legend.mp4", WM + "legend.webp", 784, 596, "The map's legend opening upward from its button: three developers, each with its colour", "The legend", "By developer"),
                     (WM + "tags.mp4", WM + "tags.webp", 544, 472, "Two project tags on the map: on hover one shows Coming soon, the other an Explore button", "Tags", "Explore on hover"),
                     (WM + "rail.mp4", WM + "rail.webp", 820, 796, "The section rail over a map: Location lights on hover, then turns white when chosen", "The rail", "Lit on hover")],
                    [(WM + "landmark.mp4", WM + "landmark.webp", 820, 1274, "A landmark's card over the map: Read more opens its full description, then the Projects panel slides in beside it", "A landmark", "Read more"),
                     (WM + "views.mp4", WM + "views.webp", 1344, 796, "Towers in 3D with 360° pins: hovering a pin shows a small preview of its view, Balcony view 1", "360° views", "A peek on hover")],
                    [(WM + "names.mp4", WM + "names.webp", 1290, 1234, "A development from above, its projects labelled: hovering a pin shows its name", "Place names", "Shown on hover"),
                     (WM + "buildings.mp4", WM + "buildings.webp", 994, 826, "Buildings in 3D: hovering one lights it up with its name while the rest dims", "Buildings", "Lit up on hover")]]),
        ]),
        ("outcome", "Outcome", "Where it is now", lambda P=P: [
            prose("SpatialLite is live and used across real developments by several large developers. I can't share numbers publicly, but I'm happy to talk through them. Reach out for details."),
        ]),
        ("learnings", "Learnings", "What I'd take into the next one", lambda P=P: [
            point("A good screen isn't enough on its own",
                  "Each view here worked fine by itself. The hard part was making them agree with each other, and that's what people actually notice."),
            point("Fix the card, and half the product gets clearer",
                  "Once the card's order was settled, a lot of other decisions became easy, because so much of the product is cards."),
            point("Consistency is invisible, until it breaks", "Nobody notices when every pin and card behaves the same way. They only notice the one that doesn't. A lot of the best work here is the kind no one sees."),
        ]),
    ],
))

# ===================== Craft: live website for a PropVR product ===========
P = "Craft"
PROJECTS.append(dict(
    slug="craft", name=P, mark="C",
    kicker="Live website · PropVR",
    line="Giving a working idea a more considered web experience.",
    headline="Designing and building the website for an AI studio for architects",
    intro=["Craft is PropVR's creative studio for architecture, engineering and construction (AEC) teams. You give it a project and a goal, and it plans and runs the renders, panoramas, videos and edits you need.",
           "I designed and built its website. There was no design hand-off: I worked straight in code with Claude and Cursor, with Figma for the pieces that needed it. I also worked on the UX of the dashboard, which isn't shown here."],
    facts=[("My role", "UX Designer"),
           ("Tools", "Claude, Cursor, Figma"),
           ("Company", "PropVR")],
    live="https://craft.propvr.ai/",
    figma=None,
    cover=(CS + "00-cover.webp", 2880, 1800, "Craft homepage: Creative Studio for AEC Workflows, with a before-and-after render comparison", "The live homepage"),
    sections=[
        ("context", "Context", "A product that worked, and a story that didn't come through yet", lambda P=P: [
            prose("Craft already worked. It could make renders, panoramas and videos, edit one region of an image, and run agents that plan the work. The website had to explain all of that to architects, developers and marketing teams, many of whom already use tools like ChatGPT or Gemini for some of it."),
            prose('Craft needed a website that could do the explaining on its own, for teams who had never seen a demo. Its job was to get an AEC team from "what is this?" to trying one real project, without a sales call in between.'),
        ]),
        ("problem", "The problem", "Listed one by one, it looked like a toolbox", lambda P=P: [
            point("Too many features, no thread",
                  "Renders, panoramas, video, region edits, agents. Each one is useful, but a page that lists them reads like a toolbox, and a toolbox is easy to compare against free tools feature by feature.", n=1),
            point("Visitors already had AI tools",
                  "Most people landing on the page will have tried a general AI tool already. The site had to say plainly why this is different, instead of hoping they'd work it out.", n=2),
            point("Different teams, different reasons",
                  "An architect, a developer and a marketer care about different things. One generic message would land with none of them.", n=3),
            pull("So the idea became: sell the workflow, not the toolbox. You describe an outcome, Craft plans it, and the pieces run in order."),
        ]),
        ("process", "How I built it", "Designing in the browser, with AI doing the typing", lambda P=P: [
            prose("Instead of finishing the design in Figma and handing it over, I built the site directly with Claude and Cursor. That made it cheap to try a new layout or a different section order and see it live in a few minutes.",
                  "What it didn't do was decide anything for me. Which version was right, what came first, and what to cut were still my calls, and I made a lot of them."),
            point('Generate, read, decide, repeat', "My loop was simple: build a version, read it top to bottom the way a visitor would, then decide by hand what to change, whether that was the order, a heading, or a section that didn't earn its place. The page went through many rounds like this before it felt right."),
        ]),
        ("reading", "One section, up close", "How a single section explains itself", lambda P=P: [
            prose("This is the section that carries the whole idea, so here's how it's put together."),
            annot(CS + "02-intent.webp", 2880, 1926, "Craft section: Describe the outcome. Review the workflow before it runs., with a brief card and a row of agent cards", "From intent to execution", [
                (5, 22, "The heading is the sequence", "“Describe the outcome. Review the workflow before it runs.” Two sentences, two steps: the section explains itself before the visuals do."),
                (62, 9, "The brief, as an object", "The goal sits in its own card with its inputs and a deadline, so it reads as something you hand over, not a prompt you type."),
                (5, 62, "The plan, left to right", "Each agent is a card with its task and status, in order, so the plan reads as a sequence rather than a feature list."),
            ]),
        ]),
        # the stages follow the live page's order, top to bottom
        ("website", "The website", "The homepage, top to bottom", lambda P=P: [
            prose("I ordered the page the way I'd explain Craft to someone in person: show what it makes, show how it works, say why it's different, show what it means for your team, then prove it and ask."),
            split([("Stage 01", "Show the result first", "Before any explanation, a before-and-after render. An architect sees a massing model turn into a finished image and understands what Craft does in a second.")]),
            plate(CS + "01-before-after.webp", 2880, 1512, "The opening's before-and-after slider: a dark massing model on the left, the finished render of the same building on the right", "The output first", "The same building, before and after"),
            split([("Stage 02", "Then show how it works", "The features become steps: a goal turns into a plan with inputs, agents, cost and approvals, and then one real project moves through the tools in order.")]),
            plate(CS + "03-tower-b.webp", 2880, 1918, "Craft's tool flow for one project, Marina Heights Tower B: a list of production tools on the left, and a before-and-after of the chosen tool's output on the right", "One project, through the tools", "Watch Tower B move through the right tools, in the right order"),
            split([("Stage 03", "Name the alternatives", "Visitors were going to compare it to ChatGPT or Gemini anyway, so the page does it for them, then shows what's different: agents that share one project, the tools it's coming to, and four things AEC work needs that general models get wrong.")]),
            board([
                ("Why Craft", "Why use Craft instead of ChatGPT, Gemini or Higgsfield?", "", CS + "04-why.webp", 2880, 1826, "The comparison section: general AI assistants and creative media suites set beside Craft"),
                ("The agent team", "Four agents today. One set of project facts.", "", CS + "05-agents.webp", 2880, 1826, "The agent team section: Ada, the lead agent, coordinating Scout, Bolt, Lex and Forge on one brief"),
                ("Integrations", "Craft is coming to the tools your team already works in.", "", CS + "06-integrations.webp", 2880, 1826, "Plugin cards for AutoCAD, Revit, 3ds Max, Unreal Engine, SketchUp and Maya"),
                ("Media-native foundation", "Four things general image models get wrong.", "", CS + "07-media-a.webp", 2880, 1824, "Four capabilities listed, above panoramic enhancement and generated detail examples"),
                ("Media-native foundation", "Animate the frame, or change one thing and hold everything else.", "", CS + "08-media-b.webp", 2880, 1826, "Motion and region-locked editing examples: a pool render and a bedroom"),
                ("Forge", "When the tool is missing, Craft will create it.", "A roadmap feature.", CS + "09-forge.webp", 2880, 1826, "The Forge roadmap section"),
            ]),
            split([("Stage 04", "Speak to each team", "Only once the workflow is clear does the page split by team: what architects, developers, marketers and sales each get from the same project.")]),
            board([
                ("Outcomes by team", "Five teams. Nobody re-briefs the project.", "", CS + "10-teams.webp", 2880, 2020, "Outcome cards by team, all starting from the same approved project"),
                ("Value by stakeholder", "One project system. A different advantage for every team.", "Panels for architects, developers, marketers and sales.", CS + "11-stakeholders.webp", 2880, 2020, "Expanding panels by team"),
            ]),
            split([("Stage 05", "Prove it, then ask", "Pricing set against costs a team already pays for, proof from PropVR's own production work, the questions teams ask before switching, and one small ask at the end: run one real project through it.")]),
            plate(CS + "12-pricing.webp", 2880, 2220, "Pricing plans, with a link to compare them against the costs of today's studio work", "Pricing", "Compare Craft with the line items already approved"),
            board([
                ("Customer zero", "Built inside a real AEC production pipeline.", "", CS + "13-pipeline.webp", 2880, 1212, "The customer-zero section, with figures from PropVR's own production use"),
                ("The FAQ", "Questions AEC teams ask before switching.", "", CS + "14-faq.webp", 2880, 1212, "Six questions in a list, from what Craft is to whether project files train shared AI models"),
                ("The close", "Run one real project through the system.", "", CS + "15-close.webp", 2880, 1212, "The closing call to action above the footer"),
            ]),
        ]),
        ("phone", "On a phone", "The same story on a small screen", lambda P=P: [
            prose("The order stays the same on a phone. Side-by-side comparisons stack, and the cards become a single column you scroll through."),
            phones([(CS + "phone-hero.webp", 1170, 2532, "Craft on a phone: the opening, with the headline, two buttons and a render"),
                    (CS + "phone-run.webp", 1170, 2532, "Craft on a phone: Describe the outcome, with the brief card and the plan"),
                    (CS + "phone-why.webp", 1170, 2532, "Craft on a phone: Why use Craft, with the comparison cards stacked"),
                    (CS + "phone-proof.webp", 1170, 2532, "Craft on a phone: Four things general image models get wrong, with the capabilities listed")],
                   "On a phone", "The opening, the workflow, the comparison and the proof"),
        ]),
        ("learnings", "Learnings", "What I'd take into the next one", lambda P=P: [
            point("AI makes the building fast, not the deciding",
                  "Trying a new layout took minutes. Choosing between them, and knowing what to cut, took as long as it always does."),
            point("Order is half the message",
                  "Getting the order right (show it, explain it, compare it, then ask) did more for this page than any single section."),
            point('Code is a great place to design, if you stay the designer', 'Working straight in the browser meant I saw real spacing, real type and real motion from the start. The trick was not letting the speed decide for me.'),
        ]),
    ],
))

# ===================== Spacture AI: website redesign assignment ==========
# Designed in Figma. The HTML builds in SPACTURE/ are Claude-made versions,
# not this design, so nothing here is taken from them: the screens are
# slots for Figma frames until they are exported.
P = "Spacture AI"
PROJECTS.append(dict(
    slug="spacture-ai", name=P, mark="S",
    kicker="Website redesign · Assignment",
    line="Making an AI security product easier to understand.",
    headline="Redesigning a security AI website so a store owner gets it in one scroll",
    intro=["Spacture AI uses computer vision to help retailers spot theft and suspicious behaviour through the cameras they already have. It's a powerful product, and that makes it hard to explain quickly.",
           "I redesigned its homepage as an assignment in the 10K Designers C8 cohort. It isn't Spacture's live website. I did everything on my own, from research and structure to the copy and the visual design."],
    facts=[("My role", "UX Designer"),
           ("Team", "Solo"),
           ("Tools", "Figma"),
           ("Context", "10K Designers C8 assignment")],
    live=None,
    figma=None,  # e.g. {"url": "https://www.figma.com/proto/...", "label": "View prototype"}
    cover=None,
    cover_html=spacture_hero(),
    head_extra="""
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap">
  <link rel="stylesheet" href="../css/spacture-hero.css">
  <link rel="stylesheet" href="../css/spacture-system.css">""",
    sections=[
        ("research", "Research", "Before any screens, I wanted to know who's buying", lambda P=P: [
            prose("I started on a Figma board, not a page. I wrote down the brief, built two personas around what a store owner or security head is afraid of and what they want, drafted the copy, and sketched the site's structure by hand."),
            point('The fear that shaped the page: finding out too late', 'Both personas I built, the people who\'d buy it and the people who\'d use it every day, shared one fear: realising something had happened only after the stock was gone. That fear became the page\'s opening, "Every moment looks ordinary. Until they connect."'),
            plate(PX + "research-board.webp", 1948, 956, "A Figma board of research: the brief and problem, sticky notes, two user personas, a fear and desire breakdown, copywriting drafts and a hand-drawn information architecture",
                  "The research board", "Brief, personas, copy and the site's structure"),
            plate(PX + "references-moodboard.webp", 1890, 516, "A second board: wireframe sketches, a column of existing security sites, and a wide moodboard of dark blue and teal security websites",
                  "References and moodboard", "Existing sites, early wireframes and the moodboard"),
        ]),
        ("challenge", "The problem", "Buyers think in stores, not in AI models", lambda P=P: [
            point("Stores already have cameras",
                  "What they don't have is someone watching every feed at the moment something happens. That gap is the real problem, and it's what a store owner already feels.", n=1),
            point("\"Computer vision\" doesn't mean anything to them",
                  "Leading with the technology makes the visitor do the work of figuring out why it matters. I wanted the technology to show up as the answer, not the pitch.", n=2),
            pull("So the page had to go: why it matters, how it works, what it looks like, in that order."),
            flow([("The gap", "Why should I care?", False),
                  ("The mechanism", "How does it work?", False),
                  ("The product", "What does it look like?", False),
                  ("The next step", "What do I do now?", False)],
                 "The order the page explains itself in"),
        ]),
        ("direction", "The direction", "Four things the page had to do", lambda P=P: [
            prose("Before designing, I wrote down what the page had to get right. Every section had to earn its place against these."),
            ruled(["A clear value proposition, before any mention of AI.",
                   "The product shown in use from the first screen.",
                   "A logical progression: the problem, how it works, what a team does with it.",
                   "One clear next step, repeated where a visitor is ready."]),
        ]),
        ("versions", "Iterations", "It didn't start blue", lambda P=P: [
            prose("My first directions were dark green and teal. The final page settled on a deep blue, with red kept only for real alerts. On the right of the canvas are the colour, component and hero frames that got it there."),
            point('Why blue won', 'Green and teal felt technical. A deep blue felt calmer and more trustworthy, which suits a product people rely on to keep watch, and it let the red alerts stand out as the only loud colour on the page.'),
            plate(PX + "old-iterations.webp", 1582, 600, "The Figma canvas: a row of frames under the label Old iteration on the left, and on the right the colour, component, hero, banner and phone frames that led to the final page",
                  "Old iterations", "Left, the early directions; right, the frames that became the final page"),
        ]),
        ("system", "Type and colour", "Two typefaces and one blue", lambda P=P: [
            prose("Plus Jakarta Sans for headlines and buttons, Inter for everything you read. Ten colours, built around one blue, with red saved for alerts."),
            sx_board(),
        ]),
        ("homepage", "The homepage", "Telling it as one shopper's visit", lambda P=P: [
            # the moments that carry the story, top to bottom (no whole-page
            # overview: it only repeated them); every other section is in the
            # prototype (set "figma" above)
            point("It opens with a feeling, not a feature",
                  "\"Every moment looks ordinary. Until they connect.\" Before any product appears, the page follows one visit through a store, timestamped from entry to exit, and ends on the thing every store owner fears: the signs were already there."),
            carousel([(SX + "01-ordinary.webp", 2560, 1664, "Dark frame with the line “Every moment looks ordinary.”, the words moment and ordinary in blue", None, "Every moment looks ordinary"),
                      (SX + "02-connect.webp", 2560, 1664, "The same line, now followed by “Until they connect.”", None, "Until they connect"),
                      (SX + "03-signals.webp", 2560, 1664, "“A visit is never a single event”: a path through a store, timestamped at Entered, Browsing, Paused, Returned and Exit, ending in “The signs were already there.”", None, "One visit, timestamped from entry to exit")],
                     "The opening"),
            point("Then the product, one alert at a time",
                  "The same visit is shown again, this time through Spacture's dashboard. Confidence climbs from 38% to 94% across four alerts, so you see how the product thinks instead of reading about it. (The numbers are the design's own example, not real data.)"),
            carousel([(SX + "05-state-1.webp", 2560, 1664, "A tilted Spacture camera dashboard tracking customer #41 at 38% confidence, beside the alert “Customer entered store”, step 1 of 4", None, "Customer entered store, 38% confidence"),
                      (SX + "06-state-2.webp", 2560, 1664, "Step 2 of 4: the customer in a blind spot at 52% confidence, alert “Customer remained in blind spot”", None, "In a blind spot, 52%"),
                      (SX + "07-state-3.webp", 2560, 1664, "Step 3 of 4: 66% confidence, alert “Repeated shelf interaction”", None, "Repeated shelf interaction, 66%"),
                      (SX + "08-state-4.webp", 2560, 1664, "Step 4 of 4: 94% confidence, a red alert “Concealment detected”", None, "Concealment detected, 94%")],
                     "One visit, four alerts"),
            point("Only then, how it works and where",
                  "Once you've seen it work, the page explains the four capabilities behind it, and shows them in four very different stores: a luxury boutique, a supermarket, an electronics store and a pharmacy."),
            tallpair([(SX + "12-luxury.webp", 2560, 1664, "Luxury: an isometric store floor in blue, tagged with dwell time at a display case and an associate approach"),
                      (SX + "13-supermarket.webp", 2560, 1664, "Supermarket: twenty aisles in isometric view, tagged with a dwell spike and a basket left unattended"),
                      (SX + "14-electronics.webp", 2560, 1664, "Electronics: dense shelves of high-value products in isometric view, tagged with a product handled three times and a queue forming at the counter"),
                      (SX + "15-pharmacy.webp", 2560, 1664, "Pharmacy: regulated shelves and a short counter in isometric view, tagged with a restricted shelf reach and a 90-second counter wait")],
                     (SX + "09-behaviour.webp", 2560, 5046, "“Behaviour Intelligence, built into every camera”: four stacked cards, Behaviour Detection, Context Awareness, Multi-Camera Tracking and Actionable Incidents, each with a small diagram"),
                     "How it works, and where", "Four capabilities on the right; four kinds of store on the left"),
            # the end of the page, in its order: the ask, the FAQ, the footer
            point("And one clear ask",
                  "The page ends on a question, \"What would you find if you could see it all?\", then a demo button, the questions a buyer asks before booking one, and the footer."),
            carousel([(SX + "18-cta.webp", 2560, 1664, "“What would you find if you could see it all?” over a glassy store illustration, with Book a Demo and Contact Sales", "The ask", "One question, then Book a Demo"),
                      (SX + "19-faq.webp", 2560, 1644, "F.A.Q, “The things worth knowing, before you get started”: seven questions in a list, from working with existing cameras to enterprise retailers, with Email us for anything else", "The FAQ", "Seven questions a buyer asks before a demo"),
                      (SX + "20-footer.webp", 2560, 1538, "The footer on a blue gradient: the Spacture AI logo and social links, page links, the legal line, and SPACTURE in large letters along the bottom", "The footer", "Links, legal, and the name once more")],
                     "The end of the page"),
        ]),
        # screen recordings of the built page, in its order
        ("motion", "Motion", "Movement that follows the story", lambda P=P: [
            prose("I kept motion to the places where it helps the story along: scenes changing behind the headline, cards stacking as you scroll through how it works, and a footer that reacts to your pointer."),
            motion([[(SM + "hero.mp4", SM + "hero.webp", 1440, 936, "The first screen: store scenes change behind the headline, and the menu and buttons answer the pointer", "The first screen", "The scenes change"),
                     (SM + "cards.mp4", SM + "cards.webp", 1440, 936, "Behaviour Intelligence: the four capability cards stack on one another as the page scrolls", "The cards", "They stack as you scroll")],
                    [(SM + "faq.mp4", SM + "faq.webp", 1440, 936, "The FAQ: a question opens in place, then the page scrolls on to the footer", "The FAQ", "A question opens in place"),
                     (SM + "footer.mp4", SM + "footer.webp", 1440, 936, "The footer: the large SPACTURE wordmark reacts as the pointer moves along it", "The footer", "The wordmark reacts")]]),
        ]),
        ("learnings", "Learnings", "What I'd take into the next one", lambda P=P: [
            point("Explain the problem before the product",
                  "The more complex the technology, the more it helps to start with something the reader already feels. The product makes sense much faster once the problem is theirs."),
            point("Show it working instead of describing it",
                  "Following one visit through four alerts did more than any list of features could."),
            point('Restraint makes the alerts land', 'Keeping the palette quiet and using red only for real alerts meant the one moment that matters, "Concealment detected", couldn\'t be missed.'),
        ]),
    ],
))

# ===================== Flex Academy: website design assignment ===========
# Designed in Figma. The HTML builds in Flex academy/ are Claude-made
# versions, not this design, so nothing here is taken from them.
P = "Flex Academy"
PROJECTS.append(dict(
    slug="flex-academy", name=P, mark="F",
    kicker="Website design · Assignment",
    line="Helping short-term rental operators see their next step.",
    headline="A landing page for short-term rental operators who've outgrown doing everything themselves",
    intro=["Flex Academy teaches the playbook, systems and know-how behind running a short-term rental business, from the team behind The Flex.",
           "I designed its landing page as an assignment. It hasn't launched. The page is written for one reader: someone already running 5 to 30 units, for whom every booking, cleaner and invoice still goes through them."],
    facts=[("My role", "Product Designer"),
           ("Team", "Solo"),
           ("Tools", "Figma, Figma Make"),
           ("Audience", "Rental operators, 5–30 units")],
    live=None,
    figma=None,
    cover=(FS + "00-hero.webp", 2880, 1513, "Flex Academy homepage: Your next 10 units shouldn't feel like your first, with a small picture set into the headline, and a button to register for a free webinar", "The first screen"),
    sections=[
        ("research", "Research", "Who's this for, and what else are they already trying?", lambda P=P: [
            prose("I started in FigJam with the brief, Flex's business model, a table of competitors, what an operator wants and what's hurting them, a moodboard, and a first pass at the page's structure."),
            plate(FX + "research-board.webp", 1570, 566, "The FigJam research board: the design brief, Flex's business model, a competitor table, the 5–30 unit operator's wants and pain points, a moodboard of bold type-led websites, and the page's information architecture", "The research board", "Brief, business model, competitors, audience, moodboard and structure"),
            point("Everyone covers one piece of the job",
                  "Free videos, courses, masterminds and operating software each cover one part. None of them takes an operator from learning how to do it to actually running it that way. That became the gap for Flex to fill."),
            pull("This reader doesn't want another course. They want to stop being the bottleneck."),
            point('Where the insights came from', 'The brief, a close look at what competitors offer, and what operators themselves say they want and struggle with. Mapping those side by side on one board made the gap between learning and running a business easy to see.'),
        ]),
        ("audiences", "Audience", "Three possible readers, and why I picked one", lambda P=P: [
            prose("I started wide, with three segments, and narrowed twice."),
            funnel([("Segments", [("Side-hustlers", "1–3 units"), ("Operators", "5–30 units"), ("Property professionals", "Agents, developers, landlords")]),
                    ("Personas", [("Launch", "The 9-to-5 Leaver"), ("Scale", "The Early Operator")]),
                    ("This page", [("The Early Operator", "5–30 units, ready to grow")])],
                   "From three segments to one reader"),
            point("Two people, two different questions",
                  "Someone leaving a nine-to-five is still asking whether a rental business works at all. An operator with twelve units already knows it does, and is buried in running it. One page for both would say too little to either, so this page is for the operator."),
        ]),
        ("structure", "Structure", "The page follows the questions in their head", lambda P=P: [
            prose("I ordered the page by the questions an operator asks before they'd sign up for anything: is this for me, is this my problem, how does it fix it, and what do I do now."),
            flow([("The promise", "Is this for me?", False),
                  ("The challenge", "Is this my problem?", False),
                  ("The programme", "How does it fix it?", False),
                  ("The next step", "What do I do now?", False)],
                 "The four steps of the page"),
            point("One line to set it up",
                  "“Your next 10 units shouldn’t feel like your first.” The headline speaks to someone who's already done this, and frames the move from managing properties one by one to running a business that scales."),
            plate(FX + "page-structure.webp", 880, 1250, "The page's structure as a flow: Hero, Proof, The Problem, The Shift, The Founders, The Method, The Programme, What you get, Results, Who it's not for, FAQ and Final CTA, with two actions from the hero: Book a free strategy call and Get the STR Scaling Checklist", "The page's structure", "Twelve sections, with two ways to act from the first"),
        ]),
        # the page's sections in its own order, under the four steps above
        ("homepage", "The homepage", "Top to bottom, in four steps", lambda P=P: [
            split([("Step 01", "Is this for me?", "The headline answers first. Then the numbers and the three things the founders do, so it's clear this comes from people who actually run rentals at scale.")]),
            board([
                ("Built at scale", "Built from a business that already operates at scale.", "", FS + "01-scale.webp", 2880, 1553, "Three figures, 6 cities in operation, 150+ corporate partners and 130+ channels, above a row of the cities The Flex runs in"),
                ("Three disciplines", "Same founders, three disciplines.", "", FS + "02-founders.webp", 2880, 1553, "Three cards: We operate, We built the tools, and We teach the playbook"),
            ]),
            split([("Step 02", "Is this my problem?", "At twelve units, every channel, cleaner and invoice still goes through one person. This section names that out loud, in black, so it stands apart from the rest of the page.")]),
            plate(FS + "03-challenge.webp", 2880, 1742, "A black section: Build a business that doesn't depend on you, a 0% load-on-you meter, and a list of what lands on the operator, from Airbnb to finance", "The problem", "Build a business that doesn't depend on you"),
            split([("Step 03", "How does it fix it?", "Four stages, twelve weeks on your own portfolio, the people who built it, and everything that's included.")]),
            board([
                ("The Machine", "Four stages, in the order an operator needs them.", "", FS + "04-machine.webp", 2880, 2072, "We teach you how to build The Machine: four cards, Source, Structure, Systemise and Scale, with Source open"),
                ("The Operating System", "12 weeks, on your own portfolio.", "", FS + "05-system.webp", 2880, 2072, "12 weeks to build your Operating System: a row of twelve week markers above four phases, Foundation, Operations, The Machine and Scale"),
                ("The founders", "They didn't study the playbook. They built it.", "", FS + "06-built.webp", 2880, 2072, "A photo of the two founders beside their story and their names"),
            ]),
            plate(FS + "07-included.webp", 2880, 978, "Everything you need to build and operate. Not a course login: chips for live sessions, founder access, playbooks, community, technology and real-world knowledge", "What's included", "Everything you need to build and operate"),
            split([("Step 04", "What do I do now?", "The proof, who it isn't for (an honest filter builds more trust than another promise), the questions left, then one action.")]),
            board([
                ("Results", "Results, once they're real. Not before.", "", FS + "08-results.webp", 2880, 1292, "Results, once they're real: three proof cards from the businesses behind the programme"),
                ("Who it's not for", "This isn't for everyone.", "", FS + "09-not-for.webp", 2000, 896, "This isn't for everyone: a list of who it's not for, beside a blue card of who it might be for"),
            ]),
            board([
                ("The FAQ", "Straight answers.", "", FS + "10-faq.webp", 2880, 1743, "Straight answers: seven questions in a list, from cost to whether there's a guarantee"),
                ("The close", "Build the right system from the start.", "", FS + "11-close.webp", 2880, 1743, "The closing card: Build the right system from the start. Scale it when you're ready, with a button to register for a free webinar, above the footer"),
            ]),
        ]),
        # where the first screen's three actions lead
        ("flows", "The three actions", "Three ways in, for three levels of readiness", lambda P=P: [
            prose("Not every visitor is ready for the same thing, so the first screen offers three actions. Each one leads to its own short flow."),
            point("A free webinar, for the curious",
                  "Three steps: a short form, a confirmation, and the event added to your calendar."),
            phones([(FF + "webinar-1.webp", 631, 391, "Save your seat: a short form for name, email and country"),
                    (FF + "webinar-2.webp", 630, 391, "You're registered, with the webinar's date, time and timezone"),
                    (FF + "webinar-3.webp", 631, 391, "Added to your calendar, with the webinar's details")],
                   "Free webinar", "Register, confirmed, then added to the calendar", n=3, stack=True),
            point("A strategy call, for the ready",
                  "The longest flow, on purpose. It asks about your portfolio, your goal and your budget before you pick a time, so the call starts with context."),
            phones([(FF + "call-1.webp", 305, 190, "Let's talk about your next stage of growth: what a 20–30 minute call covers"),
                    (FF + "call-2.webp", 306, 190, "First, tell us about your portfolio: a choice of unit ranges"),
                    (FF + "call-3.webp", 306, 190, "Where are you trying to go? A target portfolio size and where you're based"),
                    (FF + "call-4.webp", 306, 190, "Let's understand what you need next: a budget range and contact details"),
                    (FF + "call-5.webp", 306, 221, "Find a time that works for you: a calendar and a list of times"),
                    (FF + "call-6.webp", 306, 180, "You're booked, with the call's date, time and length")],
                   "Free strategy call", "Portfolio, goal, budget and a time, then booked", n=3, stack=True),
            point("A checklist, for everyone else",
                  "Not ready for a call? One email field gets you the STR Scaling Checklist, with a nudge to book a call when you are."),
            phones([(FF + "checklist-1.webp", 621, 386, "Not ready for a strategy call? Start with the systems check: the free STR Scaling Checklist"),
                    (FF + "checklist-2.webp", 621, 386, "Where should we send it? One email field"),
                    (FF + "checklist-3.webp", 621, 386, "Your checklist is on its way, with a next step to book a call")],
                   "STR checklist", "For anyone not ready for a call", n=3, stack=True),
        ]),
        ("phone", "On a phone", "The same page on a small screen", lambda P=P: [
            mockups([(FP + "hero.webp", 758, 1530, "Flex Academy on a phone: the headline, three pictures and the three actions"),
                     (FP + "problem.webp", 758, 1530, "On a phone: Build a business that doesn't depend on you, with the load-on-you meter"),
                     (FP + "machine.webp", 758, 1530, "On a phone: The Machine's four stages as stacked cards, with Source open"),
                     (FP + "founders.webp", 758, 1530, "On a phone: They didn't study the playbook. They built it, with the founders' photo and story")],
                    "On a phone", "The opening, the problem, The Machine and the founders"),
        ]),
        # screen recordings of the prototype, in the page's order
        ("motion", "Motion", "Small things that make it feel alive", lambda P=P: [
            prose("A picture that keeps changing inside the headline, a ticker of the cities The Flex runs in, and cards that open on hover. Enough to make the page feel run by real people, without getting in the way of reading."),
            motion([[(FM + "headline.mp4", FM + "headline.webp", 1440, 724, "The first screen: the picture set into the headline keeps changing, and the buttons fill on hover", "The first screen", "A picture changes inside the headline")],
                    [(FM + "cities.mp4", FM + "cities.webp", 1440, 724, "The row of cities moving sideways as a ticker, under the three figures", "The cities", "A ticker that keeps moving"),
                     (FM + "disciplines.mp4", FM + "disciplines.webp", 1440, 724, "The three discipline cards: hovering one fades in a photograph", "The disciplines", "A picture on hover")],
                    [(FM + "machine.mp4", FM + "machine.webp", 1440, 724, "The Machine: hovering a stage opens its card, and the others narrow to their names", "The Machine", "Each stage opens on hover"),
                     (FM + "founders.mp4", FM + "founders.webp", 1440, 724, "The founders' photo fades from colour to grey, then the page moves on to rows of drifting chips", "The founders", "Photo fades, chips drift")]]),
        ]),
        ("learnings", "Learnings", "What I'd take into the next one", lambda P=P: [
            point("A different reader means a different page",
                  "Writing for the operator instead of the beginner didn't just change the words. It changed what comes first, what gets proof, and which actions are on offer."),
            point("Saying who it's not for helps",
                  "An honest \"this isn't for everyone\" does more for trust than one more promise."),
            point('Proof beats promises', "For a reader who's already been sold courses before, real figures from a business that already operates at scale did more than any headline could."),
        ]),
    ],
))

# the pages run in the home page's gallery order (their count and "Next project")
ORDER = ["spatiallite", "spacture-ai", "craft", "flex-academy"]
PROJECTS.sort(key=lambda p: ORDER.index(p["slug"]))

# ---------------------------------------------------------------------------
# the page
# ---------------------------------------------------------------------------
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    INDEX = f.read()
a = INDEX.index('    <footer class="foot"')
b = INDEX.index("</dialog>", a) + len("</dialog>")
FOOTER = INDEX[a:b].replace('href="#about"', 'href="../index.html#about"')

HEAD = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title} — G S Varsha</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#F3EFE7">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23F3EFE7'/%3E%3Ccircle cx='8' cy='8' r='3.2' fill='%23B66A4B'/%3E%3C/svg%3E">
  <link rel="preload" href="../fonts/PPFragment-GlareRegular.otf" as="font" type="font/otf" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&amp;display=swap">
  <link rel="stylesheet" href="../css/base.css">
  <link rel="stylesheet" href="../css/projects.css">
  <link rel="stylesheet" href="../css/case.css">
  <link rel="stylesheet" href="../css/outro.css">
  <link rel="stylesheet" href="../css/rally.css">
  <link rel="stylesheet" href="../css/cursor.css">
  <script defer blocking="render" src="../js/nav.js"></script>
  <script defer src="../js/case.js"></script>
  <script defer src="../js/outro.js"></script>
  <script defer src="../js/rally-core.js"></script>
  <script defer src="../js/rally.js"></script>
  <script defer src="../js/footer.bundle.js"></script>
  <script defer src="../js/cursor.js"></script>
  <script type="speculationrules">{{"prefetch":[{{"where":{{"selector_matches":"a[href*='work/'], a[href*='index.html']"}},"eagerness":"moderate"}}]}}</script>{extra}
</head>
<!-- Generated by tools/make-cases.py: edit the project there, not here.
     Placeholders for assets still to come are marked "ADD:". -->
<body class="case" id="top">
  <a class="skip" href="#main">Skip to content</a>
'''
i0 = open(os.path.join(ROOT, "tools", "case-shell.html"), encoding="utf-8").read()
# the header, with the blur that sits behind it once the page scrolls (js/nav.js)
DOCK = i0[i0.index('  <div class="dock__blur"'):i0.index("  </header>") + len("  </header>")]


def page(p, i):
    n = len(PROJECTS)
    nxt = PROJECTS[(i + 1) % n]
    name = p["name"]
    # the intro: a small-caps label over each answer, the introduction first
    row = lambda k, v, cls="": f'<div{cls}><dt class="tag">{e(k)}</dt><dd>{v}</dd></div>'
    facts = row("Introduction", "".join(f"<p>{e(t)}</p>" for t in p["intro"]), ' class="cs-intro__wide"')
    facts += "".join(
        row(k, e(v)) if v else f'<!-- ADD: {e(name)}: {e(k.lower())} -->\n          ' + row(k, '<span class="facts__todo">To add</span>')
        for k, v in p["facts"])
    if p.get("live"):
        host = re.sub(r"^https?://|/$", "", p["live"])
        facts += row("Live site", f'<a href="{e(p["live"])}" target="_blank" rel="noopener">{e(host)} '
                                  f'<span aria-hidden="true">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>')
    links = figma_link(p)

    # the cover: a real screen, or a slot for one until it arrives
    if p.get("cover_html"):
        cover = p["cover_html"]
    elif p["cover"]:
        src, w, h, alt, cap = p["cover"]
        cover = f'''<figure class="plate cs-cover" data-reveal>
          <div class="plate__mat">{img(src, w, h, alt, lazy=False)}</div>

        </figure>'''
    else:
        kind, what = p.get("cover_ph", ("ADD FIGMA FRAME", "The homepage's first screen"))
        cover = ph(name, kind, what, A + p["slug"] + "/cover.png", "16 / 10",
                   title="Cover").replace('class="plate', 'class="plate cs-cover', 1)

    # office work: the sections after private_after go into the page locked,
    # encrypted with the password in tools/private-password.txt
    # (tools/seal.mjs); js/private.js opens them once it's entered
    sections, rest = p["sections"], []
    if p.get("private_after"):
        k = [sid for sid, *_ in sections].index(p["private_after"]) + 1
        sections, rest = sections[:k], sections[k:]
    toc_item = lambda sid, label: f'<li><a href="#{sid}">{e(label)}</a></li>'
    toc = "".join(toc_item(sid, label) for sid, label, _, _ in sections)

    def section(sid, label, title, blocks):
        body = "\n        ".join(blocks())
        return f'''
      <section class="cs-sec" id="{sid}" aria-labelledby="{sid}-h">
        <h2 class="sec-head" id="{sid}-h" data-reveal><span class="tag sec-head__label">{e(label)}</span> <span class="sec-head__title">{e(title)}</span></h2>
        {body}
      </section>'''
    secs = [section(*sec) for sec in sections]

    sealed = ""
    if rest:
        toc += '<li class="toc__locked" data-locked-toc><a href="#more">Read more</a></li>'
        password = open(os.path.join(HERE, "private-password.txt"), encoding="utf-8").read().strip()
        payload = json.dumps({"toc": "".join(toc_item(sid, label) for sid, label, _, _ in rest),
                              "html": "".join(section(*sec) for sec in rest)})
        box = subprocess.run(["node", os.path.join(HERE, "seal.mjs")], input=json.dumps({"password": password, "text": payload}),
                             capture_output=True, text=True, check=True).stdout
        sealed = f'\n  <script type="application/json" data-sealed>{box}</script>'
        secs.append(f'''
      <section class="cs-sec cs-private" id="more" aria-labelledby="more-h" data-private>
        <h2 class="cs-private__title" id="more-h">Enter password to read more</h2>
        <form class="cs-private__form" data-private-form>
          <label class="visually-hidden" for="case-password">Password</label>
          <input class="cs-private__input" id="case-password" type="password" autocomplete="off" placeholder="Password" required data-private-input>
          <button class="cs-private__btn" type="submit">Read more</button>
        </form>
        <p class="cs-private__error" role="alert" data-private-error></p>
        <p class="cs-private__ask">Don’t have it? <a data-link="email" data-subject="{e(name)}: could I have the password?">Email me</a> or <a data-link="linkedin">message me on LinkedIn</a>.</p>
      </section>
      <div data-unsealed></div>''')

    # previous and next, each with its own home-card picture, as on the home page
    prv = PROJECTS[(i - 1) % n]

    def pager(q, way):
        t_src, t_w, t_h = THUMBS[q["slug"]]
        pic = f'<span class="cs-pager__pic">{img(t_src, t_w, t_h, "", cls="")}</span>'
        label = (CHEV_L + " Previous") if way == "prev" else ("Next " + CHEV_R)
        text = (f'<span class="cs-pager__text"><span class="tag cs-pager__label">{label}</span>'
                f'<span class="cs-pager__name">{e(q["name"])}</span></span>')
        inner = pic + text if way == "prev" else text + pic
        return f'<a class="cs-pager__link cs-pager__link--{way}" href="{q["slug"]}.html" rel="{way}">{inner}</a>'

    folder = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" aria-hidden="true">'
              '<path d="M1.8 4.2c0-.7.5-1.2 1.2-1.2h3.3l1.5 1.7H13c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z"/></svg>')
    body = f'''
  <main id="main">
    <article class="wrap cs-article">
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol><li><a href="../index.html#work">{folder}Work</a></li><li aria-current="page">{e(name)}</li></ol>
      </nav>
      <div class="cs-body">
      <nav class="toc" aria-label="{e(name)} case study contents" data-toc>
        <p class="tag toc__title">Contents</p>
        <ol>{toc}</ol>
      </nav>
      <div class="cs-story">
      <header class="cs-head" data-reveal>
        <p class="tag cs-head__eyebrow">{e(name)} <span aria-hidden="true">·</span> {e(p["kicker"])}</p>
        <h1>{e(p["headline"])}</h1>
        <!-- Intro and facts: set them in this project's "intro" and "facts" in
             tools/make-cases.py; a value of None shows "To add".
             Prototype or Figma link: set "figma" there. -->
        <dl class="cs-intro">{facts}</dl>
        {links}
      </header>
      {cover}
{"".join(secs)}{sealed}
      <nav class="cs-pager" aria-label="More projects" data-reveal>
        {pager(prv, "prev")}
        {pager(nxt, "next")}
      </nav>
      </div>
      </div>
    </article>
  </main>

'''
    # the cover is the first thing seen as the page opens
    preload = f'\n  <link rel="preload" as="image" href="{p["cover"][0]}">' if p.get("cover") else ""
    head = HEAD.format(title=e(name), desc=e(f"{name}: {p['line']}"), extra=preload + p.get("head_extra", ""))
    if p.get("private_after"):
        head = head.replace('<script defer src="../js/case.js">', '<script defer src="../js/private.js"></script>\n  <script defer src="../js/case.js">')
    return head + "\n" + DOCK + "\n" + body + FOOTER + "\n</body>\n</html>\n"


for i, p in enumerate(PROJECTS):
    with open(os.path.join(OUT, p["slug"] + ".html"), "w", encoding="utf-8") as f:
        f.write(page(p, i))
    print("wrote", p["slug"])
