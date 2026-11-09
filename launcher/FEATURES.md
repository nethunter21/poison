# POISON Client: full feature list

**125 client modules + 59 launcher features = 184 features.**

LIVE = drives the real-time 3D preview in the launcher. Everything else is saved into the client config handed to the game.

Every module is legit: cosmetic, HUD, QoL or performance. No reach, aim, ESP/through-wall rendering, velocity or autoclicking. Chams are self-only (your own hand, held item and F5 model).

## ◈ Render (27)

| Module | Live | Key | Description |
|---|---|---|---|
| Motion Blur | ✅ |  | Shutter-accurate sub-frame motion blur. Renders N sub-frames per frame and averages them, like an offline render. _(Mode, Sub-frame samples, Shutter angle, Frame-blend trail, Adaptive samples (hold 45+ FPS))_ |
| Bloom | ✅ |  | HDR glow around bright pixels. Neon everything. _(Strength, Threshold, Radius)_ |
| Chromatic Aberration | ✅ |  | RGB lens fringing at the screen edges. _(Amount)_ |
| Vignette | ✅ |  | Darkened lens corners for a filmic frame. _(Amount)_ |
| Film Grain | ✅ |  | Animated 35mm grain. _(Amount)_ |
| Cinematic Bars | ✅ |  | 2.39:1 letterbox bars. Instant movie mode. _(Bar size)_ |
| Color Grading | ✅ |  | Saturation, contrast and temperature. _(Saturation, Contrast, Warmth)_ |
| Filmic Tonemap | ✅ |  | ACES filmic curve for highlights that roll off like film. _(Exposure)_ |
| CRT Scanlines | ✅ |  | Retro scanline overlay in game. _(Amount)_ |
| Sharpen | ✅ |  | Contrast-adaptive sharpening. _(Amount)_ |
| Custom Fog | ✅ |  | Distance fog density and tint. _(Density, Tint)_ |
| Custom Sky | ✅ |  | Sky gradient presets. _(Preset)_ |
| Time Changer | ✅ |  | Client-side time of day (visual only). _(Time)_ |
| Weather | ✅ |  | Client-side weather particles. "Coin rain" is extremely bullish. _(Type)_ |
| Block Outline | ✅ |  | Glowing outline on the block you look at. _(Color, Glow)_ |
| Hand Chams | ✅ |  | Fresnel glow shell on YOUR first-person hand. Self only. _(Color, Rim power, Pulse to beat)_ |
| Item Chams | ✅ |  | Glow shell on the item you are holding. Self only. _(Color, Rim power, Rainbow cycle)_ |
| Self Chams | ✅ |  | Glow shell on your own player model in F5. Self only. _(Color, Intensity)_ |
| Enchant Glint Color |  |  | Recolor the enchantment glint. _(Color, Speed)_ |
| Hit Color |  |  | Custom tint when an entity takes damage. _(Color, Alpha)_ |
| Particle Multiplier |  |  | Scale crit/sharpness particles (visual only). _(Multiplier)_ |
| No Hurt Cam |  |  | Remove the camera shake when you take damage. _(Shake kept)_ |
| Low Fire |  |  | Lowers the burning overlay. _(Height)_ |
| Clear Water |  |  | Less underwater fog. |
| Static FOV |  |  | Disable FOV changes from speed effects. |
| Damage Tint |  |  | Red screen edges at low health. _(Below HP)_ |
| Block Overlay Fill |  |  | Fill color on the targeted block face. _(Color, Alpha)_ |

## 🦋 Animations (12)

| Module | Live | Key | Description |
|---|---|---|---|
| Butterfly Knife | ✅ | F | Replaces every sword with a fully animated balisong. Visual only, same hitbox & damage. _(Idle style, Auto-flip every, Flip speed, Flip open on hotbar swap)_ |
| Knife Inspect | ✅ | I | Press I to inspect your knife — CS-style inspect animation. _(Speed)_ |
| Item Position | ✅ |  | Move/scale the held item. _(X, Y, Z, Scale)_ |
| Swing Speed | ✅ |  | Visual swing animation speed (does not change CPS or cooldown). _(Speed, Style)_ |
| View Bobbing | ✅ |  | Walk bob amount. _(Amount)_ |
| Item Sway | ✅ |  | Held item lags behind your camera turns. _(Amount)_ |
| 1.7 Animations |  |  | Classic 1.7 block-hit, rod and bow animations. _(Block-hit, Rod, Bow)_ |
| Smooth Sneak |  |  | Interpolated crouch camera. |
| Equip Animation |  |  | Item slides in on hotbar swap. _(Speed)_ |
| Emotes |  | B | Emote wheel (B). Includes "Diamond Hands", "HODL", "Rug Pull". |
| Kill Effect |  |  | Cosmetic effect on kill (visible to POISON users). _(Effect)_ |
| Death Animation |  |  | Custom death animation for your own player. _(Style)_ |

## ◉ Camera (7)

| Module | Live | Key | Description |
|---|---|---|---|
| Zoom | ✅ | C | Hold C to zoom smoothly. _(Zoom, Smooth, Scroll to adjust)_ |
| FOV Changer | ✅ |  | Field of view. _(FOV)_ |
| Perspective (F5) | ✅ | V | Toggle third person to admire your cosmetics. _(Distance)_ |
| Cinematic Camera | ✅ |  | Smoothed mouse look for recording. _(Smoothing)_ |
| Strafe Tilt | ✅ |  | Camera rolls slightly when strafing (A/D). _(Amount)_ |
| Showcase Flight | ✅ |  | Auto-flying camera path in the launcher preview. _(Speed, Turn intensity)_ |
| Screen Shake |  |  | Shake on your own hits (cosmetic). _(Amount)_ |

## ▦ HUD (27)

| Module | Live | Key | Description |
|---|---|---|---|
| Watermark | ✅ |  | Glowing POISON watermark. _(Show version)_ |
| Array List | ✅ |  | Rainbow list of enabled modules. _(Color, Background)_ |
| FPS | ✅ |  | Frames per second. |
| CPS | ✅ |  | Clicks per second (display only). |
| Keystrokes | ✅ |  | WASD / Space / LMB / RMB display. _(Show CPS in mouse keys, Glow on press)_ |
| Coordinates | ✅ |  | XYZ + biome. _(Biome)_ |
| Compass | ✅ |  | Direction strip. |
| Clock | ✅ |  | Real-time clock. _(Format)_ |
| Ping | ✅ |  | Server latency. |
| Server Address | ✅ |  | Current server. |
| Armor Status | ✅ |  | Armor durability. _(Durability)_ |
| Potion Effects | ✅ |  | Active effects with timers. |
| Combo Counter | ✅ |  | Hits in a row. |
| Speedometer | ✅ |  | Blocks per second. |
| Memory Usage | ✅ |  | JVM heap usage. |
| Session Timer | ✅ |  | Time played this session. |
| Custom Crosshair | ✅ |  | Crosshair styles. _(Style, Color, Size, Glow)_ |
| Now Playing | ✅ |  | Current track + mini visualizer. |
| Crypto Ticker HUD | ✅ |  | Scrolling (simulated) price ticker in game. |
| Wallet HUD | ✅ |  | $PSN balance + session earnings. |
| Scoreboard Restyle |  |  | Glass scoreboard with accent border. _(Scale, Hide red numbers)_ |
| Boss Bar Restyle |  |  | Neon boss bar. |
| Hotbar Glow | ✅ |  | Animated selection glow on the hotbar. |
| Notifications | ✅ |  | Module toggle notifications. |
| Pack Display |  |  | Shows active resource pack. |
| Tab List Restyle |  |  | Glass tab list with ping bars & POISON badges. |
| Chat Restyle |  |  | Rounded glass chat with fade-in. _(Background)_ |

## ✦ Cosmetics (11)

| Module | Live | Key | Description |
|---|---|---|---|
| Cape | ✅ |  | Animated cloth cape. Choose your design in the Locker. _(Cloth physics)_ |
| Wings | ✅ |  | Neon wings. Choose in the Locker. _(Flap speed)_ |
| Halo | ✅ |  | Floating emissive halo. |
| Aura | ✅ |  | Orbiting particle aura. _(Particles)_ |
| Laser Eyes | ✅ |  | The classic bullish meme. Glowing red eye beams. _(Color, Length)_ |
| Pet | ✅ |  | A floating companion. |
| Particle Trail | ✅ |  | Particles behind you while moving. _(Type)_ |
| Nametag Glow | ✅ |  | Glowing nametag + POISON icon. _(Color)_ |
| Bandana |  |  | Animated bandana. |
| Cloak Shimmer |  |  | Holographic shimmer on your skin. _(Speed)_ |
| Shoulder Buddy |  |  | Tiny Shiba on your shoulder. Much wow. |

## ♫ Music (6)

| Module | Live | Key | Description |
|---|---|---|---|
| Music Player | ✅ |  | In-game music player with procedural synthwave + your own files. |
| Beat-Reactive Glow | ✅ |  | UI and HUD glow pulse to the bass. _(Intensity)_ |
| In-Game Visualizer | ✅ |  | Spectrum bars at the bottom of the screen. |
| Auto Pause in Menus |  |  | Pause music when the game is paused. |
| Crossfade |  |  | Smooth fade between tracks. _(Time)_ |
| Combat Ducking |  |  | Lower music volume while in combat. _(Duck to)_ |

## ₿ Crypto (9)

| Module | Live | Key | Description |
|---|---|---|---|
| Market Ticker | ✅ |  | Simulated market ticker in the launcher (not real prices, not financial advice). _(Scroll speed)_ |
| $PSN Wallet | ✅ |  | Earn play-money $PSN for playtime and badges. Spend it on cosmetics. No real value. |
| Gas Meter | ✅ |  | Shows "gas" = your current ping, in gwei. Pure vibes. |
| Block Explorer | ✅ |  | Every launcher action is hashed into a local "block". Just for fun. |
| Fear & Greed | ✅ |  | Gauge driven by your K/D. Greed when you are winning. |
| Daily Airdrop | ✅ |  | Claim free $PSN once a day. |
| Proof-of-Click Miner | ✅ |  | Idle mini-game in the launcher. |
| HODL Mode |  |  | Q (drop item) needs a double-press so you never drop your sword by accident. |
| Rug-Pull Alert |  |  | Warns when your armor durability is about to break. _(Warn below)_ |

## ⚡ Performance (10)

| Module | Live | Key | Description |
|---|---|---|---|
| FPS Boost |  |  | Bundled render optimizations. |
| Entity Culling |  |  | Skip rendering entities you cannot see. |
| Fast Math |  |  | Lookup-table trig. |
| Async Chunk Builder |  |  | Build chunks off the main thread. _(Threads)_ |
| Memory Leak Fix |  |  | Fixes known texture/leak issues. |
| Unfocused FPS Cap |  |  | Cap FPS when tabbed out. _(Cap)_ |
| Adaptive VSync |  |  | Tear-free without the input lag spikes. |
| Lazy Resource Loading |  |  | Faster startup with on-demand textures. |
| Particle Limit |  |  | Cap total particles. _(Max)_ |
| Preview Quality | ✅ |  | Launcher 3D preview resolution scale. _(Resolution)_ |

## ⚙ Utility (16)

| Module | Live | Key | Description |
|---|---|---|---|
| Toggle Sprint |  |  | Press once to keep sprinting (vanilla-equivalent). _(Show state)_ |
| Toggle Sneak |  |  | Press once to stay crouched. |
| Auto GG |  |  | Sends "gg" at the end of a game. _(Message)_ |
| Text Hotkeys |  |  | Bind chat messages to keys. |
| Chat Timestamps |  |  | Time prefix on chat messages. |
| Chat Copy |  |  | Click a message to copy it. |
| Screenshot Manager |  |  | Gallery + instant copy for F2. |
| Waypoints |  |  | Manual waypoints you set yourself. |
| Replay Hook |  |  | Integrates with replay recording mods. |
| Discord Rich Presence |  |  | Shows "Playing POISON". |
| Streamer Mode |  |  | Hide your IP, coords and nick on stream. _(Hide coords, Hide nick)_ |
| Nick Hider |  |  | Replace your name locally. |
| Server Pinger |  |  | Live pings in the server list. |
| Quick Play |  |  | One-click queue for your favorite modes. |
| Mouse Delay Fix |  |  | Fixes the vanilla 1.8 mouse delay bug. |
| Raw Input |  |  | Bypass OS mouse acceleration. |

## 🚀 Launcher (59)

- Boot splash with hash scramble
- Animated blockchain-network background
- Matrix hex-rain background
- Floating crypto glyphs
- Aurora gradient layer
- Film grain overlay
- CRT scanline overlay
- Glowing cursor follower
- Cursor particle trail
- Click sparks + ripples
- Confetti + coin bursts
- 3D tilt cards with glare
- Magnetic launch button
- Glitch text logos
- Conic neon launch ring
- Animated sidebar glider
- Page transitions
- Beat-reactive UI glow
- Synthesized UI sound effects
- Toast notifications
- 6 theme presets
- Custom accent colors
- RGB hue-cycle mode
- Reduced-motion mode
- FX quality levels
- Live market ticker (simulated)
- Play-money $PSN wallet
- Wallet transaction history
- Daily airdrop
- Proof-of-click miner
- Fear & Greed gauge
- Local block explorer
- Sparkline coin charts
- Cosmetics shop
- On-chain badge achievements
- 3D butterfly-knife showcase
- 9 knife skins
- 8 knife animations
- 7 cape designs
- Wings / halos / auras / pets
- Music player with 6 procedural tracks
- Load your own audio files
- 3-band EQ + presets
- 4 visualizer modes
- Sidebar mini player
- Real-time 3D client preview
- Shutter-accurate motion blur
- HDR bloom pipeline
- Render presets
- Draggable panel ClickGUI
- Module search
- Config export / import / clipboard
- Rebindable menu key
- Version + loader selector
- RAM / JVM / resolution settings
- Quick Play queue
- Patch notes feed
- Konami easter egg
- Electron desktop shell
