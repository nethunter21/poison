package gg.poison.legacy.render;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.util.Theme;
import net.minecraft.block.Block;
import net.minecraft.block.material.Material;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.render.entity.EntityRenderDispatcher;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import org.lwjgl.opengl.GL11;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;

/**
 * World-space visual effects. Everything here is either around YOUR OWN player
 * (jump circles, china hat, trail, aura) or feedback on hits you already landed
 * (particles, kill effects). Nothing reveals hidden entities or helps aim.
 */
public final class WorldFx {
    private static final Random RNG = new Random();

    private static final class Ring { final double x, y, z; final long t; Ring(double x, double y, double z) { this.x = x; this.y = y; this.z = z; this.t = System.currentTimeMillis(); } }
    private static final class Particle {
        double x, y, z, vx, vy, vz; final int color; final float size; final long born; final float life; final int shape;
        Particle(double x, double y, double z, double vx, double vy, double vz, int color, float size, float life, int shape) {
            this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.color = color; this.size = size; this.life = life; this.shape = shape; this.born = System.currentTimeMillis();
        }
    }
    private static final class Bolt { final double x, y, z; final long t; final double[] jag; Bolt(double x, double y, double z) {
        this.x = x; this.y = y; this.z = z; this.t = System.currentTimeMillis(); jag = new double[24]; for (int i = 0; i < jag.length; i++) jag[i] = (RNG.nextDouble() - 0.5) * 0.9; } }
    private static final class FloatText { final double x, y, z; final String text; final int color; final long t;
        FloatText(double x, double y, double z, String text, int color) { this.x = x; this.y = y; this.z = z; this.text = text; this.color = color; this.t = System.currentTimeMillis(); } }

    private static final List<Ring> RINGS = new ArrayList<Ring>();
    private static final List<Particle> PARTICLES = new ArrayList<Particle>();
    private static final List<Bolt> BOLTS = new ArrayList<Bolt>();
    private static final List<FloatText> TEXTS = new ArrayList<FloatText>();
    private static final LinkedList<double[]> TRAIL = new LinkedList<double[]>();
    /** entity id -> last time you hit it, for kill effects */
    private static final java.util.Map<Integer, Long> HIT = new java.util.HashMap<Integer, Long>();
    private static boolean wasOnGround = true;
    private static long lastFrame = System.nanoTime();

    // ------------------------------------------------------------------ events
    public static void tick() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.world == null) { RINGS.clear(); PARTICLES.clear(); TRAIL.clear(); HIT.clear(); return; }
        Entity p = mc.player;
        if (Modules.JUMP_CIRCLES.on() && wasOnGround && !p.onGround && p.velocityY > 0.2) RINGS.add(new Ring(p.x, p.y + 0.02, p.z));
        wasOnGround = p.onGround;
        if (Modules.TRAILS.on()) {
            TRAIL.addFirst(new double[] { p.x, p.y, p.z });
            while (TRAIL.size() > Modules.TRAIL_LENGTH.get()) TRAIL.removeLast();
        } else TRAIL.clear();
        // kill effects: something you hit in the last 3s just died
        long now = System.currentTimeMillis();
        for (Iterator<java.util.Map.Entry<Integer, Long>> it = HIT.entrySet().iterator(); it.hasNext(); ) {
            java.util.Map.Entry<Integer, Long> e = it.next();
            Entity ent = mc.world.getEntityById(e.getKey());
            if (now - e.getValue() > 3000) { it.remove(); continue; }
            if (ent instanceof LivingEntity && (((LivingEntity) ent).getHealth() <= 0 || ent.removed)) {
                kill(ent);
                it.remove();
            }
        }
    }

    /** You landed a hit on {@code target}. */
    public static void onHit(Entity target) {
        HIT.put(target.getEntityId(), System.currentTimeMillis());
        if (!Modules.HIT_FX.on()) return;
        String st = Modules.HIT_STYLE.get();
        int n = (int) Modules.HIT_AMOUNT.get().doubleValue();
        double cx = target.x, cy = target.y + target.height * 0.6, cz = target.z;
        for (int i = 0; i < n; i++) {
            int color = st.equals("coins") ? 0xFFFFC233 : st.equals("hearts") ? 0xFFFF2E55 : st.equals("hex") ? 0xFF00FF66 : (RNG.nextBoolean() ? Theme.accent() : Theme.accent2());
            int shape = st.equals("coins") ? 1 : st.equals("hearts") ? 2 : 0;
            double sp = 0.06 + RNG.nextDouble() * 0.12;
            double a = RNG.nextDouble() * Math.PI * 2, el = (RNG.nextDouble() - 0.3) * Math.PI;
            PARTICLES.add(new Particle(cx, cy, cz, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 0.05, Math.sin(a) * Math.cos(el) * sp, color, 0.025f + RNG.nextFloat() * 0.025f, 0.6f + RNG.nextFloat() * 0.5f, shape));
        }
    }

    private static void kill(Entity e) {
        if (!Modules.KILL_FX.on()) return;
        MinecraftClient mc = MinecraftClient.getInstance();
        String fx = Modules.KILL_STYLE.get();
        double x = e.x, y = e.y, z = e.z;
        if (fx.equals("lightning")) {
            BOLTS.add(new Bolt(x, y, z));
            mc.world.playSound(x, y, z, "ambient.weather.thunder", 0.6f, 1.4f, false);
        } else if (fx.equals("rekt")) {
            TEXTS.add(new FloatText(x, y + e.height + 0.3, z, "REKT", Theme.accent()));
            mc.world.playSound(x, y, z, "random.orb", 1f, 0.7f, false);
        } else {
            boolean coins = fx.equals("liquidation");
            for (int i = 0; i < 70; i++) {
                double a = RNG.nextDouble() * Math.PI * 2, sp = 0.08 + RNG.nextDouble() * 0.22;
                int c = coins ? (RNG.nextBoolean() ? 0xFFFFC233 : 0xFFFF8A00) : Theme.hsv(RNG.nextFloat(), 0.8f, 1f, 255);
                PARTICLES.add(new Particle(x, y + e.height * 0.5, z, Math.cos(a) * sp, 0.15 + RNG.nextDouble() * 0.25, Math.sin(a) * sp, c, 0.045f, 1.4f, coins ? 1 : 0));
            }
            RINGS.add(new Ring(x, y + 0.05, z));
            if (coins) TEXTS.add(new FloatText(x, y + e.height + 0.3, z, "LIQUIDATED", 0xFFFFC233));
            mc.world.playSound(x, y, z, coins ? "random.levelup" : "fireworks.twinkle", 0.8f, 1.2f, false);
        }
    }

    // ------------------------------------------------------------------ rendering
    /** Called inside the world render pass (camera transform active), before the hand. */
    public static void render(float tickDelta) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null) return;
        EntityRenderDispatcher d = mc.getEntityRenderManager();
        double cx = d.cameraX, cy = d.cameraY, cz = d.cameraZ;
        long nowNs = System.nanoTime();
        float dt = Math.min(0.1f, (nowNs - lastFrame) / 1e9f);
        lastFrame = nowNs;
        float g = Theme.glow();

        GlStateManager.pushMatrix();
        GlStateManager.disableTexture();
        GlStateManager.disableLighting();
        GlStateManager.disableCull();
        GlStateManager.enableBlend();
        GlStateManager.shadeModel(GL11.GL_SMOOTH);
        GlStateManager.depthMask(false);
        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE); // additive = glow

        Entity p = mc.player;
        double px = p.prevTickX + (p.x - p.prevTickX) * tickDelta;
        double py = p.prevTickY + (p.y - p.prevTickY) * tickDelta;
        double pz = p.prevTickZ + (p.z - p.prevTickZ) * tickDelta;

        renderRings(cx, cy, cz, g);
        if (Modules.TRAILS.on() && TRAIL.size() > 1) renderTrail(px, py, pz, cx, cy, cz, g);
        if (Modules.AURA.on()) renderAura(px, py, pz, cx, cy, cz, g);
        if (Modules.CHINA_HAT.on() && mc.options.perspective != 0) renderHat(p, px, py, pz, cx, cy, cz, g);
        renderParticles(d, cx, cy, cz, dt);
        renderBolts(cx, cy, cz);

        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        GlStateManager.depthMask(true);
        GlStateManager.shadeModel(GL11.GL_FLAT);
        GlStateManager.enableCull();
        GlStateManager.enableTexture();
        renderTexts(d, cx, cy, cz);
        GlStateManager.disableBlend();
        GlStateManager.popMatrix();
        GlStateManager.color(1, 1, 1, 1);
    }

    private static void c(BufferBuilder b, double x, double y, double z, int argb) {
        b.vertex(x, y, z).color((argb >> 16) & 255, (argb >> 8) & 255, argb & 255, argb >>> 24).next();
    }

    private static void renderRings(double cx, double cy, double cz, float g) {
        long now = System.currentTimeMillis();
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        for (Iterator<Ring> it = RINGS.iterator(); it.hasNext(); ) {
            Ring r = it.next();
            float age = (now - r.t) / 1000f;
            if (age > 0.9f) { it.remove(); continue; }
            float k = age / 0.9f;
            double R = Modules.JUMP_SIZE.get() * (1 - Math.pow(1 - k, 3));
            int a = (int) (200 * (1 - k) * Math.min(1.5f, g));
            b.begin(GL11.GL_TRIANGLE_STRIP, VertexFormats.POSITION_COLOR);
            for (int i = 0; i <= 64; i++) {
                double ang = i / 64.0 * Math.PI * 2;
                int col = Theme.grad(i / 64f);
                c(b, r.x - cx + Math.cos(ang) * R, r.y - cy, r.z - cz + Math.sin(ang) * R, Theme.alpha(col, a));
                c(b, r.x - cx + Math.cos(ang) * R * 0.7, r.y - cy, r.z - cz + Math.sin(ang) * R * 0.7, Theme.alpha(col, 0));
            }
            t.draw();
        }
    }

    private static void renderTrail(double px, double py, double pz, double cx, double cy, double cz, float g) {
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        b.begin(GL11.GL_TRIANGLE_STRIP, VertexFormats.POSITION_COLOR);
        int n = TRAIL.size(), i = 0;
        for (double[] q : TRAIL) {
            double x = i == 0 ? px : q[0], y = i == 0 ? py : q[1], z = i == 0 ? pz : q[2];
            float f = 1 - i / (float) n;
            int col = Theme.alpha(Theme.grad(i / (float) n), (int) (150 * f * Math.min(1.5f, g)));
            c(b, x - cx, y - cy + 0.05, z - cz, col);
            c(b, x - cx, y - cy + 0.05 + 0.9 * f, z - cz, Theme.alpha(col, 0));
            i++;
        }
        t.draw();
    }

    private static void renderAura(double px, double py, double pz, double cx, double cy, double cz, float g) {
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        double R = Modules.AURA_RADIUS.get(), spin = System.currentTimeMillis() / 600.0;
        double y = py - cy + 0.05 + Math.sin(spin * 1.3) * 0.05;
        b.begin(GL11.GL_TRIANGLE_STRIP, VertexFormats.POSITION_COLOR);
        for (int i = 0; i <= 72; i++) {
            double a = i / 72.0 * Math.PI * 2;
            float seg = (float) ((Math.sin(a * 3 + spin * 2) + 1) / 2);
            int col = Theme.grad(i / 72f);
            c(b, px - cx + Math.cos(a) * R, y, pz - cz + Math.sin(a) * R, Theme.alpha(col, (int) (60 + 160 * seg * Math.min(1.5f, g))));
            c(b, px - cx + Math.cos(a) * R, y + 0.25 + 0.2 * seg, pz - cz + Math.sin(a) * R, Theme.alpha(col, 0));
        }
        t.draw();
    }

    private static void renderHat(Entity p, double px, double py, double pz, double cx, double cy, double cz, float g) {
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        double size = Modules.HAT_SIZE.get();
        double top = py - cy + p.height + (p.isSneaking() ? -0.15 : 0.08);
        double x = px - cx, z = pz - cz;
        b.begin(GL11.GL_TRIANGLE_FAN, VertexFormats.POSITION_COLOR);
        c(b, x, top + size * 0.45, z, Theme.alpha(Theme.accent(), (int) (200 * Math.min(1.3f, g))));
        for (int i = 0; i <= 48; i++) {
            double a = i / 48.0 * Math.PI * 2;
            c(b, x + Math.cos(a) * size, top, z + Math.sin(a) * size, Theme.alpha(Theme.grad(i / 48f), (int) (110 * Math.min(1.3f, g))));
        }
        t.draw();
        GL11.glLineWidth(2.5f);
        b.begin(GL11.GL_LINE_STRIP, VertexFormats.POSITION_COLOR);
        for (int i = 0; i <= 48; i++) {
            double a = i / 48.0 * Math.PI * 2;
            c(b, x + Math.cos(a) * size, top, z + Math.sin(a) * size, Theme.alpha(Theme.grad(i / 48f), 255));
        }
        t.draw();
        GL11.glLineWidth(1f);
    }

    private static void renderParticles(EntityRenderDispatcher d, double cx, double cy, double cz, float dt) {
        long now = System.currentTimeMillis();
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        // camera-facing basis from the camera yaw/pitch
        double yaw = Math.toRadians(d.yaw), pitch = Math.toRadians(d.pitch);
        double rx = Math.cos(yaw), rz = Math.sin(yaw);
        double ux = Math.sin(yaw) * Math.sin(pitch), uy = Math.cos(pitch), uz = -Math.cos(yaw) * Math.sin(pitch);
        b.begin(GL11.GL_QUADS, VertexFormats.POSITION_COLOR);
        for (Iterator<Particle> it = PARTICLES.iterator(); it.hasNext(); ) {
            Particle q = it.next();
            float age = (now - q.born) / 1000f;
            if (age > q.life) { it.remove(); continue; }
            float s60 = dt * 60;
            q.x += q.vx * s60; q.y += q.vy * s60; q.z += q.vz * s60;
            q.vy -= 0.008 * s60; q.vx *= Math.pow(0.96, s60); q.vz *= Math.pow(0.96, s60);
            float f = 1 - age / q.life;
            double x = q.x - cx, y = q.y - cy, z = q.z - cz;
            // soft halo first, then the bright core: reads as a glowing ember
            for (int layer = 0; layer < 2; layer++) {
                double s = q.size * (layer == 0 ? 3.2 : 1) * (q.shape == 2 ? 1.3 : 1);
                int col = layer == 0 ? Theme.alpha(q.color, (int) (70 * f)) : Theme.alpha(Theme.lerp(q.color, 0xFFFFFFFF, 0.35f), (int) (255 * f));
                if (q.shape == 2 || q.shape == 1) { // diamond / coin
                    c(b, x + ux * s, y + uy * s, z + uz * s, col);
                    c(b, x + rx * s, y, z + rz * s, col);
                    c(b, x - ux * s, y - uy * s, z - uz * s, col);
                    c(b, x - rx * s, y, z - rz * s, col);
                } else {
                    c(b, x - rx * s - ux * s, y - uy * s, z - rz * s - uz * s, col);
                    c(b, x + rx * s - ux * s, y - uy * s, z + rz * s - uz * s, col);
                    c(b, x + rx * s + ux * s, y + uy * s, z + rz * s + uz * s, col);
                    c(b, x - rx * s + ux * s, y + uy * s, z - rz * s + uz * s, col);
                }
            }
        }
        t.draw();
    }

    private static void renderBolts(double cx, double cy, double cz) {
        long now = System.currentTimeMillis();
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        for (Iterator<Bolt> it = BOLTS.iterator(); it.hasNext(); ) {
            Bolt bo = it.next();
            float age = (now - bo.t) / 1000f;
            if (age > 0.6f) { it.remove(); continue; }
            int a = (int) (255 * (1 - age / 0.6f) * (0.6 + 0.4 * Math.sin(age * 60)));
            for (int pass = 0; pass < 2; pass++) {
                GL11.glLineWidth(pass == 0 ? 9f : 3f);
                b.begin(GL11.GL_LINE_STRIP, VertexFormats.POSITION_COLOR);
                for (int i = 0; i < bo.jag.length; i++) {
                    double y = bo.y + 12 - i * 0.5;
                    c(b, bo.x - cx + bo.jag[i], y - cy, bo.z - cz + bo.jag[(i + 7) % bo.jag.length], pass == 0 ? Theme.alpha(Theme.accent2(), a / 3) : Theme.alpha(0xFFFFFFFF, a));
                }
                t.draw();
            }
        }
        GL11.glLineWidth(1f);
    }

    private static void renderTexts(EntityRenderDispatcher d, double cx, double cy, double cz) {
        long now = System.currentTimeMillis();
        MinecraftClient mc = MinecraftClient.getInstance();
        for (Iterator<FloatText> it = TEXTS.iterator(); it.hasNext(); ) {
            FloatText ft = it.next();
            float age = (now - ft.t) / 1000f;
            if (age > 1.8f) { it.remove(); continue; }
            GlStateManager.pushMatrix();
            GlStateManager.translate(ft.x - cx, ft.y - cy + age * 0.6, ft.z - cz);
            GlStateManager.rotate(-d.yaw, 0, 1, 0);
            GlStateManager.rotate(d.pitch, 1, 0, 0);
            float s = 0.024f * (1 + Math.min(1, age * 4) * 0.4f);
            GlStateManager.scale(-s, -s, s);
            GlStateManager.disableDepthTest();
            int a = (int) (255 * Math.min(1, (1.8f - age) * 2));
            String txt = ft.text;
            int w = mc.textRenderer.getStringWidth(txt);
            R2D.glowText(txt, -w / 2f, 0, Theme.alpha(ft.color, a), 1.5f);
            GlStateManager.enableDepthTest();
            GlStateManager.popMatrix();
        }
    }

    /** Neon block outline + fill (replaces the vanilla black outline). */
    public static void drawBlockOutline(BlockHitResult hit, float tickDelta) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (hit == null || hit.type != BlockHitResult.Type.BLOCK) return;
        BlockPos pos = hit.getBlockPos();
        Block block = mc.world.getBlockState(pos).getBlock();
        if (block.getMaterial() == Material.AIR) return;
        Entity p = mc.player;
        double dx = p.prevTickX + (p.x - p.prevTickX) * tickDelta;
        double dy = p.prevTickY + (p.y - p.prevTickY) * tickDelta;
        double dz = p.prevTickZ + (p.z - p.prevTickZ) * tickDelta;
        block.setBoundingBox(mc.world, pos);
        Box bx = block.getSelectionBox(mc.world, pos).expand(0.003, 0.003, 0.003).offset(-dx, -dy, -dz);
        float g = Theme.glow();
        GlStateManager.enableBlend();
        GlStateManager.disableTexture();
        GlStateManager.depthMask(false);
        if (Modules.OUTLINE_FILL.get()) {
            GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE);
            fill(bx, Theme.alpha(Theme.accent(), (int) (30 + 25 * Math.sin(System.currentTimeMillis() / 300.0) * 0.5 + 15)));
        }
        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE);
        lines(bx, Theme.alpha(Theme.accent2(), (int) (70 * Math.min(1.5f, g))), Modules.OUTLINE_WIDTH.f() * 3);
        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        lines(bx, Theme.alpha(Theme.accent(), 255), Modules.OUTLINE_WIDTH.f());
        GlStateManager.depthMask(true);
        GlStateManager.enableTexture();
        GlStateManager.disableBlend();
        GL11.glLineWidth(1);
    }

    private static void lines(Box b, int col, float width) {
        GL11.glLineWidth(width);
        Tessellator t = Tessellator.getInstance();
        BufferBuilder bb = t.getBuffer();
        bb.begin(GL11.GL_LINES, VertexFormats.POSITION_COLOR);
        double[][] e = {
            { b.minX, b.minY, b.minZ, b.maxX, b.minY, b.minZ }, { b.maxX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ }, { b.maxX, b.minY, b.maxZ, b.minX, b.minY, b.maxZ }, { b.minX, b.minY, b.maxZ, b.minX, b.minY, b.minZ },
            { b.minX, b.maxY, b.minZ, b.maxX, b.maxY, b.minZ }, { b.maxX, b.maxY, b.minZ, b.maxX, b.maxY, b.maxZ }, { b.maxX, b.maxY, b.maxZ, b.minX, b.maxY, b.maxZ }, { b.minX, b.maxY, b.maxZ, b.minX, b.maxY, b.minZ },
            { b.minX, b.minY, b.minZ, b.minX, b.maxY, b.minZ }, { b.maxX, b.minY, b.minZ, b.maxX, b.maxY, b.minZ }, { b.maxX, b.minY, b.maxZ, b.maxX, b.maxY, b.maxZ }, { b.minX, b.minY, b.maxZ, b.minX, b.maxY, b.maxZ } };
        for (double[] l : e) { c(bb, l[0], l[1], l[2], col); c(bb, l[3], l[4], l[5], col); }
        t.draw();
    }

    private static void fill(Box b, int col) {
        Tessellator t = Tessellator.getInstance();
        BufferBuilder bb = t.getBuffer();
        bb.begin(GL11.GL_QUADS, VertexFormats.POSITION_COLOR);
        double[][] f = {
            { b.minX, b.minY, b.minZ, b.maxX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ, b.minX, b.minY, b.maxZ },
            { b.minX, b.maxY, b.minZ, b.minX, b.maxY, b.maxZ, b.maxX, b.maxY, b.maxZ, b.maxX, b.maxY, b.minZ },
            { b.minX, b.minY, b.minZ, b.minX, b.maxY, b.minZ, b.maxX, b.maxY, b.minZ, b.maxX, b.minY, b.minZ },
            { b.minX, b.minY, b.maxZ, b.maxX, b.minY, b.maxZ, b.maxX, b.maxY, b.maxZ, b.minX, b.maxY, b.maxZ },
            { b.minX, b.minY, b.minZ, b.minX, b.minY, b.maxZ, b.minX, b.maxY, b.maxZ, b.minX, b.maxY, b.minZ },
            { b.maxX, b.minY, b.minZ, b.maxX, b.maxY, b.minZ, b.maxX, b.maxY, b.maxZ, b.maxX, b.minY, b.maxZ } };
        for (double[] q : f) for (int i = 0; i < 12; i += 3) c(bb, q[i], q[i + 1], q[i + 2], col);
        t.draw();
    }

    private WorldFx() {}
}
