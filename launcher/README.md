# ☠ POISON Client

A **legit** PvP client launcher with 184 features ([full list](FEATURES.md)): a real-time 3D client preview with a cinematic post-processing pipeline, an animated butterfly knife that replaces swords, an in-game music player, a draggable ClickGUI client menu and a heavy dose of (simulated) crypto drip.

## Run it

**Browser (zero install):** serve the folder and open it.

```bash
cd launcher
python3 -m http.server 8765
# open http://localhost:8765
```

Opening `index.html` straight from disk works too. Everything is plain scripts with no build step, and three.js is vendored in `js/vendor/`.

**Desktop app (Electron):**

```bash
cd launcher
npm install
npm start
```

## Highlights

| | |
|---|---|
| **Cinematic motion blur** | True shutter accumulation. Each frame renders the scene *N* times (2–32) across a virtual 1/30 s shutter and averages them in HDR, so camera flicks *and* knife flips smear like a rendered video. Also offers frame-blend and hybrid modes, plus an adaptive governor that holds 45+ FPS. |
| **Post FX** | HDR bloom (two-level), chromatic aberration, ACES filmic tonemap, color grading, vignette, film grain, sharpen, CRT scanlines, 2.39:1 letterbox, and four render presets. |
| **Butterfly knife** | Procedural balisong (clip-point blade, skeletonized channel handles, latch, glowing inlays). Keyframe animator: flip open/close, inspect, twirl, aerial, chatter, slash, stab, spin. 9 skins (fade, doppler swirl, circuit, hex, holographic…). Press **F** to flip and **I** to inspect, and it flips open on hotbar swap. |
| **Chams (self only)** | Fresnel scan-line glow shells on *your own* hand, held item and F5 model. Nothing renders other players or through walls. |
| **Client menu** | **Right Shift** opens a draggable, panel-style ClickGUI with search and right-click settings. The Modules page offers the same 125 modules as a searchable grid. |
| **HUD** | Watermark, rainbow array list, FPS/CPS/ping/coords/speed/memory/clock, compass, keystrokes with CPS, armor, potions, combo, custom crosshairs (incl. ₿), now-playing, crypto ticker, wallet, hotbar glow, spectrum visualizer. |
| **Cosmetics** | Capes with cloth sway, neon wings, halo, orbiting auras, laser eyes, a pet, a glowing nametag and particle trail, all visible in F5 (**V**). |
| **Music player** | Six tracks synthesized live with WebAudio (royalty-free, no audio files), plus your own files. 3-band EQ with presets, 4 visualizers and a sidebar mini player. The bass drives a beat-reactive glow across the whole UI and in-game neon. |
| **Crypto layer** | Market ticker, sparkline charts, play-money **$PSN** wallet, daily airdrop, proof-of-click miner, Fear & Greed gauge (driven by K/D), local block explorer, on-chain badge achievements. *All simulated: no real prices, wallets or network calls.* |
| **Launcher FX** | Boot splash, blockchain-network / hex-rain backgrounds, aurora, grain, glitch logos, conic neon launch button, cursor glow and trail, click sparks, confetti, 3D tilt cards, 6 themes, custom accents, RGB mode, UI sound effects, reduced-motion mode. |

Controls in the preview: **click** to look (free cam) · **WASD / Space / Shift** to move · **LMB** to swing · **F** flip · **I** inspect · **V** F5 · **C** zoom (scroll to adjust) · **1–9** hotbar · **Right Shift** client menu. There's also a secret code (↑↑↓↓←→←→BA).

## Layout

```
launcher/
  index.html          app shell
  css/main.css        all styles / animations
  js/core.js          state, storage, events, toasts, sfx, achievements
  js/modules.js       module registry (125), ClickGUI, Modules grid
  js/knife.js         balisong geometry, skins, keyframe animator, chams shader
  js/world.js         three.js preview scene + post-processing pipeline
  js/hud.js           in-game HUD overlay
  js/music.js         WebAudio synth/sequencer + player UI
  js/crypto.js        simulated market, wallet, miner, explorer
  js/locker.js        cosmetics shop + 3D knife showcase
  js/fx.js            background, cursor, particles, splash, easter egg
  js/app.js           navigation, launch flow, presets, settings
  electron/           desktop shell (frameless window + IPC)
```

## What's real vs. what's a hook

- The whole launcher UI, the 3D preview, every effect, the music player and the cosmetics shop work as shipped.
- **Starting the actual game is a hook.** In Electron, **Launch** writes your full config to `poison-config.json` in the app's user-data folder and calls `startGame()` in `electron/main.js`, which is a documented stub. Wiring it up needs Microsoft account auth plus a game downloader (for example `msmc` and `minecraft-launcher-core`) and the game-side mod that reads the config. In the browser, Launch runs the animated sequence in demo mode.
- Settings persist in `localStorage`, and configs can be exported, imported or copied as JSON.

Not affiliated with Mojang or Microsoft. Crypto elements are simulated and the $PSN currency is play-money with no value.
