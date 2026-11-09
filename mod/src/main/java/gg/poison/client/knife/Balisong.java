package gg.poison.client.knife;

import gg.poison.client.module.Modules;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.RotationAxis;

/**
 * Code-rendered butterfly knife (balisong). Built from boxes so the blade and both handles can
 * move independently — a single baked item model can't do a real flip.
 * Units are model pixels (1/16 block). The pivot pins sit at the origin, the blade points +Y,
 * the handles hang along -Y when open and swing 180° around their own pins to close.
 */
public final class Balisong {
    public static final Identifier WHITE = Identifier.of("poison", "textures/misc/white.png");
    private static final int FULL_BRIGHT = 0xF000F0;

    private enum Role { BLADE, HANDLE, INLAY, PIN }
    private enum Part { BODY, A, B }
    private record Box(float x0, float y0, float z0, float x1, float y1, float z1, Role role, Part part) {}

    private static final float PIN_X = 0.62f;

    private static final Box[] BOXES = {
        // blade: tang, body, clip point and tip (stepped to read as a point)
        new Box(-0.95f, -0.8f, -0.22f, 0.95f, 0.6f, 0.22f, Role.BLADE, Part.BODY),
        new Box(-1.0f, 0.6f, -0.18f, 1.05f, 7.2f, 0.18f, Role.BLADE, Part.BODY),
        new Box(-0.75f, 7.2f, -0.16f, 1.05f, 8.6f, 0.16f, Role.BLADE, Part.BODY),
        new Box(-0.3f, 8.6f, -0.14f, 0.95f, 9.6f, 0.14f, Role.BLADE, Part.BODY),
        new Box(0.15f, 9.6f, -0.12f, 0.75f, 10.5f, 0.12f, Role.BLADE, Part.BODY),
        // safe handle (A) — local coords relative to its pin
        new Box(-0.5f, -10.6f, -0.6f, 0.52f, 0.7f, 0.6f, Role.HANDLE, Part.A),
        new Box(-0.12f, -9.6f, -0.64f, 0.14f, -1.2f, 0.64f, Role.INLAY, Part.A),
        new Box(-0.22f, -0.22f, -0.7f, 0.22f, 0.22f, 0.7f, Role.PIN, Part.A),
        // bite handle (B) + latch
        new Box(-0.52f, -10.6f, -0.6f, 0.5f, 0.7f, 0.6f, Role.HANDLE, Part.B),
        new Box(-0.14f, -9.6f, -0.64f, 0.12f, -1.2f, 0.64f, Role.INLAY, Part.B),
        new Box(-0.22f, -0.22f, -0.7f, 0.22f, 0.22f, 0.7f, Role.PIN, Part.B),
        new Box(-0.3f, -11.6f, -0.3f, 0.3f, -10.6f, 0.3f, Role.PIN, Part.B),
    };

    /** Skin colours: blade base, blade mid, blade tip, handle, inlay. Ids match the launcher. */
    private static int[] skin(String id) {
        return switch (id) {
            case "knife_fade" -> new int[] { 0xFFD23F, 0xFF2E88, 0xA855F7, 0x1A0F1F, 0xFF2E88 };
            case "knife_sapphire" -> new int[] { 0x0A1240, 0x0B2AFF, 0x16C8FF, 0x05070F, 0x16C8FF };
            case "knife_bull" -> new int[] { 0xB8860B, 0xFFCC33, 0xFFF0A0, 0x0C0C0C, 0xFFCC33 };
            case "knife_bear" -> new int[] { 0x400008, 0xFF0033, 0xFF6A3D, 0x120406, 0xFF2244 };
            case "knife_ledger" -> new int[] { 0x111114, 0x1C1C22, 0x111114, 0x09090B, 0x00FF9D };
            case "knife_poison" -> new int[] { 0x1F4A00, 0x7CFF00, 0xC8FF70, 0x0B1405, 0x7CFF00 };
            case "knife_hash" -> new int[] { 0x003A12, 0x00FF66, 0x00802F, 0x020A04, 0x00FF66 };
            case "knife_moon" -> new int[] { 0, 0, 0, 0x0A0A14, 0xFFFFFF };
            default -> new int[] { 0x8A8E96, 0xD8DCE3, 0xF4F6FA, 0x1A1A20, 0xFF8A00 };
        };
    }

    public static boolean renderFirstPerson(MatrixStack m, VertexConsumerProvider vcp, int light, boolean leftHanded) {
        float t = (System.nanoTime() / 1_000_000_000f);
        KnifeAnimator.Pose p = KnifeAnimator.INSTANCE.sample(t);
        float side = leftHanded ? -1 : 1;
        m.push();
        // vanilla handheld first-person display transform, then item space
        m.translate(side * 1.13f / 16f, 3.2f / 16f, 1.13f / 16f);
        m.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * -90f));
        m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 25f));
        m.scale(0.68f, 0.68f, 0.68f);
        m.translate(-0.5f, -0.5f, -0.5f);
        if (Modules.ITEM_POS.on()) {
            m.translate(Modules.ITEM_X.f(), Modules.ITEM_Y.f(), Modules.ITEM_Z.f());
        }
        // pins near the item's lower-left so the grip sits in the hand; blade along the sword diagonal
        m.translate(7.4f / 16f, 7.4f / 16f, 0.5f);
        m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(-45f));
        float s = 0.66f * (Modules.ITEM_POS.on() ? Modules.ITEM_SCALE.f() : 1f) / 16f;
        m.scale(s, s, s);
        render(m, vcp, light, p, t, Modules.ITEM_CHAMS.on());
        m.pop();
        return true;
    }

    /** Render the knife at the current matrix (pin origin) with a pose. */
    public static void render(MatrixStack m, VertexConsumerProvider vcp, int light, KnifeAnimator.Pose p, float t, boolean chams) {
        int[] sk = skin(Modules.KNIFE_SKIN.get());
        boolean rainbow = Modules.KNIFE_SKIN.is("knife_moon");
        VertexConsumer solid = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(WHITE));

        m.push();
        m.translate(p.px * 7, p.py * 7, p.pz * 7); // launcher units -> model px
        m.multiply(RotationAxis.POSITIVE_X.rotation(p.rx));
        m.multiply(RotationAxis.POSITIVE_Y.rotation(p.ry));
        m.multiply(RotationAxis.POSITIVE_Z.rotation(p.rz));
        drawParts(m, solid, light, sk, rainbow, t, p, false, 0, 0);
        if (chams) {
            int c = Modules.ITEM_CHAMS_RAINBOW.get() ? gg.poison.client.util.Colors.wave(0, 2f) : Modules.ITEM_CHAMS_COLOR.get();
            float pulse = 0.55f + 0.45f * (float) Math.sin(t * 5) * 0.5f + gg.poison.client.music.MusicPlayer.level() * 0.4f;
            VertexConsumer glow = vcp.getBuffer(RenderLayer.getEntityTranslucentEmissive(WHITE));
            drawParts(m, glow, FULL_BRIGHT, sk, false, t, p, true, c, (int) (70 * pulse + 30));
        }
        m.pop();
    }

    private static void drawParts(MatrixStack m, VertexConsumer vc, int light, int[] sk, boolean rainbow, float t, KnifeAnimator.Pose p,
                                  boolean shell, int shellColor, int shellAlpha) {
        for (Part part : Part.values()) {
            m.push();
            if (part == Part.A) { m.translate(-PIN_X, 0, 0); m.multiply(RotationAxis.POSITIVE_Z.rotation((float) (-Math.PI * p.a))); }
            if (part == Part.B) { m.translate(PIN_X, 0, 0); m.multiply(RotationAxis.POSITIVE_Z.rotation((float) (Math.PI * p.b))); }
            for (Box b : BOXES) {
                if (b.part != part) continue;
                float g = shell ? 0.18f : 0f;
                int lightUse = b.role == Role.INLAY ? FULL_BRIGHT : light;
                int c0, c1;
                if (shell) { c0 = c1 = (shellAlpha << 24) | (shellColor & 0xFFFFFF); }
                else if (b.role == Role.BLADE) {
                    c0 = 0xFF000000 | bladeColor(sk, b.y0 / 10.5f, rainbow, t);
                    c1 = 0xFF000000 | bladeColor(sk, b.y1 / 10.5f, rainbow, t);
                } else if (b.role == Role.HANDLE) { c0 = c1 = 0xFF000000 | sk[3]; }
                else if (b.role == Role.INLAY) { c0 = c1 = 0xFF000000 | (rainbow ? hue(t * 0.3f) : sk[4]); }
                else { c0 = c1 = 0xFFD8D8D8; }
                box(m.peek(), vc, b.x0 - g, b.y0 - g, b.z0 - g, b.x1 + g, b.y1 + g, b.z1 + g, c0, c1, lightUse);
            }
            m.pop();
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

    /** Emit a box; c0 is the colour at y0, c1 at y1 (vertical gradient). */
    private static void box(MatrixStack.Entry e, VertexConsumer vc, float x0, float y0, float z0, float x1, float y1, float z1, int c0, int c1, int light) {
        // -Z, +Z
        quad(e, vc, x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0, c0, c1, c1, c0, 0, 0, -1, light);
        quad(e, vc, x1, y0, z1, x1, y1, z1, x0, y1, z1, x0, y0, z1, c0, c1, c1, c0, 0, 0, 1, light);
        // -X, +X
        quad(e, vc, x0, y0, z1, x0, y1, z1, x0, y1, z0, x0, y0, z0, c0, c1, c1, c0, -1, 0, 0, light);
        quad(e, vc, x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1, c0, c1, c1, c0, 1, 0, 0, light);
        // -Y, +Y
        quad(e, vc, x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1, c0, c0, c0, c0, 0, -1, 0, light);
        quad(e, vc, x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, c1, c1, c1, c1, 0, 1, 0, light);
    }

    private static void quad(MatrixStack.Entry e, VertexConsumer vc,
                             float ax, float ay, float az, float bx, float by, float bz, float cx, float cy, float cz, float dx, float dy, float dz,
                             int ca, int cb, int cc, int cd, float nx, float ny, float nz, int light) {
        v(e, vc, ax, ay, az, ca, 0, 1, nx, ny, nz, light);
        v(e, vc, bx, by, bz, cb, 0, 0, nx, ny, nz, light);
        v(e, vc, cx, cy, cz, cc, 1, 0, nx, ny, nz, light);
        v(e, vc, dx, dy, dz, cd, 1, 1, nx, ny, nz, light);
    }

    private static void v(MatrixStack.Entry e, VertexConsumer vc, float x, float y, float z, int argb, float u, float vv, float nx, float ny, float nz, int light) {
        vc.vertex(e, x, y, z).color(argb).texture(u, vv).overlay(OverlayTexture.DEFAULT_UV).light(light).normal(e, nx, ny, nz);
    }

    private Balisong() {}
}
