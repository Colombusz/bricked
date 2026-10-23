# Bricked

A browser playground for stacking colorful, interlocking bricks. Built with Vite, TypeScript, Three.js, and plain DOM controls. All parts, studs, lighting, sounds, and thumbnails are generated locally. No backend or model downloads.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The first visit starts with an editable little house. Use the **Clear build** trash button in the bottom-left tools for a blank baseplate. Your latest build is restored on subsequent visits.

The controls guide opens each time the page loads. Choose **Start building**, use the close button, or press Esc to dismiss it. Reopen it with the **?** button in the bottom-left tools or the **?** key. On smaller screens, the guide scrolls while its close and start buttons stay visible.

## Build and deploy

```sh
npm run build
npm run preview
```

Publish the contents of `dist/` to a static host. Assets use relative paths, so subdirectory hosting also works. There are no secrets, environment variables, or server functions to configure. The font is bundled with the application.

For Vercel, import this repository with the project root as the Root Directory. The included `vercel.json` selects Vite, runs `npm run build`, and serves `dist/`.

## Controls

| Action | Desktop |
| --- | --- |
| Place selected piece | Left click |
| Rotate 90° | R or rotate chip |
| Mirror lopsided L | M or Mirror chip; available for L 2×3 and L 2×4 |
| Straight / L-shaped parts | L-shaped filter button after the category tabs |
| Select previous / next part | [ / ] or tray arrows |
| Scroll parts | Wheel over the tray, or drag |
| Deselect part | Click selected part again, or Esc |
| Collapse / expand parts | Chevron at the end of the strip / armed-part pill |
| Select a palette color | 1–9 for the first nine colors, or click the right-side strip |
| Axis lock | Hold Shift while a part is armed, or toggle the Axis chip |
| Layer lock | L or the Layer chip |
| Raise / lower locked layer | E / Q, or ▲ / ▼; enables the lock and steps by the armed part's height (outside fly mode) |
| Orbit | Alt + left drag |
| Pan | Middle mouse drag |
| Dolly toward pivot | Mouse wheel |
| Look / fly | Hold right mouse and drag; pointer lock where supported |
| Move while flying | W / A / S / D |
| Fly down / up | Q / E |
| Fast fly | Hold Shift while right mouse is held (3×) |
| Adjust fly speed | Wheel while holding right mouse |
| Frame whole build | F or frame button, centered between the overlays |
| Hide / show overlays | H; fullscreen button remains visible |
| Build / erase tool | B / X, or tool buttons |
| Delete hovered brick | Delete, Backspace, or X |
| Undo | Ctrl+Z / Cmd+Z |
| Redo | Ctrl+Shift+Z / Cmd+Shift+Z (also Ctrl+Y) |
| Export JSON | Save build or Ctrl+S / Cmd+S |
| Controls cheat sheet | ? or help button |
| Settings | Gear in the bottom-left tools: sensitivity, fine-tune, floating and sound |
| Clear build | Trash button, then confirm; Ctrl+Z or toast Undo restores everything |
| Fullscreen | Bottom-right button; Esc exits |
| Axis view | Click x, y, or z in the orientation control |

On touchscreens: drag with one finger to orbit, pinch to zoom, drag with two fingers to pan, and tap with less than 6 px movement to place. Swipe the parts strip horizontally and scroll the color strip vertically. Axis/Layer chips, layer arrows, Rotate and the relevant Mirror chip expose placement controls without a keyboard. Long-press a saved-palette color to enter color removal mode.

Every camera drag blocks placement and hides the ghost, whether or not a piece is armed. Camera movement is damped; placement snaps instantly. Moving onto an interactive panel hides the ghost. Hotkeys are ignored while inputs, selectors, sliders, or the color wheel have focus.

Axis lock starts at the ghost's current position. After one stud of travel it chooses X or Z, fixes the other coordinate and the layer, and displays a colored guide. Layer lock intersects a fixed horizontal plane and disables automatic lifting. Collisions and unsupported targets still show red. Locks survive part/color changes and clear on deselection. Q lowers and E raises by the armed part’s height, enabling layer lock on the first press. Auto-repeat is ignored; limits clamp and flash the chip. With right mouse held, Q/E fly instead and leave the layer unchanged. With no part armed, Q/E do nothing outside fly mode. PageUp/PageDown have no binding.

## Colors, palettes and settings

The right-side strip selects colors independently of the parts carousel. Its top swatch opens the palette flyout; **+** opens it with Custom color expanded. The HSV wheel supports dragging and arrow-key nudges. Brightness, a hex field (three or six hex digits), and a preview chip are available underneath. Color changes update the ghost material without rebuilding brick geometry or instance batches.

Classic is read-only. **Add to palette** from Classic creates or reuses **My colors**. Create, rename, duplicate and delete palettes in the flyout. **Edit colors** exposes removal buttons; long-press does the same on touch. Limits are 24 colors per palette and 20 palettes including Classic, configurable in `src/config.ts`. Recent contains the last 12 distinct colors actually used on placed bricks.

Palette switching preserves the current literal color until you choose another swatch. Palette edits/deletion never recolor existing bricks. Palettes, active palette, selected color, recent colors and carousel collapse/filter state survive reloads.

Settings offers a 0.2×–3× master sensitivity in 0.05 steps. Fine-tune separately scales rotation, pan, zoom and fly speed; each effective value is master × fine-tune. Invert Y affects look/orbit, including touch orbit. Mouse look uses 0.12 degrees per Pointer Lock pixel before multipliers and smoothing. Reset restores sensitivity defaults, floating off, and sound on; it leaves builds and palettes intact.

## Building rules

- One stud pitch is one world unit. One plate is 0.4 units high; a brick is three plates.
- Integer cell origins, 0/90/180/270° rotations and optional mirror state determine occupied-cell masks. Origins belong to the oriented bounding box. Body edges are inset along their normals to show seams, including notch edges.
- The ground extends indefinitely in X/Z, including negative grid coordinates. The build height remains 96 plate layers, configurable in `src/config.ts`. Existing saves keep their original positions; `gridOriginOffset` retains the original coordinate origin.
- Without placement locks, top hits place on top, side hits place flush at the hit brick's base layer, and occupied targets lift to the nearest free plate layer.
- A new piece needs at least one occupied cell above a supporting stud, so overhangs are allowed. Empty notches neither collide nor provide/receive support; rays pass through them. All tiles, including L-tiles, have flat tops and provide no stud support.
- Invalid targets show red and cannot be committed. **Allow floating bricks** relaxes support only; height limits and collision checks still apply.
- Removing a supporting piece leaves pieces above it in place. There is no physics simulation.

All 76 parts are available, with 14 Classic colors and arbitrary custom colors:

| Category | Straight | L-shaped | Total |
| --- | ---: | ---: | ---: |
| Bricks, 3 plates high | 18 | 8 | 26 |
| Plates, 1 plate high | 21 | 8 | 29 |
| Tiles, 1 plate high | 13 | 8 | 21 |

Straight sizes range up to 1×12, 4×8 bricks, 8×8 plates, and 6×6 tiles. Each category has L 2×2, 2×3, 2×4, 3×3, 3×3·2, 4×4, 4×4·2 and 6×6·2. The ·2 label means two-stud-wide arms. At 0° an L’s elbow is always at min-x/min-z, with arms along +x/+z. M reflects across the local left/right axis before R rotation; only the unequal-length 2×3 and 2×4 Ls have a distinct mirror. Symmetric pieces ignore M and hide its chip. Slopes, rounds, and arches remain deferred.

The L filter shows only L-shaped parts in the current category. Switching tabs or filter leaves the armed piece selected and scrolls the row to its start. Straights are grouped by width; Ls sort by occupied cell count. The strip remains 64 px on desktop and 56 px on phones. A flat placeholder holds each thumbnail’s space while a single offscreen renderer creates requested views in two-piece batches at 2× resolution; unseen views stay unrendered. A collapsed start renders only the armed-part pill thumbnail until you expand the strip. On the narrowest phones, the constraint controls use two compact rows when Mirror is present so the color strip remains clear.

The ground has no buildable horizontal edge. A fixed pool of 9,216 nearby stud instances follows the camera; a generated repeating material covers the far surface and fades into studio fog. Ground geometry stays bounded as you explore. Pan or fly to extend a build; F still frames the pieces you have placed. The original 32×32 size now describes only the starter/stress layout and empty-scene framing, not a placement limit.

## Saving

Changes save automatically to `localStorage` in the current browser. **Save build** downloads a versioned JSON file. **Build options → Import build** restores a file after checking types, integer coordinates, height limits, IDs, rotations, colors, and overlaps. Malformed known pieces leave the current build intact. Unknown type IDs are skipped with a console warning and an “N pieces skipped” toast; the valid remainder loads normally. Files may contain floating pieces.

Clear, starter load, and import are undoable. History retains up to 200 commands for the current session. History itself is not saved across reloads. Rename a project by clicking its name in the bottom-left corner.

Clearing resets occupancy and instance counts as one operation, with no per-piece animations or sounds. The confirmation and six-second Undo toast stay inside the fullscreen root. Build JSON and autosaves retain version 1. The optional boolean `mirror` defaults to false in older files; existing IDs, origins, rotations and literal hex colors retain their meaning. New L IDs follow `bricks-l-2x3-t1` / `plates-l-4x4-t2` / `tiles-l-6x6-t2`. Mirror is preserved by commands, autosave and JSON export. Preferences use separate versioned keys and safe, validated localStorage access. With storage unavailable, palettes/settings work in memory and JSON export remains available.

Fullscreen applies to the application root, including all controls. Browsers without the API use a fixed, viewport-sized mode. Both standard and WebKit fullscreen events are handled.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/config.ts` | Grid dimensions and interaction constants |
| `src/grid.ts` | Unbounded sparse occupancy, support, collision, height limits, occupied-bounds DDA ray traversal |
| `src/ground.ts` | Camera-following ground, nearby instanced studs and a repeating far surface |
| `src/bricks/catalog.ts` | Catalog data, cached oriented/mirrored masks, exposed outlines, mirror eligibility and colors |
| `src/bricks/geometry.ts` | Lazy beveled outline extrusions, baked mirror variants and occupied-cell studs |
| `src/bricks/renderer.ts` | Per-type instancing, capacity growth, commit animation |
| `src/bricks/thumbnails.ts` | One offscreen renderer, reused for all thumbnail images |
| `src/placement.ts` | Grid targets, hysteresis, ghost, footprint outline |
| `src/placementConstraints.ts` | Axis anchor, layer lock and height stepping |
| `src/snapping.ts` | Shared grid hysteresis |
| `src/cameraController.ts` | Damped fly, orbit, pan, framing, and touch navigation |
| `src/ui/` | Parts tray, colors, toolbar, dialogs, and HUD |
| `src/ui/colorPanel/` | HSV wheel, palette store, right-side strip and editor |
| `src/ui/settings.ts` | Compact settings popover and live controls |
| `src/ui/toolbar.ts` | Clear confirmation and bottom-left tools |
| `src/ui/popover.ts` | Root-mounted popovers with close/toggle/outside dismissal |
| `src/storage.ts` | Safe localStorage reads/writes shared across modules |
| `src/settingsStore.ts` | Validated, versioned camera and behavior preferences |
| `src/fullscreen.ts` | Standard API, WebKit fallback, CSS maximize |
| `src/history.ts` | Place/delete/replace command stack |
| `src/persistence.ts` | Versioned import/export and local autosave |
| `src/audio.ts` | Short synthesized plastic click and mute preference |
| `src/starter.ts` | Editable starter and deterministic stress builds |

## Verification

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run test:revision
npm run test:catalog
npm run test:world
npm run test:controls
```

The browser script starts Vite on port 5174 if necessary. `BRICKED_URL` can point it at an existing server, and `BRICKED_CHROMIUM` can select an existing Chromium executable. It records screenshots and JSON results under `test-results/`.

The revision suite starts its own server on port 5176 and verifies the compact layout, color editor, saved palettes, input isolation, constraints, batched clear, sensitivity ratios, touch popovers, corrupt/unavailable storage, and pre-revision build compatibility.

The world suite verifies placement across both old edges, negative/distant coordinates, camera-following terrain, picking, undo/redo, autosave and bounded ground resources.

The controls suite checks the automatic welcome dialog, blocked building shortcuts, keyboard focus and dismissal, question-mark reopening, reload preservation, and scrolling portrait/landscape touch layouts.

The catalog suite also starts port 5176 and checks Q/E vs fly, all catalog views, notch placement in both orders, L rotations/mirrors, lazy thumbnail contexts, phone chips, old/unknown saves, reusable ghost buffers, and mixed-type stress/clear/undo.

See [VERIFICATION.md](VERIFICATION.md) for the recorded acceptance checklist, control-by-control browser results, and performance limits.

The unit suite checks exact one-stud-offset stacking, collision lifting, support and tile rules, bounds, rotation, DDA faces, hysteresis, import validation, starter validity, and command history. The Chromium suite exercises placement, camera input, all part categories and colors, fullscreen and its fallback, dialogs, file round trips, autosave, responsive layouts, real touch gestures, and instancing at 2,000 pieces.

Press **Ctrl+Shift+B** (Cmd+Shift+B on macOS) to replace the scene with 1,000 pieces across 24 types, including rotated/mirrored Ls, for stress testing. The deterministic fixture packs three-plate shelves and intentionally permits floating pieces. Undo restores the preceding build. The hidden developer hook `window.__bricked.stress(2000)` can exercise a larger scene.

Performance measures include shared, indexed geometries; one colored `InstancedMesh` per used type/mirror variant, with no visible empty meshes; lazy geometry and instance creation; cached masks and reusable ghost/ray/outline buffers; capacity doubling; a pixel ratio capped at 2; shadow updates for scene changes; and no scene renders while idle. Hardware frame-rate targets should be profiled on the intended laptop and phone; software-rendered headless Chromium is a functional check, not a device FPS benchmark.

## Defaults and assumptions

- Plain DOM UI, desktop-first, with a responsive touch layout.
- An editable starter scene rather than a blank first visit.
- Orbit and wheel dolly use a shared pivot; F resets it to the build's center.
- Floating is off by default; a chosen setting persists. Deleting supports never cascades.
- Native fullscreen is preferred; unavailable or rejected requests use CSS maximize.
- All 76 requested parts are included. Existing type IDs stay unchanged; all L IDs explicitly include arm width. Slopes, rounds and arches remain deferred.
- Mirror acts in local coordinates before rotation. Equivalent mirrored orientations are deliberately ignored for symmetric pieces.
- Q/E had no competing tool binding; the eraser remains X. Layer heights are measured in plates, and the chip readout is included.
- Classic counts toward the 20-palette limit. Palette switching keeps the current color. New editable palettes start empty.
- Palette drag-reordering is deferred. Axis/layer controls, H-to-hide and Recent are included.

The **br.** icon is available as [SVG](public/logo.svg) and [512px transparent PNG](public/logo.png). It uses the existing wordmark's DM Sans weight 1000 outlines, charcoal `#263039`, coral `#e95642` period, and matching letter spacing. The SVG works without loading a font. Browser and touch icons live in `public/brand/` and are linked from `index.html`.

DM Sans is distributed under the SIL Open Font License; its license is included in `public/fonts/OFL.txt`.
