# POISON in-game client: Minecraft 1.8.9 (Legacy Fabric)

The 1.8.9 PvP version of the POISON client. The launcher bundles it and installs it automatically when you pick **1.8.9 + Fabric** (the launcher installs Legacy Fabric for you). It needs no extra API mod: only Legacy Fabric Loader and this jar.

```bash
cd mod-1.8.9
./gradlew build      # -> build/libs/poison-client-1.8.9-<version>.jar (Gradle 9 wrapper, JDK 17+, targets Java 8)
```

Every module is legit: visual, HUD, QoL or audio. Effects only draw around **your own** player, or as feedback on hits you already landed. There's no ESP, no through-wall rendering and nothing that changes combat.

| Category | Modules |
|---|---|
| Render | Theme (7 schemes + glow intensity), Motion Blur, Screen Glow, Self Chams (glow / rainbow / pulse), Block Outline (glow + fill), Time Changer, No Hurt Cam |
| Effects | Jump Circles, China Hat, Trails, Aura Ring, Hit Effects (sparks / coins / hearts / hex), Kill Effects (liquidation / lightning / confetti / rekt) |
| Animations | 1.7 Animations (block-hit + 1.7 / exhibition / slide / spin / push / swank styles), Butterfly Knife (9 skins, flip / inspect / idle clips), Item Chams |
| HUD | Watermark (glow / box / minimal), Array List (animated, glow), FPS, CPS, Ping (+ gas meter), Coordinates, Clock, Keystrokes, Armor, Custom Crosshair, Now Playing, Crypto Ticker (simulated) |
| Music / Utility | POISON FM player (bundled tracks + your .ogg/.wav), Beat-Reactive Glow, Toggle Sprint, Notifications |

Keys: **Right Shift** menu · **R** flip knife · **I** inspect · **Z** zoom · **[ ] \\** music.
