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

**Windows app (.exe):** grab `POISON-Client-<version>-portable.exe` (no install, just run it), or build it yourself:

```bash
cd launcher
npm install
npm start                 # run the desktop app from source
npm run dist:win          # builds ../mod (JDK 21), then dist/POISON-Client-1.4.2-portable.exe (+ setup.exe on Windows)
```

The `Build POISON Client (Windows)` GitHub Action builds the portable exe **and** the installer on a Windows runner (Actions tab → Run workflow → download the artifact).

### Desktop app: real accounts + real game

1. **Sign in with Microsoft.** Microsoft's own login page opens in a popup, so POISON never sees your password. Tokens are refreshed automatically and stored **encrypted** with Windows DPAPI (`accounts.bin`). Multiple accounts are supported. You need to own Minecraft: Java Edition.
2. **Pick a version + loader.** The version list comes live from Mojang. **Fabric** installs the latest stable loader automatically; versions Fabric doesn't support (e.g. 1.8.9) fall back to Vanilla.
3. **Launch.** POISON downloads the official Mojang **Java runtime** for that version (no Java install needed), the client jar, libraries, natives and every asset, each SHA-1 verified, then starts the game with your RAM, JVM args and resolution settings. Live progress and errors show in the launch overlay.

Game files live in `%APPDATA%\.poison-client` (separate from `.minecraft`). Put Fabric mods in its `mods` folder (Settings → Mods folder).

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
  electron/main.js    desktop shell: window, IPC
  electron/auth.js    Microsoft -> Xbox -> Minecraft login (msmc), encrypted token store
  electron/game.js    versions, Fabric, verified asset download, launch (minecraft-launcher-core)
  electron/java.js    downloads + verifies Mojang's Java runtimes
  build/              icon + exe resource stamping hook
```

## POISON in-game (Minecraft 1.21.4 + Fabric)

The exe ships the **POISON Fabric mod** ([`../mod`](../mod)) plus Fabric API. Choose **1.21.4 + Fabric** (the home screen badge turns green; one click switches) and the launcher installs them into the game's `mods` folder automatically. For other versions it removes its own files so they can't break anything; your own mods are never touched.

In game you get 26 legit modules, all real and all toggleable from the **Right Shift** client menu (draggable panels, sliders, modes, colors, search):

- **Motion blur:** accumulation blur composited before the HUD, so the HUD stays sharp, with strength and FPS-independent options.
- **Butterfly knife:** every sword becomes an animated balisong in first person: flip (**R**), inspect (**I**), idle chatter, twirl or aerial, flip open on hotbar swap, 9 skins, item-chams glow. A built-in resource pack shows it in the inventory and in third person too.
- **Self chams:** outline glow on *your own* player in F5. **Zoom** (hold **Z**, scroll to adjust), Time Changer, No Hurt Cam, Low Fire, Toggle Sprint and HODL Mode (Q twice to drop a sword).
- **HUD:** watermark, rainbow array list, FPS / CPS / ping (+ gas meter) / coords / clock, keystrokes, armor durability, now playing, simulated crypto ticker, toggle notifications.
- **Music player:** the six POISON FM tracks (baked from the launcher's synth) plus your own `.ogg` / `.wav` in the Music folder. **[** **]** previous / next, **\\** play / pause. The HUD glow pulses with the bass.

Settings you change in the launcher (module toggles, knife skin, colours, zoom…) carry over the next time the game starts, and in-game changes are saved to `config/poison.json`.

## What's real vs. preview

- **Real:** Microsoft login, Java runtime + game downloads, Fabric, launching Minecraft, and the POISON in-game mod above.
- **Launcher-preview only:** the launcher's 3D page shows the full 125-module set, including things the in-game mod doesn't have yet: sub-frame cinematic blur, bloom, cosmetics such as capes, wings, halo and laser eyes, and the crypto market pages.
- In the browser (no desktop app), Launch only plays a demo animation.
- The exe is **not code-signed**, so Windows SmartScreen will warn on first run (More info → Run anyway).

Not affiliated with Mojang or Microsoft. Crypto elements are simulated and the $PSN currency is play-money with no value.
