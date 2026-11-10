package gg.poison.legacy.knife;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.music.MusicPlayer;
import gg.poison.legacy.util.Theme;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormats;
import org.lwjgl.opengl.GL11;

/**
 * Butterfly knife for 1.8.9 — same geometry, skins and animation clips as the 1.21.4 client,
 * drawn with immediate-mode GL (faces shaded by hand since lighting is off).
 * Units are model pixels; pins at the origin, blade +Y, handles -Y.
 */
public final class Balisong {
    private static final int BLADE = 0, HANDLE = 1, INLAY = 2, PIN = 3;
    private static final int BODY = 0, A = 1, B = 2;
    private static final float PIN_X = 0.62f;

    // x0 y0 z0 x1 y1 z1 role part
    private static final float[][] BOXES = {
        { -0.95f, -0.8f, -0.22f, 0.95f, 0.6f, 0.22f, BLADE, BODY },
        { -1.0f, 0.6f, -0.18f, 1.05f, 7.2f, 0.18f, BLADE, BODY },
        { -0.75f, 7.2f, -0.16f, 1.05f, 8.6f, 0.16f, BLADE, BODY },
        { -0.3f, 8.6f, -0.14f, 0.95f, 9.6f, 0.14f, BLADE, BODY },
        { 0.15f, 9.6f, -0.12f, 0.75f, 10.5f, 0.12f, BLADE, BODY },
        { -0.5f, -10.6f, -0.6f, 0.52f, 0.7f, 0.6f, HANDLE, A },
        { -0.12f, -9.6f, -0.64f, 0.14f, -1.2f, 0.64f, INLAY, A },
        { -0.22f, -0.22f, -0.7f, 0.22f, 0.22f, 0.7f, PIN, A },
        { -0.52f, -10.6f, -0.6f, 0.5f, 0.7f, 0.6f, HANDLE, B },
        { -0.14f, -9.6f, -0.64f, 0.12f, -1.2f, 0.64f, INLAY, B },
        { -0.22f, -0.22f, -0.7f, 0.22f, 0.22f, 0.7f, PIN, B },
        { -0.3f, -11.6f, -0.3f, 0.3f, -10.6f, 0.3f, PIN, B },
    };

    private static int[] skin(String id) {
        if (id.equals("knife_fade")) return new int[] { 0xFFD23F, 0xFF2E88, 0xA855F7, 0x1A0F1F, 0xFF2E88 };
        if (id.equals("knife_sapphire")) return new int[] { 0x0A1240, 0x0B2AFF, 0x16C8FF, 0x05070F, 0x16C8FF };
        if (id.equals("knife_bull")) return new int[] { 0xB8860B, 0xFFCC33, 0xFFF0A0, 0x0C0C0C, 0xFFCC33 };
        if (id.equals("knife_bear")) return new int[] { 0x400008, 0xFF0033, 0xFF6A3D, 0x120406, 0xFF2244 };
        if (id.equals("knife_ledger")) return new int[] { 0x111114, 0x1C1C22, 0x111114, 0x09090B, 0x00FF9D };
        if (id.equals("knife_poison")) return new int[] { 0x1F4A00, 0x7CFF00, 0xC8FF70, 0x0B1405, 0x7CFF00 };
        if (id.equals("knife_hash")) return new int[] { 0x003A12, 0x00FF66, 0x00802F, 0x020A04, 0x00FF66 };
        if (id.equals("knife_moon")) return new int[] { 0, 0, 0, 0x0A0A14, 0xFFFFFF };
        return new int[] { 0x8A8E96, 0xD8DCE3, 0xF4F6FA, 0x1A1A20, 0xFF8A00 };
    }

    /** Called with the vanilla first-person matrix (after equip/swing offsets). */
    public static void renderFirstPerson() {
        float t = System.nanoTime() / 1_000_000_000f;
        KnifeAnimator.Pose p = KnifeAnimator.INSTANCE.sample(t);
        GlStateManager.pushMatrix();
        // vanilla 1.8 handheld first-person display transform
        GlStateManager.translate(0, 4f / 16f, 2f / 16f);
        GlStateManager.rotate(-135f, 0, 1, 0);
        GlStateManager.rotate(25f, 0, 0, 1);
        GlStateManager.scale(1.7f, 1.7f, 1.7f);
        GlStateManager.translate(-0.5f, -0.5f, -0.5f);
        GlStateManager.translate(7.4f / 16f, 7.4f / 16f, 0.5f);
        GlStateManager.rotate(-45f, 0, 0, 1);
        float s = 0.66f / 16f;
        GlStateManager.scale(s, s, s);
        render(p, t, Modules.ITEM_CHAMS.on());
        GlStateManager.popMatrix();
    }

    public static void render(KnifeAnimator.Pose p, float t, boolean chams) {
        int[] sk = skin(Modules.KNIFE_SKIN.get());
        boolean rainbow = Modules.KNIFE_SKIN.is("knife_moon");
        GlStateManager.disableTexture();
        GlStateManager.disableLighting();
        GlStateManager.disableCull();
        GlStateManager.shadeModel(GL11.GL_SMOOTH);
        GlStateManager.pushMatrix();
        GlStateManager.translate(p.px * 7, p.py * 7, p.pz * 7);
        GlStateManager.rotate((float) Math.toDegrees(p.rx), 1, 0, 0);
        GlStateManager.rotate((float) Math.toDegrees(p.ry), 0, 1, 0);
        GlStateManager.rotate((float) Math.toDegrees(p.rz), 0, 0, 1);
        drawParts(sk, rainbow, t, p, false, 0, 0);
        if (chams) {
            int c = Theme.accent();
            float pulse = 0.55f + 0.2f * (float) Math.sin(t * 5) + MusicPlayer.level() * 0.4f;
            GlStateManager.enableBlend();
            GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE); // additive glow
            GlStateManager.depthMask(false);
            drawParts(sk, false, t, p, true, c, (int) (90 * pulse + 30));
            GlStateManager.depthMask(true);
            GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
            GlStateManager.disableBlend();
        }
        GlStateManager.popMatrix();
        GlStateManager.shadeModel(GL11.GL_FLAT);
        GlStateManager.enableCull();
        GlStateManager.enableTexture();
        GlStateManager.color(1, 1, 1, 1);
    }

    private static void drawParts(int[] sk, boolean rainbow, float t, KnifeAnimator.Pose p, boolean shell, int shellColor, int shellAlpha) {
        Tessellator tess = Tessellator.getInstance();
        BufferBuilder b = tess.getBuffer();
        for (int part = 0; part < 3; part++) {
            GlStateManager.pushMatrix();
            if (part == A) { GlStateManager.translate(-PIN_X, 0, 0); GlStateManager.rotate((float) (-180 * p.a), 0, 0, 1); }
            if (part == B) { GlStateManager.translate(PIN_X, 0, 0); GlStateManager.rotate((float) (180 * p.b), 0, 0, 1); }
            b.begin(GL11.GL_QUADS, VertexFormats.POSITION_COLOR);
            for (float[] bx : BOXES) {
                if ((int) bx[7] != part) continue;
                int role = (int) bx[6];
                float gr = shell ? 0.2f : 0f;
                int c0, c1;
                if (shell) c0 = c1 = (shellAlpha << 24) | (shellColor & 0xFFFFFF);
                else if (role == BLADE) { c0 = 0xFF000000 | bladeColor(sk, bx[1] / 10.5f, rainbow, t); c1 = 0xFF000000 | bladeColor(sk, bx[4] / 10.5f, rainbow, t); }
                else if (role == HANDLE) c0 = c1 = 0xFF000000 | sk[3];
                else if (role == INLAY) c0 = c1 = 0xFF000000 | (rainbow ? hue(t * 0.3f) : sk[4]);
                else c0 = c1 = 0xFFD8D8D8;
                boolean bright = role == INLAY || shell;
                box(b, bx[0] - gr, bx[1] - gr, bx[2] - gr, bx[3] + gr, bx[4] + gr, bx[5] + gr, c0, c1, bright);
            }
            tess.draw();
            GlStateManager.popMatrix();
        }
    }

    private static int bladeColor(int[] sk, float f, boolean rainbow, float t) {
        f = Math.max(0, Math.min(1, f));
        if (rainbow) return hue(f * 1.6f + t * 0.25f);
        return f < 0.5f ? mix(sk[0], sk[1], f * 2) : mix(sk[1], sk[2], (f - 0.5f) * 2);
    }
    private static int hue(float h) { return java.awt.Color.HSBtoRGB(h % 1f, 0.75f, 1f) & 0xFFFFFF; }
    private static int mix(int a, int b, float t) {
        int r = (int) (((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
        int g = (int) (((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
        int bl = (int) ((a & 255) + ((b & 255) - (a & 255)) * t);
        return (r << 16) | (g << 8) | bl;
    }
    private static int shade(int argb, float k) {
        int r = (int) (((argb >> 16) & 255) * k), g = (int) (((argb >> 8) & 255) * k), b = (int) ((argb & 255) * k);
        return (argb & 0xFF000000) | (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
    }
    private static void v(BufferBuilder b, float x, float y, float z, int c) {
        b.vertex(x, y, z).color((c >> 16) & 255, (c >> 8) & 255, c & 255, c >>> 24).next();
    }
    private static void box(BufferBuilder b, float x0, float y0, float z0, float x1, float y1, float z1, int c0, int c1, boolean bright) {
        float sZ = bright ? 1 : 0.85f, sX = bright ? 1 : 0.7f, sT = bright ? 1 : 1f, sB = bright ? 1 : 0.5f;
        int a0 = shade(c0, sZ), a1 = shade(c1, sZ);
        v(b, x0, y0, z0, a0); v(b, x0, y1, z0, a1); v(b, x1, y1, z0, a1); v(b, x1, y0, z0, a0);
        v(b, x1, y0, z1, a0); v(b, x1, y1, z1, a1); v(b, x0, y1, z1, a1); v(b, x0, y0, z1, a0);
        a0 = shade(c0, sX); a1 = shade(c1, sX);
        v(b, x0, y0, z1, a0); v(b, x0, y1, z1, a1); v(b, x0, y1, z0, a1); v(b, x0, y0, z0, a0);
        v(b, x1, y0, z0, a0); v(b, x1, y1, z0, a1); v(b, x1, y1, z1, a1); v(b, x1, y0, z1, a0);
        int bt = shade(c0, sB), tp = shade(c1, sT);
        v(b, x0, y0, z1, bt); v(b, x0, y0, z0, bt); v(b, x1, y0, z0, bt); v(b, x1, y0, z1, bt);
        v(b, x0, y1, z0, tp); v(b, x0, y1, z1, tp); v(b, x1, y1, z1, tp); v(b, x1, y1, z0, tp);
    }

    private Balisong() {}
}
