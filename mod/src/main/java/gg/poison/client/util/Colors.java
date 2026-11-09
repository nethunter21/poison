package gg.poison.client.util;

/** Colour helpers shared by the HUD, ClickGUI and knife. */
public final class Colors {
    public static final int ACCENT = 0xFFFF8A00, ACCENT2 = 0xFFFF2E88, BG = 0xC80E0914, BG2 = 0xE6140C1C, TEXT = 0xFFFFF6EC, MUTED = 0xFFA3958A;

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
