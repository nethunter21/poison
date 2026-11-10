package gg.poison.client.render;

import gg.poison.client.module.Modules;
import gg.poison.client.util.Colors;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.shape.VoxelShape;
import org.joml.Matrix4f;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * World-space effects for 1.21.4 (same set as the 1.8.9 client). Everything is around YOUR OWN
 * player, or feedback on hits you already landed. Nothing reveals hidden entities or aids aim.
 */
public final class WorldFx {
    private static final Random RNG = new Random();
    private record Ring(double x, double y, double z, long t) {}
    private static final class Particle {
        double x, y, z, vx, vy, vz; final int color, shape; final float size, life; final long born = System.currentTimeMillis();
        double ocx, ocz, ang, rad;   // vortex orbit (shape 4)
        Particle(double x, double y, double z, double vx, double vy, double vz, int color, float size, float life, int shape) {
            this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.color = color; this.size = size; this.life = life; this.shape = shape;
        }
    }
    private record Bolt(double x, double y, double z, long t, double[] jag) {}
    private record FloatText(double x, double y, double z, String text, int color, long t) {}

    private static final List<Ring> RINGS = new ArrayList<>();
    private static final List<Particle> PARTICLES = new ArrayList<>();
    private static final List<Bolt> BOLTS = new ArrayList<>();
    private static final List<FloatText> TEXTS = new ArrayList<>();
    private static final LinkedList<Vec3d> TRAIL = new LinkedList<>();
    private static final Map<Integer, Long> HIT = new HashMap<>();
    private static boolean wasOnGround = true;
    private static long lastFrame = System.nanoTime();

    // ----------------------------------------------------------------- events
    public static void tick(MinecraftClient mc) {
        if (mc.player == null || mc.world == null) { RINGS.clear(); PARTICLES.clear(); TRAIL.clear(); HIT.clear(); return; }
        Entity p = mc.player;
        if (Modules.JUMP_CIRCLES.on() && wasOnGround && !p.isOnGround() && p.getVelocity().y > 0.2) RINGS.add(new Ring(p.getX(), p.getY() + 0.02, p.getZ(), System.currentTimeMillis()));
        wasOnGround = p.isOnGround();
        if (Modules.TRAILS.on()) {
            TRAIL.addFirst(p.getPos());
            while (TRAIL.size() > Modules.TRAIL_LENGTH.get()) TRAIL.removeLast();
        } else TRAIL.clear();
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<Integer, Long>> it = HIT.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<Integer, Long> e = it.next();
            Entity ent = mc.world.getEntityById(e.getKey());
            if (now - e.getValue() > 3000) { it.remove(); continue; }
            if (ent instanceof LivingEntity le && (le.getHealth() <= 0 || le.isRemoved())) { kill(mc, ent); it.remove(); }
        }
    }

    public static void onHit(Entity target) {
        HIT.put(target.getId(), System.currentTimeMillis());
        if (!Modules.HIT_FX.on()) return;
        String st = Modules.HIT_STYLE.get();
        int n = (int) Modules.HIT_AMOUNT.get().doubleValue();
        double cx = target.getX(), cy = target.getY() + target.getHeight() * 0.6, cz = target.getZ();
        if (st.equals("crystal")) {
            for (int i = 0; i < n; i++) {
                double sp = 0.07 + RNG.nextDouble() * 0.16, a = RNG.nextDouble() * Math.PI * 2, el = (RNG.nextDouble() - 0.3) * Math.PI;
                int color = RNG.nextInt(4) == 0 ? 0xFFFFFFFF : (RNG.nextBoolean() ? Colors.accent() : Colors.accent2());
                PARTICLES.add(new Particle(cx, cy, cz, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 0.06, Math.sin(a) * Math.cos(el) * sp, color, 0.03f + RNG.nextFloat() * 0.04f, 0.7f + RNG.nextFloat() * 0.6f, 2));
            }
            for (int i = 0; i < 5; i++) {
                double a = RNG.nextDouble() * Math.PI * 2, el = (RNG.nextDouble() - 0.4) * 0.8, sp = 0.35 + RNG.nextDouble() * 0.3;
                PARTICLES.add(new Particle(cx, cy, cz, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp, Colors.accent(), 0.012f, 0.35f, 3));
            }
            return;
        }
        for (int i = 0; i < n; i++) {
            int color = st.equals("coins") ? 0xFFFFC233 : st.equals("hearts") ? 0xFFFF2E55 : st.equals("hex") ? 0xFF00FF66 : (RNG.nextBoolean() ? Colors.accent() : Colors.accent2());
            int shape = st.equals("coins") || st.equals("hearts") ? 1 : 0;
            double sp = 0.06 + RNG.nextDouble() * 0.12, a = RNG.nextDouble() * Math.PI * 2, el = (RNG.nextDouble() - 0.3) * Math.PI;
            PARTICLES.add(new Particle(cx, cy, cz, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 0.05, Math.sin(a) * Math.cos(el) * sp, color, 0.025f + RNG.nextFloat() * 0.025f, 0.6f + RNG.nextFloat() * 0.5f, shape));
        }
    }

    private static void kill(MinecraftClient mc, Entity e) {
        if (!Modules.KILL_FX.on()) return;
        String fx = Modules.KILL_STYLE.get();
        double x = e.getX(), y = e.getY(), z = e.getZ();
        if (fx.equals("lightning")) {
            double[] jag = new double[24];
            for (int i = 0; i < jag.length; i++) jag[i] = (RNG.nextDouble() - 0.5) * 0.9;
            BOLTS.add(new Bolt(x, y, z, System.currentTimeMillis(), jag));
            mc.world.playSound(mc.player, x, y, z, SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER, SoundCategory.PLAYERS, 0.5f, 1.4f);
        } else if (fx.equals("vortex")) {
            for (int i = 0; i < 70; i++) {
                Particle q = new Particle(x, y + 0.1, z, 0, 0.025 + RNG.nextDouble() * 0.03, 0, i % 3 == 0 ? 0xFFD8FFF0 : Colors.accent(), 0.07f + RNG.nextFloat() * 0.08f, 1.6f + RNG.nextFloat() * 0.6f, 4);
                q.ocx = x; q.ocz = z; q.ang = RNG.nextDouble() * Math.PI * 2; q.rad = 0.2 + RNG.nextDouble() * 0.5;
                PARTICLES.add(q);
            }
            for (int i = 0; i < 40; i++) {
                double a = RNG.nextDouble() * Math.PI * 2, sp = 0.08 + RNG.nextDouble() * 0.2;
                PARTICLES.add(new Particle(x, y + e.getHeight() * 0.5, z, Math.cos(a) * sp, 0.12 + RNG.nextDouble() * 0.2, Math.sin(a) * sp, Colors.accent(), 0.04f, 1.1f, 2));
            }
            RINGS.add(new Ring(x, y + 0.05, z, System.currentTimeMillis()));
            mc.world.playSound(mc.player, x, y, z, SoundEvents.BLOCK_AMETHYST_BLOCK_BREAK, SoundCategory.PLAYERS, 1f, 0.8f);
        } else if (fx.equals("rekt")) {
            TEXTS.add(new FloatText(x, y + e.getHeight() + 0.3, z, "REKT", Colors.accent(), System.currentTimeMillis()));
            mc.world.playSound(mc.player, x, y, z, SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP, SoundCategory.PLAYERS, 1f, 0.7f);
        } else {
            boolean coins = fx.equals("liquidation");
            for (int i = 0; i < 70; i++) {
                double a = RNG.nextDouble() * Math.PI * 2, sp = 0.08 + RNG.nextDouble() * 0.22;
                int c = coins ? (RNG.nextBoolean() ? 0xFFFFC233 : 0xFFFF8A00) : Colors.hsv(RNG.nextFloat(), 0.8f, 1f, 255);
                PARTICLES.add(new Particle(x, y + e.getHeight() * 0.5, z, Math.cos(a) * sp, 0.15 + RNG.nextDouble() * 0.25, Math.sin(a) * sp, c, 0.045f, 1.4f, coins ? 1 : 0));
            }
            RINGS.add(new Ring(x, y + 0.05, z, System.currentTimeMillis()));
            if (coins) TEXTS.add(new FloatText(x, y + e.getHeight() + 0.3, z, "LIQUIDATED", 0xFFFFC233, System.currentTimeMillis()));
            mc.world.playSound(mc.player, x, y, z, coins ? SoundEvents.ENTITY_PLAYER_LEVELUP : SoundEvents.ENTITY_FIREWORK_ROCKET_TWINKLE, SoundCategory.PLAYERS, 0.8f, 1.2f);
        }
    }

    // ----------------------------------------------------------------- rendering
    private static void v(VertexConsumer vc, Matrix4f m, double x, double y, double z, int argb) { vc.vertex(m, (float) x, (float) y, (float) z).color(argb); }

    /** Double-sided quad: the lightning layer culls back faces, billboards/ribbons must show from both sides. */
    private static void quad2(VertexConsumer vc, Matrix4f m, double[] a, double[] b, double[] c, double[] d, int ca, int cb, int cc, int cd) {
        v(vc, m, a[0], a[1], a[2], ca); v(vc, m, b[0], b[1], b[2], cb); v(vc, m, c[0], c[1], c[2], cc); v(vc, m, d[0], d[1], d[2], cd);
        v(vc, m, d[0], d[1], d[2], cd); v(vc, m, c[0], c[1], c[2], cc); v(vc, m, b[0], b[1], b[2], cb); v(vc, m, a[0], a[1], a[2], ca);
    }

    public static void render(WorldRenderContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || ctx.consumers() == null) return;
        Camera cam = ctx.camera();
        Vec3d c = cam.getPos();
        float td = ctx.tickCounter().getTickDelta(false);
        long nowNs = System.nanoTime();
        float dt = Math.min(0.1f, (nowNs - lastFrame) / 1e9f);
        lastFrame = nowNs;
        float g = Colors.glow();
        MatrixStack ms = ctx.matrixStack() != null ? ctx.matrixStack() : new MatrixStack();
        VertexConsumerProvider vcp = ctx.consumers();
        GlowConsumers.flush(); // self-chams fill queued while entities rendered
        VertexConsumer glow = vcp.getBuffer(RenderLayer.getLightning()); // additive
        Matrix4f m = ms.peek().getPositionMatrix();

        Entity p = mc.player;
        double px = p.prevX + (p.getX() - p.prevX) * td, py = p.prevY + (p.getY() - p.prevY) * td, pz = p.prevZ + (p.getZ() - p.prevZ) * td;

        // jump circles
        long now = System.currentTimeMillis();
        for (Iterator<Ring> it = RINGS.iterator(); it.hasNext(); ) {
            Ring r = it.next();
            float age = (now - r.t()) / 1000f;
            if (age > 0.9f) { it.remove(); continue; }
            float k = age / 0.9f;
            double R = Modules.JUMP_SIZE.get() * (1 - Math.pow(1 - k, 3));
            int a = (int) (200 * (1 - k) * Math.min(1.5f, g));
            ring(glow, m, r.x() - c.x, r.y() - c.y, r.z() - c.z, R * 0.7, R, a);
        }
        // trail ribbon
        if (Modules.TRAILS.on() && TRAIL.size() > 1) {
            int n = TRAIL.size(), i = 0;
            Vec3d prev = null; float prevF = 1;
            for (Vec3d q : TRAIL) {
                Vec3d cur = i == 0 ? new Vec3d(px, py, pz) : q;
                float f = 1 - i / (float) n;
                if (prev != null) {
                    int c1 = Colors.alpha(Colors.grad(i / (float) n), (int) (150 * f * Math.min(1.5f, g)));
                    int c0 = Colors.alpha(Colors.grad((i - 1) / (float) n), (int) (150 * prevF * Math.min(1.5f, g)));
                    quad2(glow, m, new double[] { prev.x - c.x, prev.y - c.y + 0.05, prev.z - c.z }, new double[] { prev.x - c.x, prev.y - c.y + 0.05 + 0.9 * prevF, prev.z - c.z },
                        new double[] { cur.x - c.x, cur.y - c.y + 0.05 + 0.9 * f, cur.z - c.z }, new double[] { cur.x - c.x, cur.y - c.y + 0.05, cur.z - c.z },
                        c0, Colors.alpha(c0, 0), Colors.alpha(c1, 0), c1);
                }
                prev = cur; prevF = f; i++;
            }
        }
        // aura ring
        if (Modules.AURA.on()) {
            double R = Modules.AURA_RADIUS.get(), spin = now / 600.0, y = py - c.y + 0.05 + Math.sin(spin * 1.3) * 0.05;
            for (int i = 0; i < 72; i++) {
                double a0 = i / 72.0 * Math.PI * 2, a1 = (i + 1) / 72.0 * Math.PI * 2;
                float seg = (float) ((Math.sin(a0 * 3 + spin * 2) + 1) / 2);
                int col = Colors.alpha(Colors.grad(i / 72f), (int) (60 + 160 * seg * Math.min(1.5f, g)));
                double x0 = px - c.x + Math.cos(a0) * R, z0 = pz - c.z + Math.sin(a0) * R, x1 = px - c.x + Math.cos(a1) * R, z1 = pz - c.z + Math.sin(a1) * R;
                quad2(glow, m, new double[] { x0, y, z0 }, new double[] { x0, y + 0.25 + 0.2 * seg, z0 }, new double[] { x1, y + 0.25 + 0.2 * seg, z1 }, new double[] { x1, y, z1 },
                    col, Colors.alpha(col, 0), Colors.alpha(col, 0), col);
            }
        }
        // china hat (third person only)
        if (Modules.CHINA_HAT.on() && !mc.options.getPerspective().isFirstPerson()) {
            double size = Modules.HAT_SIZE.get(), top = py - c.y + p.getHeight() + (p.isSneaking() ? -0.15 : 0.08), x = px - c.x, z = pz - c.z;
            int apex = Colors.alpha(Colors.accent(), (int) (200 * Math.min(1.3f, g)));
            for (int i = 0; i < 48; i++) {
                double a0 = i / 48.0 * Math.PI * 2, a1 = (i + 1) / 48.0 * Math.PI * 2;
                int e0 = Colors.alpha(Colors.grad(i / 48f), (int) (120 * Math.min(1.3f, g))), e1 = Colors.alpha(Colors.grad((i + 1) / 48f), (int) (120 * Math.min(1.3f, g)));
                quad2(glow, m, new double[] { x, top + size * 0.45, z }, new double[] { x, top + size * 0.45, z },
                    new double[] { x + Math.cos(a1) * size, top, z + Math.sin(a1) * size }, new double[] { x + Math.cos(a0) * size, top, z + Math.sin(a0) * size }, apex, apex, e1, e0);
            }
        }
        // particles (camera-facing glow embers)
        org.joml.Quaternionf rot = cam.getRotation();
        org.joml.Vector3f right = new org.joml.Vector3f(1, 0, 0).rotate(rot), up = new org.joml.Vector3f(0, 1, 0).rotate(rot);
        for (Iterator<Particle> it = PARTICLES.iterator(); it.hasNext(); ) {
            Particle q = it.next();
            float age = (now - q.born) / 1000f;
            if (age > q.life) { it.remove(); continue; }
            float s60 = dt * 60;
            if (q.shape == 4) { // vortex: orbit + rise + widen
                q.ang += 0.22 * s60; q.rad += 0.012 * s60; q.y += q.vy * s60;
                q.x = q.ocx + Math.cos(q.ang) * q.rad; q.z = q.ocz + Math.sin(q.ang) * q.rad;
            } else {
                q.x += q.vx * s60; q.y += q.vy * s60; q.z += q.vz * s60;
                if (q.shape != 3) q.vy -= 0.008 * s60;
                q.vx *= Math.pow(q.shape == 3 ? 0.9 : 0.96, s60); q.vz *= Math.pow(q.shape == 3 ? 0.9 : 0.96, s60);
            }
            float f = 1 - age / q.life;
            double x = q.x - c.x, y = q.y - c.y, z = q.z - c.z;
            if (q.shape == 3) { // streak: thin glowing line along its motion
                double tx = q.vx * 6, ty = q.vy * 6, tz = q.vz * 6, w = 0.018;
                int col = Colors.alpha(q.color, (int) (220 * f));
                quad2(glow, m, new double[] { x - right.x * w, y - right.y * w, z - right.z * w }, new double[] { x + right.x * w, y + right.y * w, z + right.z * w },
                    new double[] { x - tx + right.x * w, y - ty + right.y * w, z - tz + right.z * w }, new double[] { x - tx - right.x * w, y - ty - right.y * w, z - tz - right.z * w },
                    col, col, Colors.alpha(col, 0), Colors.alpha(col, 0));
                continue;
            }
            if (q.shape == 2) { // crystal shard: tall thin diamond, spinning
                double sp = (now - q.born) / 160.0 + q.size * 100;
                double sx = Math.cos(sp), sy = Math.sin(sp);
                double hx = (right.x * sx + up.x * sy), hy = (right.y * sx + up.y * sy), hz = (right.z * sx + up.z * sy);
                double wx = (-right.x * sy + up.x * sx), wy = (-right.y * sy + up.y * sx), wz = (-right.z * sy + up.z * sx);
                for (int layer = 0; layer < 2; layer++) {
                    double L = q.size * (layer == 0 ? 6 : 3.2), W = q.size * (layer == 0 ? 2.6 : 0.9);
                    int col = layer == 0 ? Colors.alpha(q.color, (int) (60 * f)) : Colors.alpha(Colors.lerp(q.color, 0xFFFFFFFF, 0.45f), (int) (255 * f));
                    quad2(glow, m, new double[] { x + hx * L, y + hy * L, z + hz * L }, new double[] { x + wx * W, y + wy * W, z + wz * W },
                        new double[] { x - hx * L, y - hy * L, z - hz * L }, new double[] { x - wx * W, y - wy * W, z - wz * W }, col, col, col, col);
                }
                continue;
            }
            for (int layer = 0; layer < 2; layer++) {
                double s = q.size * (layer == 0 ? 3.2 : 1);
                int col = layer == 0 ? Colors.alpha(q.color, (int) ((q.shape == 4 ? 45 : 70) * f)) : Colors.alpha(Colors.lerp(q.color, 0xFFFFFFFF, 0.35f), (int) ((q.shape == 4 ? 90 : 255) * f));
                double rx = right.x * s, ry = right.y * s, rz = right.z * s, ux = up.x * s, uy = up.y * s, uz = up.z * s;
                if (q.shape == 1) quad2(glow, m, new double[] { x + ux, y + uy, z + uz }, new double[] { x - rx, y - ry, z - rz }, new double[] { x - ux, y - uy, z - uz }, new double[] { x + rx, y + ry, z + rz }, col, col, col, col);
                else quad2(glow, m, new double[] { x - rx - ux, y - ry - uy, z - rz - uz }, new double[] { x - rx + ux, y - ry + uy, z - rz + uz }, new double[] { x + rx + ux, y + ry + uy, z + rz + uz }, new double[] { x + rx - ux, y + ry - uy, z + rz - uz }, col, col, col, col);
            }
        }
        // lightning bolts (thin camera-facing segments)
        for (Iterator<Bolt> it = BOLTS.iterator(); it.hasNext(); ) {
            Bolt b = it.next();
            float age = (now - b.t()) / 1000f;
            if (age > 0.6f) { it.remove(); continue; }
            int a = (int) (255 * (1 - age / 0.6f) * (0.6 + 0.4 * Math.sin(age * 60)));
            for (int i = 0; i + 1 < b.jag().length; i++) {
                double x0 = b.x() - c.x + b.jag()[i], z0 = b.z() - c.z + b.jag()[(i + 7) % b.jag().length], y0 = b.y() + 12 - i * 0.5 - c.y;
                double x1 = b.x() - c.x + b.jag()[i + 1], z1 = b.z() - c.z + b.jag()[(i + 8) % b.jag().length], y1 = b.y() + 12 - (i + 1) * 0.5 - c.y;
                for (int layer = 0; layer < 2; layer++) {
                    double w = layer == 0 ? 0.18 : 0.05;
                    int col = layer == 0 ? Colors.alpha(Colors.accent2(), a / 3) : Colors.alpha(0xFFFFFFFF, a);
                    quad2(glow, m, new double[] { x0 - right.x * w, y0, z0 - right.z * w }, new double[] { x0 + right.x * w, y0, z0 + right.z * w },
                        new double[] { x1 + right.x * w, y1, z1 + right.z * w }, new double[] { x1 - right.x * w, y1, z1 - right.z * w }, col, col, col, col);
                }
            }
        }
        // giant 3D lyrics floating in the world
        if (Modules.LYRICS.on() && Modules.LYRICS_3D.get()) lyrics3d(mc, cam, c, ms, vcp, now);

        // floating text
        TextRenderer tr = mc.textRenderer;
        for (Iterator<FloatText> it = TEXTS.iterator(); it.hasNext(); ) {
            FloatText ft = it.next();
            float age = (now - ft.t()) / 1000f;
            if (age > 1.8f) { it.remove(); continue; }
            ms.push();
            ms.translate(ft.x() - c.x, ft.y() - c.y + age * 0.6, ft.z() - c.z);
            ms.multiply(rot);
            float s = 0.024f * (1 + Math.min(1, age * 4) * 0.4f);
            ms.scale(s, -s, s);
            int a = (int) (255 * Math.min(1, (1.8f - age) * 2));
            int w = tr.getWidth(ft.text());
            Matrix4f tm = ms.peek().getPositionMatrix();
            int col = Colors.alpha(ft.color(), a);
            for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) if (dx != 0 || dy != 0) {
                Matrix4f om = new Matrix4f(tm).translate(dx, dy, 0);
                tr.draw(Text.literal(ft.text()), -w / 2f, 0, Colors.alpha(ft.color(), a / 4), false, om, vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
            }
            tr.draw(Text.literal(ft.text()), -w / 2f, 0, col, false, tm, vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
            ms.pop();
        }
    }

    // ----------------------------------------------------------------- 3D lyrics
    private static String lyricLine;
    private static double lyricAx, lyricAy, lyricAz;
    private static long lyricStart;
    private static float lyricTilt;

    private static void lyrics3d(MinecraftClient mc, Camera cam, Vec3d c, MatrixStack ms, VertexConsumerProvider vcp, long now) {
        gg.poison.client.music.MusicPlayer.Lyric cur = gg.poison.client.music.MusicPlayer.lyric();
        if (cur == null) { lyricLine = null; return; }
        if (!cur.text().equals(lyricLine)) {
            // anchor each new line somewhere in front of you; it stays put in the world
            lyricLine = cur.text();
            lyricStart = now;
            double yaw = Math.toRadians(cam.getYaw() + (RNG.nextDouble() - 0.5) * 50);
            double dist = 6 + RNG.nextDouble() * 3;
            lyricAx = c.x - Math.sin(yaw) * dist;
            lyricAz = c.z + Math.cos(yaw) * dist;
            lyricAy = c.y + 0.6 + (RNG.nextDouble() - 0.3) * 1.6;
            lyricTilt = (float) ((RNG.nextDouble() - 0.5) * 14);
        }
        gg.poison.client.music.MusicPlayer.Lyric next = gg.poison.client.music.MusicPlayer.lyricAt(1);
        double lineLen = next != null ? Math.max(1.2, next.time() - cur.time()) : 4;
        double into = gg.poison.client.music.MusicPlayer.position() - cur.time();
        String[] words = lyricLine.split(" ");
        int shown = Math.max(1, Math.min(words.length, (int) Math.ceil(words.length * Math.min(1, into / (lineLen * 0.7)))));
        String text = String.join(" ", java.util.Arrays.copyOf(words, shown));
        float age = (now - lyricStart) / 1000f;
        float a = Math.min(1, age / 0.25f) * (float) Math.max(0, Math.min(1, (lineLen - into) / 0.4));
        if (a <= 0.01f) return;
        TextRenderer tr = mc.textRenderer;
        net.minecraft.text.Text t = G2D.t(text, G2D.INTER_BIG);
        ms.push();
        ms.translate(lyricAx - c.x, lyricAy - c.y + Math.sin(now / 900.0) * 0.08, lyricAz - c.z);
        ms.multiply(cam.getRotation());
        ms.multiply(net.minecraft.util.math.RotationAxis.POSITIVE_Z.rotationDegrees(lyricTilt));
        float sc = 0.045f * Modules.LYRICS_SIZE.f() * (0.92f + 0.08f * Math.min(1, age * 3));
        ms.scale(sc, -sc, sc);
        int w = tr.getWidth(t);
        Matrix4f tm = ms.peek().getPositionMatrix();
        int glowC = Colors.alpha(Colors.accent(), (int) (60 * a));
        for (int dx = -2; dx <= 2; dx++) for (int dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) == 2) {
            tr.draw(t, -w / 2f + dx, dy, glowC, false, new Matrix4f(tm).translate(0, 0, -0.01f), vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
        }
        tr.draw(t, -w / 2f, 0, Colors.alpha(Colors.lerp(Colors.accent(), 0xFFFFFFFF, 0.15f), (int) (255 * a)), false, tm, vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
        ms.pop();
    }

    private static void ring(VertexConsumer vc, Matrix4f m, double x, double y, double z, double r0, double r1, int a) {
        for (int i = 0; i < 64; i++) {
            double a0 = i / 64.0 * Math.PI * 2, a1 = (i + 1) / 64.0 * Math.PI * 2;
            int c0 = Colors.grad(i / 64f), c1 = Colors.grad((i + 1) / 64f);
            quad2(vc, m, new double[] { x + Math.cos(a0) * r1, y, z + Math.sin(a0) * r1 }, new double[] { x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0 },
                new double[] { x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0 }, new double[] { x + Math.cos(a1) * r1, y, z + Math.sin(a1) * r1 },
                Colors.alpha(c0, a), Colors.alpha(c0, 0), Colors.alpha(c1, 0), Colors.alpha(c1, a));
        }
    }

    /** Neon block outline + pulsing fill. Returns false to replace the vanilla outline. */
    public static boolean blockOutline(WorldRenderContext ctx, BlockPos pos, VoxelShape shape) {
        if (!Modules.BLOCK_OUTLINE.on() || shape.isEmpty()) return true;
        Vec3d c = ctx.camera().getPos();
        Box b = shape.getBoundingBox().offset(pos).expand(0.003).offset(-c.x, -c.y, -c.z);
        MatrixStack ms = ctx.matrixStack() != null ? ctx.matrixStack() : new MatrixStack();
        Matrix4f m = ms.peek().getPositionMatrix();
        VertexConsumer glow = ctx.consumers().getBuffer(RenderLayer.getLightning());
        float g = Colors.glow();
        if (Modules.OUTLINE_FILL.get()) {
            int fill = Colors.alpha(Colors.accent(), (int) (40 + 15 * Math.sin(System.currentTimeMillis() / 300.0)));
            box(glow, m, b, fill);
        }
        // edges as thin glowing slabs
        int edge = Colors.alpha(Colors.accent(), (int) (230 * Math.min(1.2f, g)));
        double t = 0.012;
        double[][] e = {
            { b.minX, b.minY, b.minZ, b.maxX, b.minY, b.minZ }, { b.maxX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ }, { b.minX, b.minY, b.maxZ, b.maxX, b.minY, b.maxZ }, { b.minX, b.minY, b.minZ, b.minX, b.minY, b.maxZ },
            { b.minX, b.maxY, b.minZ, b.maxX, b.maxY, b.minZ }, { b.maxX, b.maxY, b.minZ, b.maxX, b.maxY, b.maxZ }, { b.minX, b.maxY, b.maxZ, b.maxX, b.maxY, b.maxZ }, { b.minX, b.maxY, b.minZ, b.minX, b.maxY, b.maxZ },
            { b.minX, b.minY, b.minZ, b.minX, b.maxY, b.minZ }, { b.maxX, b.minY, b.minZ, b.maxX, b.maxY, b.minZ }, { b.maxX, b.minY, b.maxZ, b.maxX, b.maxY, b.maxZ }, { b.minX, b.minY, b.maxZ, b.minX, b.maxY, b.maxZ } };
        for (double[] l : e) box(glow, m, new Box(l[0] - t, l[1] - t, l[2] - t, l[3] + t, l[4] + t, l[5] + t), edge);
        return false;
    }

    private static void box(VertexConsumer vc, Matrix4f m, Box b, int col) {
        double[][] f = {
            { b.minX, b.minY, b.minZ, b.maxX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ, b.minX, b.minY, b.maxZ },
            { b.minX, b.maxY, b.minZ, b.minX, b.maxY, b.maxZ, b.maxX, b.maxY, b.maxZ, b.maxX, b.maxY, b.minZ },
            { b.minX, b.minY, b.minZ, b.minX, b.maxY, b.minZ, b.maxX, b.maxY, b.minZ, b.maxX, b.minY, b.minZ },
            { b.minX, b.minY, b.maxZ, b.maxX, b.minY, b.maxZ, b.maxX, b.maxY, b.maxZ, b.minX, b.maxY, b.maxZ },
            { b.minX, b.minY, b.minZ, b.minX, b.minY, b.maxZ, b.minX, b.maxY, b.maxZ, b.minX, b.maxY, b.minZ },
            { b.maxX, b.minY, b.minZ, b.maxX, b.maxY, b.minZ, b.maxX, b.maxY, b.maxZ, b.maxX, b.minY, b.maxZ } };
        for (double[] q : f) for (int i = 0; i < 12; i += 3) v(vc, m, q[i], q[i + 1], q[i + 2], col);
    }

    private WorldFx() {}
}
