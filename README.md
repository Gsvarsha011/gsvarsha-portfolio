# G S Varsha · Portfolio V9

A scroll-driven hero: your name above a little blocky (Roblox-style) desk
scene, the name turning into your roles, and then a camera move over your
shoulder into the laptop, which opens onto your projects. Plain HTML, CSS and
JavaScript with no build step; three.js is vendored in `vendor/`. Only DM Sans
loads from Google Fonts.

## Run it

Double-click `index.html`: it works straight from disk. The only difference
from a served page is that the thumbnails are left off the 3D laptop screen
while the camera flies in (browsers won't let WebGL use local image files);
the clickable panel at the end still shows them. To see it exactly as it will
be online, double-click **`Open V9.command`** (it starts a small local server
with caching off, so edits always show, and opens the page), or run it
yourself:

It serves the **`website` folder** (one level up); open
`/Portfolio%20V9/`:

```bash
python3 tools/serve.py 8793
```

Then open http://localhost:8793/Portfolio%20V9/

## Header

Your name (left) and the links (right) stay fixed at the top on every
screen. From the projects on (never over the hero; on a case study, once
you scroll), a blur sits behind them: strongest at the top and
easing off downward in six layers under a light paper tint, so it has no
edge (`.dock__blur` in `css/base.css`, switched on by `js/nav.js`). It's a
layer of its own just before the header, not inside it: the header has a
`view-transition-name`, and that would stop a blur inside it from seeing the
page. Both line up with the edges of the projects panel's content.

Work plays the scroll sequence to the projects, About scrolls to the About
section and Contact to the footer (its Connect links); none of them leave the
page.

On phones (760px and narrower) the right side is one paper pill with
Resume and Menu (two strokes, the lower one short and terracotta, that cross
into an x as "Menu" rolls to "Close"). The menu is a small paper card that
opens right under the pill, in the same paper: Work, About and Contact in PP
Fragment at 22px (a sand chip under the one you press, a terracotta dot by
the page you're on), no numbers or arrows, and Email and LinkedIn small at
the foot; the page dims a little around it (Esc, a link, a tap outside or
scrolling closes it). There's no blue box on tap anywhere on the site, and
the header's focus rings show only for the keyboard (`data-input`, js/nav.js).

## The greeting (loading page)

On the first visit in a browser session (or any visit with `?hello`), the
hero opens on the bare paper, with no name, no desk and no nav, and greetings
roll through a one-line window where the name will be: Hello → வணக்கம் →
नमस्ते → Salut → Salve. As Salve rolls away, "G S Varsha" rises into its
place, the desk builds itself in (the rug, desk, chair, you, the MacBook,
then everything on the desk), and the nav fades in. Salve holds until the
desk is ready (at most 4s). Any key, click, tap or wheel skips to the end.
Never when arriving at a `#link`. Reduced motion: one still "Hello" and a
short fade.

Files: `js/loader.js`, the greeting styles in `css/hero.css`, the rule in
the `<head>` script of `index.html`. To see it again, open a new tab or add
`?hello` to the URL.

## The sequence

The hero is 560svh tall and its pin sticks for 460svh. Everything is a
function of scroll progress (eased slightly), so it also plays backwards.

| Progress | What happens |
| --- | --- |
| 0 | "G S Varsha" above the desk, and a "heyy!" bubble beside you once the desk is built: you at the desk, a closed silver MacBook Pro, a pink tumbler, a Galaxy S24 face down in a beige case, sticky notes, silver-and-brown over-ear headphones, cold coffee, a black notebook |
| 0.03 – 0.27 | The name rolls up and out; PRODUCT DESIGNER / UX DESIGNER roll in; the introduction pops out of your head as a speech bubble (it follows the head as the camera moves) |
| 0.27 – 0.40 | Hold |
| 0.40 – 0.48 | Roles and introduction leave |
| 0.46 – 0.66 | The camera swings round and up behind you |
| 0.62 – 0.88 | The lid opens as the camera flies into the screen |
| 0.885 – 0.91 | The projects carousel (`#work`) fades in exactly over the laptop screen, which already shows its opening view; the carousel takes over from there |
| 0.93 – 1 | Hold; then the pin releases to the footer |

"Work" in the nav (and the skip link) smooth-scrolls through the whole
sequence to the open laptop.

## Files

| Part | File |
| --- | --- |
| Tokens, nav, footer | `css/base.css`, `js/nav.js` |
| Hero layout, type, the project panel, responsive | `css/hero.css` |
| Sequence and render loop | `js/hero.js` |
| The greeting | `js/loader.js` |
| Projects carousel | `js/projects.js`, `css/projects.css` |
| The cursor (home and case pages) | `js/cursor.js`, `css/cursor.css` |
| About, Toolkit, Beyond the pixels (story, tool cards, gallery, your character) | `css/about.css`, `js/about.js`, `buildCutout` in `js/scene.js` |
| The close and the footer | `js/outro.js`, `js/footer.js`, `css/outro.css` |
| Badminton game (opened from the footer) | `js/rally-core.js`, `js/rally.js`, `css/rally.css` |
| The desk scene, camera path, drawn laptop screen | `js/scene.js` |
| Background gradient + grain (GLSL) | `js/shaders.js`, drawn by `js/paper.js` |

## After editing anything in `js/`

The page loads one file, `js/bundle.js`: `js/hero.js` and everything it
imports (three.js included) bundled into a plain script, which is what lets
it run from disk. After changing any file in `js/` (except `nav.js` and
`loader.js`, which load on their own), rebuild it from this folder:

```bash
npx esbuild@0.24.0 js/hero.js --bundle --format=iife --minify --target=es2020 --alias:three=./vendor/three.module.min.js --legal-comments=eof --outfile=js/bundle.js
```

## Sharing it as one file

`index.html` only points at `css/`, `js/`, `fonts/` and `assets/`, so a copy
sent on its own shows bare text. To send the site as a single file:

```bash
python3 tools/build-share.py
```

It writes `share/GS-Varsha-Portfolio.html` (about 2.3 MB) with every
stylesheet, script, the PP Fragment font and the project images inside it.
Rebuild it after any change. Nothing on the page links to the older portfolio
versions; the case-study links are empty until those pages exist.

## Projects

After the hero, `#work` is a gallery that travels through a curved field of
focus as you scroll (`js/projects.js`, `css/projects.css`). The section is
tall and its stage sticks inside it; scrolling moves the row sideways. It
slows as each project comes into focus but never stops between them.

- **The lens.** The cards are drawn in WebGL on one canvas behind the
  gallery (`createLens` in `js/projects.js`), as if the row ran round the
  inside of a curve: the card in the middle is flat and sharp; past it the
  row turns away, so what's further out is squeezed closer together
  (foreshortened) and stretched taller (its top and bottom edges curve
  outwards), staying sharp until a light blur and fade at the very edge. All of it depends
  only on where a point is on the screen, so a card bends, blurs and fades
  continuously as it travels; nothing belongs to a side of the screen. Each
  card's panel is painted once into a texture (`paintPanel`) and redrawn on
  resize. Tune it in `draw()`: `uWarp` (how much taller at the edge),
  `uMaxBlur` (px), and where the bending and blur begin (`flat`,
  `uBlurFrom`, `uFadeFrom`); how strongly it turns away is `k` in the
  vertex shader (smaller turns more gently).
- **Smooth everywhere.** Every curve in the lens is continuous in its slope,
  so nothing creases or flares: the squeeze eases in over a short window
  (`w`) past the flat middle, and the stretch eases in and levels off
  towards a ceiling (`1 - exp(-1.5 s²)`), so anything past the screen's edge
  no longer flares taller. The travel itself eases to rest at both ends of
  the row (`easeIn` in `rowAt`: the first and last steps start and stop at
  zero speed and meet the middle steps at the same speed). The CSS fallback
  (`optical`) levels off its tilt, blur and drop the same way, with no
  clamps.
- **Opened from disk (file://):** browsers don't let WebGL read local
  pictures, so the gallery then loads `js/work-images.js` (the three card
  pictures as data URIs) and the lens works the same. After changing a
  card's picture, run `python3 tools/make-work-images.py`.
- The page's own cards lie flat and see-through over the canvas, for the
  links, keyboard focus, the header line and "Explore case study".
- Without WebGL 2, or when the page is opened straight from disk (browsers
  won't let WebGL read local images), the cards bend in CSS instead
  (`optical`, tuned in `LENS`): smaller, lower and blurred towards the sides.
- **A card:** a header line (name, kind) above one large screen. The card in
  focus shows "Explore case study" and is the only one that takes clicks.
- Nothing sits under the gallery; ← → on the keyboard move between
  projects. A sideways two-finger swipe on a trackpad moves the row too
  (`onWheel`): it becomes the page scroll that moves the row as far, and
  stays within the projects. While the gallery fills the screen, a sideways
  swipe never reaches the browser, so it can't trigger Back or Forward;
  everywhere else on the page that swipe works as usual. Everything is a pure function of scroll, so it reverses exactly.
- **Sizes:** the card in focus fills the room under the heading, up to half
  the screen's width.
- It is also what the 3D laptop shows: `paintWork` draws the gallery's
  opening view onto the laptop's screen, and the real gallery fades in over
  it as the camera arrives.
- Phones and short windows: the same lens over a row. The heading, the row
  and a line of dots (the current project a terracotta dash) stick in the
  middle of the screen while the page's scroll slides the row, eased like
  desktop so it rests on each project (`.work-rowdrive`, `driveRow`); a
  sideways swipe moves it too, the page's scroll follows, and when the swipe
  settles the page glides to the nearest project. Only that block sticks
  (`--stage-h`), so About follows right under it, with no empty paper. The
  row's horizontal scroll moves the focal point (`measureRow`, `rowP`,
  `drawRow` in `js/projects.js`), so the cards flatten in the middle and
  curve away at the edges. Centred cards (`.work-rowlens` in
  `css/projects.css`) let the neighbours show.
- Reduced motion, or no WebGL 2: a plain row of landscape cards you swipe
  through, the next one peeking in.
- Every card shows a device mockup (`assets/projects/*-thumb.jpg`).
- Spatial Key has a picture but no case study: it sits under a pane of
  frosted glass, edge to edge with no outline (`.card3__seal`), with a lock in the middle and "Connect to
  have a look?", and the card leads to Contact. The lens paints the same
  pane (`paintSeal` in `js/projects.js`), so change both together.

### The case studies

`work/spacture-ai.html`, `work/spatiallite.html`, `work/craft.html` and
`work/flex-academy.html` (`css/case.css`, `js/case.js`; images in
`assets/work/`), all generated by `tools/make-cases.py`:

```bash
python3 tools/make-cases.py
```

Edit a project there, never in `work/*.html`: each one is a dictionary in
`PROJECTS` with its facts, optional links and its sections, each a list of
blocks. One system, adapted per project: the contents beside the story,
which opens with the head and then the cover; its screens sit wide in soft
frames and its words centred between them.

- **Trail:** "Work / the project" at the top (a folder icon, Work links
  back to the home page's work).
- **Cover:** the real opening screen, under the head, in a frame the
  width of the story (Spacture AI: its first screen with the background video). Not the
  home-card thumbnail. `cover=None` shows a slot for the homepage's first
  screen instead.
- **Head**, at the top of the story, in the reading column: the project and
  `kicker` in small terracotta capitals, then `headline`, a plain sentence
  about what the work did (not just the name); then the intro, small-caps
  labels over each answer: Introduction (`intro`, a paragraph or two in the
  first person), then the `facts` two to a row (My role, Team, Tools, and
  Company / Context / Audience). A fact set to `None` shows "To add" (with
  an `ADD:` comment) until you confirm it. The live site is a fact row only when `live` is set (Craft:
  craft.propvr.ai, checked), and a Figma button only when `figma` is set
  with a real, shareable URL and an accurate label ("View prototype" or
  "Explore the Figma file"). `line`, the one-line summary, is the page's
  meta description.
- **Contents, on the left:** a short dash before each section's name (the
  current one's dash grows and turns terracotta), made from the sections, sticky on
  desktop from the head down, inside the case study's grid, so it stops
  before previous / next and the footer. Real anchor links (they work
  without JavaScript); the current section is marked
  `aria-current="location"` with a terracotta line and weight, not only
  colour. On tablets and phones it becomes a slim bar of links under the
  menu, scrolling sideways; once it sticks, its frosted paper reaches up to
  the top of the screen (`.toc[data-stuck]`, js/case.js), so the header and
  the bar read as one strip with nothing showing through between them.
- **Sections:** each opens with its label in small terracotta capitals and
  its title under it, with a hairline between sections, like pages of
  documentation. The story is one 860px column (`--story`), centred in
  the room beside the contents: text (17px) and screens both fill it, on
  the same left edge, so nothing leaves an empty strip on the right. A single screen sits
  straight on the page; only screens shown together (carousels, phone
  sets, `tallpair`, `annot_pics`, card boards) share a soft frame. Pages read as a story in the first person: context, the
  problem, what I designed, outcome or feedback, learnings.
- **Words still to come:** `tbd("what to write", kind)` leaves a dashed
  terracotta box on the page saying what goes there (team, feedback,
  quotes, outcomes, numbers). Replace it with `prose`, `point` or `quote`
  once you have the words.
- **Previous / next**, at the end: each project's home-card picture beside
  "Previous" or "Next" and its name, wrapping round from the last to the
  first (`.cs-pager`; the pictures drop on phones).
- **Blocks:** `lead`, `prose`, `point` (a bold one-line takeaway, then its
  paragraphs; `n=` numbers it), `quote` (what someone said, and who),
  `pull` (one sentence said a little louder), `ruled` (a numbered
  list), `split` (a stage heading that groups the screens after it),
  `plate` (a real image), `duo`/`row3`, `labelled` (before / after), `annot` (a screen
  with numbered pins and notes; `annot_pics` spreads one set of notes over
  several screens, e.g. a desktop and a phone), `carousel` (screens that belong together, one at a time in a frame:
  round previous / next buttons on its edges, a count, and each screen's
  own caption under it; swipeable, and as wide as fits the screen's
  height), `board` (a run of a page's sections as a carousel, each captioned
  with its label and heading), `tallpair` (a tall screen on the right, wide ones stacked on the left, one frame and one caption, the columns sized so both sides match), `seq` (versions in order), `zoom` (a close-up), `flow`
  (a journey or a page's order as steps in a row; filled steps are ones a
  screen on the page shows), `funnel` (narrowing down, e.g. Flex Academy's
  segments to personas to one reader), and `ph`. `plate(..., narrow=True)` keeps a long page section to about half
  the column.
- **Motion & interactions:** SpatialLite, Spacture AI and Flex Academy have this
  section, before Learnings: `motion(rows)`, screen recordings in rows,
  each in its own frame with a one-line caption, muted and looping with no
  controls, as the reference case study shows them. A row's clips are
  sized by their ratios so they stand the same height whatever their shape
  (a phone-tall clip beside a wide one); on phones they stack. Files:
  `assets/work/<project>/motion/` (H.264 at 30fps, no wider than 1440px,
  a WebP first frame for each). `js/case.js` plays a clip only while it's
  on screen; with reduced motion they stay still, with controls. Craft has
  none for now.
- **Craft's screens** (`assets/work/craft/sections/`) are captures of the live
  site at 2× (phones at 3×), WebP, in the live page's order. Screens in one
  carousel share a shape: shorter ones are extended with their own edge
  pixels. The site opens an award popup for a new visitor, so dismiss it
  before capturing. The older JPGs and `mobile.png` in `assets/work/craft/`
  are no longer used. `phones()` sets phone screens side by side in one
  frame. A carousel's frame takes the shape of its tallest screen.
- **Flex Academy's screens** (`assets/work/flex-academy/sections/`) are cut from
  one 2× Figma export of the whole page, at the empty rows between sections,
  and grouped under the page's four steps. The hero is the cover.
- **Spatial Key** has no case study. Its locked card opens a small dialog over
  the projects (`[data-keycard]` in `index.html`, `js/projects.js`,
  `css/projects.css`): Email, with the subject filled in, LinkedIn, and the
  address as plain text. Addresses come from LINKS in `js/outro.js`.
- **Flex Academy's flows and phones:** "The three actions" shows where each
  first-screen button leads (`assets/work/flex-academy/flows/`, set with
  `phones(..., n=3, stack=True)`). "On a phone" uses `mockups()`: the phones in
  `assets/work/flex-academy/phones/` are cut out on transparency and sit
  straight on the page, with no frame.
- **Moving around:** a nav link or a contents link jumps straight to its
  section; `softJump` (`js/nav.js`) crossfades the two views. Pages dissolve
  into each other with a cross-document view transition (`css/base.css`), and
  the header stays still through it. Work stays selected on a case study, and
  `index.html#work` lands exactly where a click on Work does (`js/hero.js`).
  Case pages prefetch on hover and preload their cover. Browsers without view
  transitions simply jump.
- **Pairs of different shapes:** `duo(..., ratios=(a, b))` sizes the two
  columns so both screens, and both frames, end at the same height.
- **Spacture AI's first screen** is the Figma frame rebuilt in HTML
  (`spacture_hero()` in the generator, `css/spacture-hero.css`) over its
  background video, `assets/work/spacture-ai/hero.mp4` (sound track
  removed; plays muted and loops; a still for reduced motion). Every size is
  the frame's px x 0.05cqw, measured against the frame, so it scales like an
  image. The logo is Spacture's own (`logo.webp`), keyed out of the PDF. The original frame is in `incoming/spacture-ai/screens/`.
- **Spacture AI's homepage** is the Figma page exported as one PDF
  (`incoming/spacture-ai/pdf/frames.pdf`, 1280 pt wide), cut into its 20
  sections at 2x (`incoming/spacture-ai/sections/*.png`) and saved as WebP in `assets/work/spacture-ai/sections/`.
- **Boards:** `cardset` lays interface cards on a FigJam-style board
  (light grey, dot grid). Any text on a board is a sticky note: a yellow
  square for a group's name, a small blue one for a state (Closed, Open).
- **No side-by-side text:** paragraphs never sit in two columns next to
  each other; `split` takes one column only (the build stops otherwise), so
  write such text as `prose`.
- **Paired captions match:** the two captions in a `duo` must wrap to the
  same number of lines at full width. The build stops and names them when
  they don't (a one-line caption beside a three-line one looks unfinished),
  so shorten the longer one. Beside a phone screen, keep both to a title.
- **`ph`, placeholders for assets still to come** (Figma frames, FigJam
  exports, research): each is drawn at the asset's own shape, says what to
  add (e.g. "ADD FIGJAM EXPORT · User journey"), the suggested path (under
  `assets/case-studies/<project>/`) and whether it's required or optional,
  with a matching `ADD:` comment in the page. To fill one, add the image at
  that path and swap the `ph(...)` call for `plate(...)`.

The words rest on your V6 case-study copy, your own notes on each project,
the real screens and the source builds in your Portfolio folder. Design
reasoning is written as reasoning, never as a finding: nothing about
research, testing, metrics, dates, team or outcomes is invented, and each
page says what is still unvalidated. Roles and tools are as you confirmed
them; there are no timelines. Craft's
screens are captures of the live site (its award pop-up closed first);
`mobile.png` is four 390px captures of it, side by side. The home-card
thumbnails stay on the home page: no case study reuses its own thumbnail,
so SpatialLite's cover, journey screen and close-ups are `ph` slots that
say which screen goes in each.

SpatialLite is office work, so only its start is open: Context, The
problem and The journey. After that the page fades out into "Enter password
to read more", with a password box and a line asking people to email or
message for it. Everything after The journey (and its place in the contents) is in
the page encrypted, so without the password it can't be read, not even in
the page's code.

- **The password** is in `tools/private-password.txt`. To change it, edit
  that file and run `python3 tools/make-cases.py` again.
- **How it's locked:** `private_after="journey"` in `tools/make-cases.py`
  picks where the lock starts. The generator encrypts the rest with
  `tools/seal.mjs` (needs Node), and `js/private.js` opens it in the
  browser. The right password reloads the page at Cards and keeps it
  open for that tab; a wrong one says so. Opening it needs https (or
  localhost).
- **Removing the lock:** delete `private_after` and run the generator.
- **When publishing,** upload only `index.html`, `css/`, `js/`, `fonts/`,
  `vendor/`, `assets/` and `work/`. Never upload `tools/` (it holds the
  password), `incoming/`, `share/` or the `backup-…` folder (an old, unlocked
  copy of the page is in it). The screens in the locked part are still
  plain files in `assets/`: they can't be found from the page, but anyone
  who knew a file's exact address could open it.

SpatialLite's screens never show the client's logo (only SpatialLite;
the other projects keep their own logos): `tools/swap-logo.js`
refills the logo's box from the pixels either side of it and writes LOGO
in its place, leaving the rest of the screen as it was. The originals stay
in `incoming/<project>/screens/`; the edited copies go in
`assets/work/<project>/` as WebP at the original's full size, so they stay
sharp on high-density screens. Where a logo is tilted, set in a particular face, or runs
across a whole panel, `tools/frame-edit.js` does the same with more
control: rotated text, any font, and a fill that rebuilds a panel's
ground row by row; with no edits it just saves a frame as WebP.

Spacture AI and Flex Academy were designed in Figma. The HTML files for
them in the Portfolio folder are Claude-made versions, not your design, so
their pages use none of it: every screen is a `ph` slot for a Figma frame,
and the words come only from what you said about each project. The older
captures in `assets/work/spacture/` and `assets/work/flex-academy/` came
from those HTML files and are no longer used.

Spacture's type and colour share one compact brand board, and it is not an
image: `sx_board()` in `tools/make-cases.py` sets each typeface with the
text styles set in it, then the ten colours, as live text and swatches on
Spacture's Background, styled by `css/spacture-system.css`. To change a
value, edit `SX_FAMILIES`, `SX_SCALE` or `SX_COLOURS`. The values come from
your screenshots of the Figma style panels (`incoming/spacture-ai/figma-styles/`);
the style and colour names were renamed to a standard system (Display,
Heading 1, Body; Neutral / Ink, Brand / Primary and so on). The research boards and
the old-iterations canvas are in `assets/work/spacture-ai/process/`,
cropped from your Figma screenshots in `incoming/spacture-ai/research/`
and `versions/`.

Spacture's homepage section shows only its key moments, in order; the
other sections are left to the prototype. The whole-page overview
(`assets/work/spacture-ai/full-page.webp`: the first screen and all 20
section frames, 600px wide, in four columns) is no longer shown, since it
repeated those moments; the file is kept in case it's wanted again.

**The footer** on the case studies is the home page's own, copied from
`index.html` each time the pages are generated (with the game). Its paper
and character come from `js/footer.bundle.js`, the footer without the hero;
after changing `js/footer.js` or `js/scene.js`, rebuild it too:

```bash
npx esbuild@0.24.0 js/footer-entry.js --bundle --format=iife --minify --target=es2020 --alias:three=./vendor/three.module.min.js --legal-comments=eof --outfile=js/footer.bundle.js
```

The links from the gallery are in `CASES` at the top of `js/projects.js`.
The single-file share copy only holds the home page, so its case-study
links need the `work/` folder beside it.

## The type system

Every text size is a token in `css/base.css`, and `h1`, `h2`, `h3` and `body`
are set from them. Don't add a size: use one of these.

| Token | Desktop → phone | Used for |
|---|---|---|
| `--t-display` | 128 → 46 | the story's lines; the hero name has its own fitted size |
| `--t-h1` | 60 → 34 | case study names, where About's last line settles |
| `--t-h2` | 40 → 28 | section titles, the projects heading, pull quotes, the toolset line |
| `--t-h3` | 24 → 20 | card titles, stage headings |
| `--t-lead` | 20 → 17 | intro paragraphs |
| `--t-body` | 16 | body text |
| `--t-small` | 14 | captions, nav, buttons |
| `--t-label` | 12 | uppercase labels, small tags |

Not on the scale, on purpose: Spacture's rebuilt hero and brand board (`css/spacture-*.css`, their own design), type drawn on the project cards, and the × icons.

## About, Toolkit, Beyond the pixels

Three sections between the projects and the close (`css/about.css`,
`js/about.js`). The header's About link scrolls to the first one.

**About (`#about`)**: one scene that plays with the scroll (the stage is
sticky for about three screens; everything follows the scroll, so it also
plays backwards). The three statements take turns in the middle of the
screen, word by word; the last one rises to the top, smaller, as your
portrait comes up on its blob, your character (`buildCutout` in
`js/scene.js`) steps in beside it and waves, and a short paragraph appears.
Reduced motion: the statements and you, one under another.

- **Your photograph:** `assets/about/portrait-cut.webp`, cut out on a blob
  (`.meet__blob`). Once it's up it comes into focus: a fade in from a soft
  blur, settling from a touch larger (`.meet__photo.is-in` in
  `css/about.css`). It plays again each time you arrive. Reduced motion:
  just the photo.
- **The words:** `.meet__text` in `index.html`, a few short paragraphs; the first (`.meet__hey`) is the greeting, set larger.

**My toolset**: one sentence, centred, in four lines that stay four lines
with or without the logos (each line is a `.kit__row`; the type is as
large as fits the longest line): "I design in Figma and Framer, / think
with Claude, craft visuals in / Illustrator and Photoshop, build in /
Cursor and edit in Premiere Pro." The section's heading is there for
screen readers only. The sentence starts whole, without logos. When it
comes well into view it plays by itself, like a short film (about 6
seconds, no scrolling needed), once per visit (a reload or a new visit
plays it again): three cursors labelled Designer, Thinker and Maker fly in
from the left, the top right and below, each carrying a logo; as one nears,
the logo's place opens and pushes the words apart, and the logo drops in
beside its name. Each goes back for its next logo, then leaves.

- Who brings what, and when: `PLAN` in `initKit`, `js/about.js`.
- Edit the sentence in `.kit__line` (each logo is a
  `<span class="chip" data-chip>`, in sentence order).

- Logos are in `assets/tools/`: the app icons of the installed apps (Figma,
  Claude, Cursor, Photoshop, Illustrator), Adobe's own Premiere Pro mark,
  and the Framer mark drawn inline in `index.html`.
- Reduced motion or no JS: the sentence with its logos already in, nothing pins.

**Beyond the pixels**: the title and a line, then a bento of seven tiles
(`.bento`, `.tile`) in three columns, the middle one offset: the sides hold
two tall tiles each, the middle a short one over a taller poster, so they
all end level. Where each tile sits is `.tile--a` to `.tile--f` in
`css/about.css`; the row height is worked out from the width, so the tall
tiles stay a touch wider than tall at any size. It isn't full width (the
section is at most 1180px). Tablets: two offset columns; phones: still a
bento in two columns (the photograph tall beside the two posters, On repeat
across, drawings beside the second photograph). On tablets On repeat is a
tall tile so nothing leaves a gap. The
tiles rise in as they come into view, and on hover the picture leans in and
a ↗ appears. The picture tiles' labels (Photography, Graphic design, Art &
illustration) are small 12px text at the bottom left with no pill, shown only
on hover or keyboard focus over a faint shade (always shown on touch
screens, which can't hover); On repeat has none.

- **Photography:** two tiles, the first two photographs; each opens the
  gallery at its own picture. The photographs are `<li>`s in
  `<ol data-source="photography">` (see the comment there), WebP files in
  `assets/beyond/photography/` (long edge 2000px). They were lightly
  adjusted for brightness, contrast and saturation where needed.
- **Artwork:** two tiles (tagged Poster), the first two pieces in
  `<ol data-source="artwork">`, WebP files in `assets/beyond/artwork/`.
- **The gallery:** one picture at a time over the page itself, softly
  blurred and a little darker (no solid backdrop), each at its own shape and
  about the same size as the others, inside the screen; with ← → and close;
  keys, swipe, Esc, focus kept inside and returned. It simply fades in and
  closes at once. An empty list shows numbered slots marked "to be added".
- **On repeat:** an ink tile with a record coming out of the side (it slides
  out and spins on hover). It opens the songs in a little player
  (`.songs`): dark and warm, the song playing on the left with its cover,
  the songs on the right, back, play/pause and next under them; on phones
  the cover sits small beside the song's name. Each song is a button in
  `.repeat__list` with its Apple Music id in `data-song` (the number after
  `?i=` in its music.apple.com link). It plays the song's Apple Music
  preview: about 30 seconds from the part Apple picks to show it off
  (usually the chorus), for anyone, no sign-in, fading in and out; then the
  next song plays, and after the last it stops. The sound starts straight
  from the click (Safari blocks it otherwise) (`initPlayer` in
  `js/about.js`, a plain `<audio>`). Each song carries its preview and
  cover in `data-preview` and `data-cover` (from Apple's song lookup, see
  the note in `index.html`), so nothing is looked up as the page runs.
  The page holds still behind them, and closing them pauses the song. It
  needs an internet connection. A playlist link is ready in `.repeat__link`
  (set `href`, remove `hidden`). After changing `js/about.js`, rebuild
  `js/bundle.js` (the command above).
- **Art & illustration:** a tile that opens its own gallery: three
  watercolours for now (an apple, a blood orange, a sailboat at sunset),
  `<li>`s in `<ol data-source="drawings">` with WebP files in
  `assets/beyond/drawings/`. The first is the tile's picture. Add more the
  same way.

## The close and the footer

After Beyond the pixels comes the footer, the liquid drop from the v5
footer redone in this palette (`js/outro.js`, `css/outro.css`):

- **The drop:** as you scroll in, a drop falls into place, swells, then
  spreads into the rounded panel, wobbling like a liquid and settling (a
  160-point outline morphing from drop to box, used as a clip-path). It
  follows the scroll through a damped spring, so it stays smooth at any
  speed and frame rate. Keyboard focus shows the whole panel at once.
- **The background:** the hero's own paper (the same shader as the hero:
  warm gradient, moving grain). **Hover:** a swoosh: the cursor leaves a
  short trail, and each point drags the colours along the way it was moving
  inside a soft streak, like a brush through wet paint; it fades within a
  second (`createSwooshPaper` in `js/footer.js`). On touch screens a
  finger dragged across the panel does the same, and a tap flicks a short
  swoosh out from where you touched.
- **The quote** (centred): “The details are not the details. They make the
  design.” — Charles Eames, in PP Fragment (upright; there is no italic cut),
  ink with the second line in terracotta; the attribution sits right under it.
- **Connect** (centred, below the quote): a round LinkedIn button, an
  "Email me" pill that shows gsvarsha11@gmail.com on hover and opens a new
  email to it, and a round Resume button.
- **You, meditating** (bottom left): the hero's blocky character,
  cross-legged on a floor cushion, eyes closed. It is still
  (`buildMeditator` in `js/scene.js`, drawn by `js/footer.js` only when
  something changes). Hover, focus or tap it and its eyes open, and a speech
  bubble pops out (tail pointing back at you, like the hero's): "You found
  me in my peaceful era." with "Explore my story again?", which scrolls back up to About.
  It stays open while the pointer moves into it; Esc or a tap elsewhere
  closes it. On phones a tap opens it straight away (a second tap closes
  it), and it rises above your head.
- **Bottom right:** "Fancy a rally?" with the pixel racket (hover swings
  it, click opens the game), and © 2026 G S Varsha · Portfolio below it.
- Links live in `LINKS` at the top of `js/outro.js`. Resume takes its path
  from the header's Resume link, so it's right on every page. The resume
  is `assets/G-S-Varsha-Resume.pdf`: to update it, replace that file (same
  name). `RESUME_READY` in `js/nav.js` set to false brings back "soon". In
  the one-file share copy the PDF is packed inside, and Resume downloads it.
- Reduced motion: the panel is simply there; the paper and the character
  are still.

## The badminton game

`js/rally-core.js` (rules, physics, GS), `js/rally.js` (drawing, input, the
window), `css/rally.css`. One key: **Space** to hit (and serve); your player
moves forward and back on their own, so it's all timing. Your shot is chosen
for you.

The court is as large as the window allows (as wide as it can be, and as
tall as the room left after the title, score and buttons). On phones the
game takes the whole screen with a big Hit button; held upright the court
runs edge to edge and a line suggests turning the phone, and sideways the
court fills the height with the Hit button beside it.

Singles rules: rally scoring (the rally winner scores and serves); games to
21, won by two, capped at 30; the server serves from the right court on an
even score and the left on an odd one; a serve must land past the
opponent's short service line and inside the back line, or it's a fault;
one hit per side; lines are in.

GS's error rate is fixed (about one shot in seven). `SHARP` and `GS_SPEED`
set how often it wins: with typical human timing (±40–60 ms) it takes about
58–76% of rallies, around 67% at ±50 ms. Mashing Space doesn't work (GS
wins ~98% against it). Tune with
`node tools/rally-sim.cjs "$PWD/js/rally-core.js" [timing-sigma]`.

## Changing things

- **Your avatar:** `LOOK` at the top of `js/scene.js` (skin, hair, shirt, pants). The shoulder-length hair is `longHair()` in the same file, shared by the desk, the About portrait and the footer's meditating pose.
- **Object colours:** `COL` in the same file.
- **Camera framing:** the keyframes `K` (stage 1, stage 2, side, over the
  shoulder) and `FOV_SCREEN`. The timeline is `T` in `scene.js` and the
  comments at the top of `hero.js`. Keep the two in step.
- **Projects:** edit the cards in `index.html`. The laptop screen draws
  itself from those same cards (name, category, thumbnail), so there is one
  place to change. The screenshots are in `assets/projects/`; case-study
  links go in `CASES` in `js/projects.js`.
- **Background:** `paperField` in `js/shaders.js` (lightness ramp) and
  `paperGrain` (the moving grain).

## Performance and accessibility

- The loop runs only while the hero is on screen and the tab is visible.
  The desk stops rendering once the project panel covers it. The paper
  renders at ~30 fps and 1 CSS px per pixel; shadows are 2048px (1024px on
  phones).
- **Reduced motion, no JS or no WebGL:** no pinning. The page is the name above
  a still desk, then the roles and introduction, then the projects, as
  normal content.
- The name is the `h1`; the roles, introduction and projects are real text
  and links. Project links can only be focused once the panel is visible
  (`inert` before that).

