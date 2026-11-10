package gg.poison.legacy.util;

import gg.poison.legacy.module.Modules;
import gg.poison.legacy.music.MusicPlayer;

/** Live client colours driven by the Theme module (and the music, when beat sync is on). */
public final class Theme {
    public static final int BG = 0xD80E0914, TEXT = 0xFFFFF6EC, MUTED = 0xFFA3958A;

    private static int[] pair() {
        String m = Modules.THEME_MODE.get();
        if (m.equals("toxic")) return new int[] { 0xFF7CFF00, 0xFF00FFC8 };
        if (m.equals("vapor")) return new int[] { 0xFFA855F7, 0xFF16C8FF };
        if (m.equals("gold")) return new int[] { 0xFFFFD23F, 0xFFFF8A00 };
        if (m.equals("blood")) return new int[] { 0xFFFF1744, 0xFFFF6A3D };
        if (m.equals("ice")) return new int[] { 0xFF7DD3FC, 0xFFA5B4FC };
        if (m.equals("rainbow")) return new int[] { wave(0, 1f), wave(6, 1f) };
        return new int[] { 0xFFFF8A00, 0xFFFF2E88 };
    }

    public static int accent() { return pair()[0]; }
    public static int accent2() { return pair()[1]; }

    /** Glow strength 0..~3 including the music pulse. */
    public static float glow() {
        float g = Modules.THEME.on() ? Modules.GLOW.f() : 1f;
        if (Modules.BEAT_SYNC.on()) g *= 1f + MusicPlayer.level() * 1.2f;
        return g;
    }

    /** Colour along the theme gradient (t 0..1, animated). */
    public static int grad(float t) {
        float s = (float) (Math.sin(System.currentTimeMillis() / 600.0 + t * Math.PI * 2) * 0.5 + 0.5);
        return lerp(accent(), accent2(), s);
    }

    public static int hsv(float h, float s, float v, int alpha) {
        return (alpha << 24) | (java.awt.Color.HSBtoRGB(h, s, v) & 0xFFFFFF);
    }

    public static int wave(int index, float speed) {
        float t = (System.currentTimeMillis() % 100000L) / 1000f;
        return hsv(((t * 0.12f * speed) + index * 0.045f) % 1f, 0.75f, 1f, 255);
    }

    public static int lerp(int a, int b, float t) {
        int aa = a >>> 24, ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        int ba = b >>> 24, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        return ((int) (aa + (ba - aa) * t) << 24) | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
    }

    public static int alpha(int argb, int alpha) { return (Math.max(0, Math.min(255, alpha)) << 24) | (argb & 0xFFFFFF); }

    private Theme() {}
}
