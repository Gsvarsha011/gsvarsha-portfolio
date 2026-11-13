# Images for the case studies

Drop images into the project's folder, then tell Claude they're in:

- `incoming/<project>/screens/`: anything for inside the case study
- `incoming/<project>/thumbnail/`: a new picture for the home-page card (optional)

Any file names work. PNG or JPG, exported at 2x; a whole Figma page as
one PDF works too (Claude cuts it into sections). In SpatialLite
screens only, the client's logo is swapped for the word LOGO before it
goes on the site (see `tools/swap-logo.js`); the originals stay here,
untouched. Each image's shape is
listed below, but it's only a guide: images don't have to match it.
"Needed" items fill an empty slot on the page. Leave out anything you
don't have, and its slot is removed.

## Spacture AI: `incoming/spacture-ai/screens/`

- [ ] Website structure / sitemap (FigJam), 4:3, needed
- [ ] The original Spacture website, before your redesign, 16:10, optional
- [ ] Audit or competitive analysis, 4:3, optional
- [ ] Early concept + 2 alternative directions (Figma frames), 4:5 each, optional
- [ ] Mobile layouts, 3 or 4 phone frames side by side, 21:9, optional

## SpatialLite: `incoming/spatiallite/screens/`

Only screens that are cleared for sharing.

- [ ] Product overview, 16:9, needed (also used as the cover)
- [ ] User journey (FigJam), 21:9, needed
- [ ] Card designs, 4:3, needed
- [ ] A card in context, 4:3, needed
- [ ] Card states: at rest, hover or tap, open, 3:4 each, needed
- [ ] Final interface, 16:10, needed
- [ ] Research that shaped the journey, 16:9, optional

## Craft: `incoming/craft/screens/`

- [ ] An early generated version, before your refinements, 16:10, optional

## Flex Academy: `incoming/flex-academy/screens/`

- [ ] Page structure / wireframe (Figma), 3:4, needed
- [ ] Audience map / user flow (FigJam), 4:3, optional
- [ ] Mobile layouts, 3 or 4 phone frames side by side, 21:9, optional
