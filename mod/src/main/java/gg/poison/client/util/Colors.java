package gg.poison.client.util;

/** Colour helpers shared by the HUD, ClickGUI and knife. */
public final class Colors {
    public static final int BG = 0xC80E0914, BG2 = 0xE6140C1C, TEXT = 0xFFFFF6EC, MUTED = 0xFFA3958A;

    /** Theme colours (driven by the Theme module). */
    private static int[] pair() {
        String m = gg.poison.client.module.Modules.THEME_MODE.get();
        return switch (m) {
            case "mint" -> new int[] { 0xFF4DFFB4, 0xFF1ED98F };
            case "toxic" -> new int[] { 0xFF7CFF00, 0xFF00FFC8 };
            case "vapor" -> new int[] { 0xFFA855F7, 0xFF16C8FF };
            case "gold" -> new int[] { 0xFFFFD23F, 0xFFFF8A00 };
            case "blood" -> new int[] { 0xFFFF1744, 0xFFFF6A3D };
            case "ice" -> new int[] { 0xFF7DD3FC, 0xFFA5B4FC };
            case "rainbow" -> new int[] { wave(0, 1f), wave(6, 1f) };
            case "poison" -> new int[] { 0xFFFF8A00, 0xFFFF2E88 };
            default -> new int[] { 0xFF4DFFB4, 0xFF1ED98F };
        };
    }
    public static int accent() { return pair()[0]; }
    public static int accent2() { return pair()[1]; }

    /** Glow strength including the music pulse. */
    public static float glow() {
        float g = gg.poison.client.module.Modules.THEME.on() ? gg.poison.client.module.Modules.GLOW.f() : 1f;
        if (gg.poison.client.module.Modules.BEAT_SYNC.on()) g *= 1f + gg.poison.client.music.MusicPlayer.level() * 1.2f;
        return g;
    }

    /** Animated colour along the theme gradient. */
    public static int grad(float t) {
        float s = (float) (Math.sin(System.currentTimeMillis() / 600.0 + t * Math.PI * 2) * 0.5 + 0.5);
        return lerp(accent(), accent2(), s);
    }

    public static int hsv(float h, float s, float v, int alpha) {
        int rgb = java.awt.Color.HSBtoRGB(h, s, v) & 0xFFFFFF;
        return (alpha << 24) | rgb;
    }

    /** Animated rainbow, offset per row so lists ripple. */
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

    private Colors() {}
}
