# Bricked

A browser playground for stacking colorful, interlocking bricks. Built with Vite, TypeScript, Three.js, and plain DOM controls. All parts, studs, lighting, sounds, and thumbnails are generated locally. No backend or model downloads.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The first visit starts with an editable little house. Use the **Clear build** trash button in the bottom-left tools for a blank baseplate. Your latest build is restored on subsequent visits.

## Build and deploy

```sh
npm run build
npm run preview
```

Publish the contents of `dist/` to a static host. Assets use relative paths, so subdirectory hosting also works. There are no secrets, environment variables, or server functions to configure. The font is bundled with the application.

## Controls

| Action | Desktop |
| --- | --- |
| Place selected piece | Left click |
| Rotate 90° | R or rotate button |
| Select previous / next part | [ / ] or tray arrows |
| Scroll parts | Wheel over the tray, or drag |
| Deselect part | Click selected part again, or Esc |
| Collapse / expand parts | Chevron at the end of the strip / armed-part pill |
| Select a palette color | 1–9 for the first nine colors, or click the right-side strip |
| Axis lock | Hold Shift while a part is armed, or toggle the Axis chip |
| Layer lock | L or the Layer chip |
| Raise / lower locked layer | PageUp / PageDown, or ▲ / ▼; steps by the armed part's height |
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

On touchscreens: drag with one finger to orbit, pinch to zoom, drag with two fingers to pan, and tap with less than 6 px movement to place. Swipe the parts strip horizontally and scroll the color strip vertically. Axis/Layer chips and their layer arrows expose the constraints without a keyboard. Long-press a saved-palette color to enter color removal mode.

Every camera drag blocks placement and hides the ghost, whether or not a piece is armed. Camera movement is damped; placement snaps instantly. Moving onto an interactive panel hides the ghost. Hotkeys are ignored while inputs, selectors, sliders, or the color wheel have focus.

Axis lock starts at the ghost's current position. After one stud of travel it chooses X or Z, fixes the other coordinate and the layer, and displays a colored guide. Layer lock intersects a fixed horizontal plane and disables automatic lifting. Collisions and unsupported targets still show red. Locks survive part/color changes and clear on deselection.

## Colors, palettes and settings

The right-side strip selects colors independently of the parts carousel. Its top swatch opens the palette flyout; **+** opens it with Custom color expanded. The HSV wheel supports dragging and arrow-key nudges. Brightness, a hex field (three or six hex digits), and a preview chip are available underneath. Color changes update the ghost material without rebuilding brick geometry or instance batches.

Classic is read-only. **Add to palette** from Classic creates or reuses **My colors**. Create, rename, duplicate and delete palettes in the flyout. **Edit colors** exposes removal buttons; long-press does the same on touch. Limits are 24 colors per palette and 20 palettes including Classic, configurable in `src/config.ts`. Recent contains the last 12 distinct colors actually used on placed bricks.

Palette switching preserves the current literal color until you choose another swatch. Palette edits/deletion never recolor existing bricks. Palettes, active palette, selected color, recent colors and carousel collapse state survive reloads.

Settings offers a 0.2×–3× master sensitivity in 0.05 steps. Fine-tune separately scales rotation, pan, zoom and fly speed; each effective value is master × fine-tune. Invert Y affects look/orbit, including touch orbit. Mouse look uses 0.12 degrees per Pointer Lock pixel before multipliers and smoothing. Reset restores sensitivity defaults, floating off, and sound on; it leaves builds and palettes intact.

## Building rules

- One stud pitch is one world unit. One plate is 0.4 units high; a brick is three plates.
- Integer cell origins and 0/90/180/270° rotations determine occupancy. Meshes are slightly inset to show seams.
- The baseplate is 32×32 studs, with 96 plate layers of build height. Change these in `src/config.ts`.
- Without placement locks, top hits place on top, side hits place flush at the hit brick's base layer, and occupied targets lift to the nearest free plate layer.
- A new piece needs at least one supporting stud, so overhangs are allowed. Tiles have flat tops and provide no stud support.
- Invalid targets show red and cannot be committed. **Allow floating bricks** relaxes support only; bounds and collision checks still apply.
- Removing a supporting piece leaves pieces above it in place. There is no physics simulation.

All 17 MVP parts are available: nine brick sizes, five plates, and three tiles, with 14 Classic colors and arbitrary custom colors. Slopes, rounds, and arches are left for a later catalog expansion.

## Saving

Changes save automatically to `localStorage` in the current browser. **Save build** downloads a versioned JSON file. **Build options → Import build** restores a file after checking types, integer coordinates, bounds, IDs, rotations, colors, and overlaps. Invalid files leave the current build intact. Files may contain floating pieces.

Clear, starter load, and import are undoable. History retains up to 200 commands for the current session. History itself is not saved across reloads. Rename a project by clicking its name in the bottom-left corner.

Clearing resets occupancy and instance counts as one operation, with no per-piece animations or sounds. The confirmation and six-second Undo toast stay inside the fullscreen root. Build JSON and autosaves retain version 1 because pieces already stored literal hex colors; files from before this revision still load unchanged. Preferences use separate versioned keys and safe, validated localStorage access. With storage unavailable, palettes/settings work in memory and JSON export remains available.

Fullscreen applies to the application root, including all controls. Browsers without the API use a fixed, viewport-sized mode. Both standard and WebKit fullscreen events are handled.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/config.ts` | Grid dimensions and interaction constants |
| `src/grid.ts` | Sparse occupancy, support, collision, bounds, 3D DDA ray traversal |
| `src/bricks/catalog.ts` | Part dimensions and color palette |
| `src/bricks/geometry.ts` | Cached beveled bodies and rounded stud geometry |
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
```

The browser script starts Vite on port 5174 if necessary. `BRICKED_URL` can point it at an existing server, and `BRICKED_CHROMIUM` can select an existing Chromium executable. It records screenshots and JSON results under `test-results/`.

The revision suite starts its own server on port 5176 and verifies the compact layout, color editor, saved palettes, input isolation, constraints, batched clear, sensitivity ratios, touch popovers, corrupt/unavailable storage, and pre-revision build compatibility.

See [VERIFICATION.md](VERIFICATION.md) for the recorded acceptance checklist, control-by-control browser results, and performance limits.

The unit suite checks exact one-stud-offset stacking, collision lifting, support and tile rules, bounds, rotation, DDA faces, hysteresis, import validation, starter validity, and command history. The Chromium suite exercises placement, camera input, all part categories and colors, fullscreen and its fallback, dialogs, file round trips, autosave, responsive layouts, real touch gestures, and instancing at 2,000 pieces.

Press **Ctrl+Shift+B** (Cmd+Shift+B on macOS) to replace the scene with 1,000 bricks for stress testing. Undo restores the preceding build. The hidden developer hook `window.__bricked.stress(2000)` can exercise a larger scene.

Performance measures include shared, indexed geometries; one colored `InstancedMesh` per used part type; capacity doubling; a pixel ratio capped at 2; shadow updates for scene changes; and no scene renders while idle. Hardware frame-rate targets should be profiled on the intended laptop and phone; software-rendered headless Chromium is a functional check, not a device FPS benchmark.

## Defaults and assumptions

- Plain DOM UI, desktop-first, with a responsive touch layout.
- An editable starter scene rather than a blank first visit.
- Orbit and wheel dolly use a shared pivot; F resets it to the build's center.
- Floating is off by default; a chosen setting persists. Deleting supports never cascades.
- Native fullscreen is preferred; unavailable or rejected requests use CSS maximize.
- This release includes the full MVP catalog. Later part shapes remain deferred.
- Classic counts toward the 20-palette limit. Palette switching keeps the current color. New editable palettes start empty.
- Palette drag-reordering is deferred. Axis/layer controls, H-to-hide and Recent are included.

DM Sans is distributed under the SIL Open Font License; its license is included in `public/fonts/OFL.txt`.
