# Verification

Verified 23 October 2026 using Playwright and Chromium, including real CDP touch input. Browser WebGL used SwiftShader, so these results verify behavior and instancing rather than hardware frame rates.

- **PASS:** `npm run build` produces a static `dist/` with relative assets and the bundled font.
- **PASS:** `npm test`, all 9 logic tests.
- **PASS:** `npm run test:browser`, all 17 browser checks.
- **PASS:** Production preview smoke check: scene, thumbnails, placement/undo, fullscreen, labeled dialogs, floating toggle, final text colors, and zero console errors.

Machine-readable results: [browser checks](test-results/browser-results.json), [production check](test-results/production-results.json). Screenshots: [desktop](test-results/production.png), [mobile starter](test-results/mobile-starter.png), [mobile placement](test-results/mobile.png). Run the browser suite to regenerate these local artifacts.

## Acceptance checklist

| Requirement | Result and evidence |
| --- | --- |
| Offset 2×4 stacking | PASS. Browser placed the upper brick at x+1, the same z, and y=3 plates. Occupancy contained exactly 48 cells. |
| Stable grid snapping | PASS. Slow forward/backward boundary traversal produced x positions 20, 20, 21, 21, 20. All coordinates remained integers. |
| Invalid placement | PASS. Out-of-bounds ghost was red and click retained the piece count. Tiles rejected attachments until floating was explicitly enabled. |
| Scene-view camera | PASS. Alt orbit, middle pan, wheel dolly, right-mouse pointer lock, WASD/QE movement, Shift movement, wheel fly-speed adjustment, F framing, and axis buttons were exercised. Navigation did not place bricks. |
| Carousel | PASS. All 17 parts and 14 colors were selected. Repeated selection deselected. Wheel, touch swipe, arrows, and bracket shortcuts worked. Image data came from the shared offscreen renderer. |
| Fullscreen | PASS. Native fullscreen targeted `#app`, preserved the parts tray, and synchronized aspect ratio. CSS fallback entered and exited with Escape. |
| History and console | PASS. Place/delete/clear/import and starter replacement were undoable. Keyboard and button undo/redo preserved piece counts. No browser console or page errors. |

## Recorded click-through

| Control | Observed action |
| --- | --- |
| Bricks / Plates / Tiles | Rendered 9 / 5 / 3 available pieces; selected a piece immediately. |
| Every part | Changed the armed part; clicking the selected part again disarmed it. |
| Every color | Updated the selected color and ghost material. |
| Previous / next arrows | Changed selection and brought it into view. |
| Carousel wheel / swipe | Changed horizontal scroll position. |
| Build / eraser | Switched between placement and deletion; eraser removed the hovered piece. |
| Rotate | Changed rotation by 90 degrees; R produced the next rotation. |
| Frame | Framed build bounds; F also worked. |
| Undo / redo | Restored and removed placed/deleted pieces in order. |
| Save build | Downloaded valid JSON matching the current scene and project name. |
| Import build | Opened the native file chooser. Invalid JSON retained the scene and showed an error. Exported JSON restored exactly. |
| Clear playground | Confirmation cancel retained the scene; confirm emptied it; undo restored it. |
| Load starter | Confirmation loaded all 271 valid starter pieces. Undo restored the preceding build. |
| Project name | Rename dialog saved the new name; Escape dismissed the dialog. |
| Header help / bottom help / ? | Opened controls; close and Escape dismissed them. |
| Allow floating | Enabled unsupported placement; production check also switched it off again. |
| Sound | Mute and unmute changed audio state and the button label. Placement generated Web Audio without errors. |
| Fullscreen | Entered/exited native fullscreen; feature-disabled fallback toggled CSS maximize. |
| x / y / z views | Moved the camera to each axis view. |

Responsive checks covered desktop widths 600, 768, 1024, and 1440, plus touch viewports 390×844, 320×568, and 844×390. No document overflow; the tool rail remained inside short portrait and landscape viewports. Real touch tap placed one brick; one-finger orbit, two-finger pinch/pan, and tray swipe changed their intended states.

## Performance evidence

The 2,000-brick scene used **5 draw calls**. Instance capacity grew to accommodate it. After camera movement and pointer activity stopped, the renderer frame count remained unchanged. A 500-brick scene also loaded in the touch viewport. Large stress scenes used a reduced pixel ratio in the software renderer to keep this functional check practical. Desktop and phone FPS targets still require profiling on actual target devices.

## Design delivery gate

### Hard gates

- R-02 PASS: no em dashes in authored UI or documentation.
- R-03 PASS: responsive viewport and touch checks above; short screens use a horizontal tool rail.
- R-17 PASS: displayed piece counts come from the live grid.
- R-18 PASS: no testimonials or invented identities.
- R-23 PASS: geometry and thumbnails follow the requested procedural brief; branding is the supplied product name as text.
- R-24 PASS: every visible action has implemented behavior; no placeholder navigation.
- R-25 PASS: final small studio text has contrast at least 4.63:1 against the darkest studio background. Axis labels measure 5.29:1 or higher; selected part text measures 5.03:1. Final computed text colors were checked in production.
- R-26 PASS: interactive controls were exercised in the click-through above.
- R-27 PASS: setup text, an empty playground, invalid ghost/status, invalid-import errors, and storage-error handling exist.
- R-28 PASS: no template FAQ.
- R-32 PASS: native buttons/inputs, visible focus styles, keyboard commands, labeled dialogs, and Escape dismissal.
- R-33 PASS: features live directly in the source modules and stylesheets.
- R-34 PASS: one studio theme, consistently implemented.
- R-35 PASS: production build, unit tests, browser checks, screenshots, and production smoke verification recorded above.
- R-36 PASS: no unsupported security, customer, or FPS claims.
- R-37 PASS: the user's studio-toy direction is recorded in `DESIGN.md`.
- R-38 PASS: all shown pieces and the starter house are real editable geometry.

### Purpose gates

- R-01 PASS: the subtle studio gradient supports spatial depth; the interface uses a coral selection accent.
- R-04 PASS: icons depict building, erasing, rotation, framing, history, files, sound, and fullscreen.
- R-06 PASS: rounded DM Sans connects the wordmark and controls to the toy character.
- R-07 PASS: the stud grid is the working building surface, not decorative background pattern.
- R-08 PASS: arrows navigate the parts tray and carry directional meaning.
- R-09 PASS: interface states reflect current selection and actual save state; no promotional badges.
- R-10 PASS: two persistent frosted surfaces, tray and tools; the modal backdrop uses a plain shade.
- R-12 PASS: shadows locate physical objects and elevate the two persistent control surfaces.
- R-13 PASS: the ghost highlight identifies the active placement target.
- R-14 PASS: no marketing feature cards.
- R-19 PASS: brief commit motion answers placement; damped camera motion preserves orientation; reduced motion disables the commit animation.
- R-22 PASS: the visual is the actual procedural playground.

### Liveliness and craft

- PASS: energy 2, rhythm 2, motion 2, with direction and reasons in `DESIGN.md`.
- PASS: one focal point, the editable 3D build; tools occupy the perimeter.
- PASS: structural whitespace, one interface accent, and a rounded typographic identity.
- C-1 PASS: major visual decisions have written product-specific reasons.
- C-2 PASS: the click-through exercises every family of interactive control.
- C-3 PASS: the application contains the requested playground and its controls.
- C-4 PASS: desktop, narrow, short, touch, empty, invalid, and modal states were checked.
- C-5 PASS: scene counts and instancing measurements come from actual application state.
- R-05 PASS: a canvas-centered application layout follows the building workflow.
- R-11 PASS: large tray corners, smaller control corners, and circular color swatches follow functional hierarchy.
- R-15 PASS: actions use concrete labels such as Save build, Import build, and Clear playground.
- R-16 PASS: interface copy uses plain building language.
- R-20 PASS: the studded playground, rendered parts, material palette, and toy typography establish its identity.
- R-21 PASS: the light studio theme follows the requested backdrop and material treatment.
- R-29 PASS: neutral interface plus coral accent; the separate material palette contains the requested 14 brick colors.
- R-30 PASS: composition is built around this sandbox's part selection and direct manipulation.
- R-31 PASS: color, typography, spacing, icons, lighting, motion, and layout reasons are recorded.
