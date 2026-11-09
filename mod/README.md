# POISON in-game client (Fabric, Minecraft 1.21.4)

The in-game half of POISON. The launcher bundles this mod and installs it automatically for 1.21.4 + Fabric.

```bash
cd mod
./gradlew build            # -> build/libs/poison-client-<version>.jar  (needs JDK 21)
```

Requires Fabric Loader ≥ 0.16 and Fabric API. Every module is legit: visual, HUD, QoL or audio. Chams only affect your own player.

| Key (rebindable in Controls → POISON) | Action |
|---|---|
| Right Shift | client menu |
| R / I | flip / inspect butterfly knife |
| Z | zoom (scroll to adjust) |
| [ / ] / \ | music previous / next / play-pause |

Code map: `module/` (modules + settings), `config/` (poison.json + launcher import), `gui/` (ClickGUI), `hud/`, `render/MotionBlur`, `knife/` (balisong geometry + keyframe animator), `music/` (OGG/WAV streaming player), `mixin/`.

`tools/bake-music.js` re-renders the bundled POISON FM tracks from the launcher's synth (needs Playwright + ffmpeg).
