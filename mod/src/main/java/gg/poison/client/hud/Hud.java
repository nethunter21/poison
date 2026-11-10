package gg.poison.client.hud;

import gg.poison.client.module.Category;
import gg.poison.client.module.Module;
import gg.poison.client.module.Modules;
import gg.poison.client.music.MusicPlayer;
import gg.poison.client.render.G2D;
import gg.poison.client.util.Colors;
import gg.poison.client.util.Cps;
import gg.poison.client.util.Ticker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** POISON 1.21.4 HUD: neon glow, animated array list, glowing keystrokes and crosshair. */
public final class Hud {
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
    private static long last = System.nanoTime();

    public static void render(DrawContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) return;
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        long now = System.nanoTime();
        float dt = Math.min(0.1f, (now - last) / 1e9f);
        last = now;
        float g = Colors.glow();

        if (Modules.SCREEN_GLOW.on()) screenGlow(ctx, sw, sh, g);
        if (Modules.CUSTOM_HOTBAR.on()) MintHud.hotbar(ctx);
        if (Modules.HUD_LAYOUT.is("mint")) {
            MintHud.render(ctx);
        } else {
            int y = Modules.WATERMARK.on() ? watermark(ctx, mc, g) : 4;
            pills(ctx, mc, y, g);
            if (Modules.ARRAYLIST.on()) arrayList(ctx, sw, dt, g);
            if (Modules.KEYSTROKES.on()) keystrokes(ctx, mc, 4, sh - 96, g);
            if (Modules.ARMOR.on() && !Modules.CUSTOM_HOTBAR.on()) armor(ctx, mc, sw, sh);
            if (Modules.NOW_PLAYING.on() && MusicPlayer.current() != null) nowPlaying(ctx, sw, g);
            if (Modules.TICKER.on()) ticker(ctx, sw);
        }
        if (Modules.CROSSHAIR.on() && mc.options.getPerspective().isFirstPerson() && mc.currentScreen == null) crosshair(ctx, sw, sh, g);
        Notifications.render(ctx);
    }

    private static void screenGlow(DrawContext ctx, int sw, int sh, float g) {
        int a = (int) (90 * Modules.SCREEN_GLOW_AMOUNT.f() * Math.min(2f, g));
        int c1 = Colors.alpha(Colors.accent(), a), c2 = Colors.alpha(Colors.accent2(), a), z1 = Colors.alpha(Colors.accent(), 0), z2 = Colors.alpha(Colors.accent2(), 0);
        if (Modules.SCREEN_GLOW_MODE.is("full")) {
            // whole-screen neon ambience, brighter at the edges
            G2D.rect(ctx, 0, 0, sw, sh, Colors.alpha(Colors.accent(), (int) (a * 0.45f)));
        }
        int d = Math.max(20, sh / 7);
        G2D.vgrad(ctx, 0, 0, sw, d, c1, z1);
        G2D.vgrad(ctx, 0, sh - d, sw, sh, z2, c2);
        G2D.hgrad(ctx, 0, 0, d, sh, c1, z1);
        G2D.hgrad(ctx, sw - d, 0, sw, sh, z2, c2);
    }

    private static int watermark(DrawContext ctx, MinecraftClient mc, float g) {
        String style = Modules.WATERMARK_STYLE.get();
        if (style.equals("box")) {
            String info = " | b1.5.0 | " + mc.getCurrentFps() + " fps | " + LocalTime.now().format(CLOCK);
            int w = G2D.width("POISON") + G2D.width(info) + 10;
            G2D.glow(ctx, 4, 4, 4 + w, 18, Colors.accent(), g);
            G2D.rect(ctx, 4, 4, 4 + w, 18, Colors.BG2);
            G2D.hgrad(ctx, 4, 4, 4 + w, 5, Colors.accent(), Colors.accent2());
            G2D.glowText(ctx, "POISON", 9, 7, Colors.accent(), g);
            G2D.glowText(ctx, info, 9 + G2D.width("POISON"), 7, 0xFFDDDDDD, 0);
            return 24;
        }
        if (style.equals("minimal")) { G2D.glowText(ctx, "POISON b1.5.0", 4, 4, Colors.accent(), g * 0.6f); return 16; }
        var m = ctx.getMatrices();
        m.push();
        m.translate(5, 4, 0);
        m.scale(1.6f, 1.6f, 1);
        int x = 0;
        String name = "POISON";
        for (int i = 0; i < name.length(); i++) {
            String ch = String.valueOf(name.charAt(i));
            G2D.glowText(ctx, ch, x, 0, Colors.grad(i / 6f), g * 1.3f);
            x += G2D.width(ch);
        }
        m.pop();
        G2D.glowText(ctx, "b1.5.0", 7 + (int) (x * 1.6f) + 2, 9, 0xFFBBBBBB, 0);
        G2D.hgrad(ctx, 4, 19, 4 + x * 1.6f + 40, 20, Colors.accent(), Colors.alpha(Colors.accent2(), 0));
        return 24;
    }

    private static void pills(DrawContext ctx, MinecraftClient mc, int y, float g) {
        List<String[]> p = new ArrayList<>();
        if (Modules.FPS.on()) p.add(new String[] { "FPS", String.valueOf(mc.getCurrentFps()) });
        if (Modules.CPS.on()) p.add(new String[] { "CPS", Cps.left() + " | " + Cps.right() });
        if (Modules.PING.on()) {
            PlayerListEntry e = mc.getNetworkHandler() != null ? mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()) : null;
            int ping = e != null ? e.getLatency() : 0;
            p.add(new String[] { "PING", ping + "ms" + (Modules.GAS_METER.on() ? "  gas " + ping * 3 + " gwei" : "") });
        }
        if (Modules.COORDS.on()) p.add(new String[] { "XYZ", String.format("%.1f / %.1f / %.1f  %s", mc.player.getX(), mc.player.getY(), mc.player.getZ(), mc.player.getHorizontalFacing().asString()) });
        if (Modules.CLOCK.on()) p.add(new String[] { "TIME", LocalTime.now().format(CLOCK) });
        for (String[] s : p) {
            int w = G2D.width(s[0]) + G2D.width(s[1]) + 12;
            G2D.glow(ctx, 3, y, 3 + w, y + 12, Colors.accent(), g * 0.35f);
            G2D.hgrad(ctx, 3, y, 3 + w, y + 12, 0xB0000000, 0x60000000);
            G2D.vgrad(ctx, 3, y, 4, y + 12, Colors.accent(), Colors.accent2());
            G2D.glowText(ctx, s[0], 7, y + 2, Colors.accent(), g * 0.5f);
            G2D.glowText(ctx, s[1], 10 + G2D.width(s[0]), y + 2, Colors.TEXT, 0);
            y += 14;
        }
    }

    private static void arrayList(DrawContext ctx, int sw, float dt, float g) {
        List<Module> list = new ArrayList<>();
        for (Module m : Modules.ALL) {
            boolean show = m.on() && m.category != Category.HUD && m.category != Category.UTIL;
            m.anim += ((show ? 1 : 0) - m.anim) * Math.min(1, dt * 10);
            if (m.anim > 0.02f) list.add(m);
        }
        list.sort(Comparator.comparingInt((Module m) -> G2D.width(m.name)).reversed());
        float y = 2;
        for (int i = 0; i < list.size(); i++) {
            Module m = list.get(i);
            float a = m.anim;
            int w = G2D.width(m.name);
            float x = sw - (w + 8) * a;
            int color = Modules.ARRAY_COLOR.is("accent") ? Colors.accent() : Modules.ARRAY_COLOR.is("rainbow") ? Colors.wave(0, 2f) : Colors.grad(i / 10f);
            if (Modules.ARRAY_BG.get()) G2D.hgrad(ctx, x - 2, y, sw, y + 11 * a, Colors.alpha(0, (int) (110 * a)), Colors.alpha(0, (int) (170 * a)));
            if (Modules.ARRAY_GLOW.get()) G2D.hgrad(ctx, sw - 14, y, sw, y + 11 * a, Colors.alpha(color, 0), Colors.alpha(color, (int) (90 * g * a)));
            G2D.rect(ctx, sw - 2, y, sw, y + 11 * a, color);
            G2D.glowText(ctx, m.name, (int) x + 2, (int) y + 2, color, Modules.ARRAY_GLOW.get() ? g * 0.7f * a : 0);
            y += 11 * a;
        }
    }

    private static void key(DrawContext ctx, float x, float y, float w, float h, String label, boolean down, float g) {
        if (down) {
            G2D.glow(ctx, x, y, x + w, y + h, Colors.accent(), g * 0.8f);
            G2D.vgrad(ctx, x, y, x + w, y + h, Colors.alpha(Colors.accent(), 230), Colors.alpha(Colors.accent2(), 230));
        } else G2D.rect(ctx, x, y, x + w, y + h, 0x90000000);
        String[] lines = label.split("\n");
        float ty = y + h / 2 - lines.length * 4.5f + 1;
        for (String l : lines) { G2D.glowText(ctx, l, (int) (x + w / 2 - G2D.width(l) / 2f), (int) ty, down ? 0xFF140600 : Colors.TEXT, 0); ty += 9; }
    }

    private static void keystrokes(DrawContext ctx, MinecraftClient mc, int x, int y, float g) {
        KeyBinding[] k = { mc.options.forwardKey, mc.options.leftKey, mc.options.backKey, mc.options.rightKey, mc.options.jumpKey };
        int s = 20, gap = 2;
        key(ctx, x + s + gap, y, s, s, "W", k[0].isPressed(), g);
        key(ctx, x, y + s + gap, s, s, "A", k[1].isPressed(), g);
        key(ctx, x + s + gap, y + s + gap, s, s, "S", k[2].isPressed(), g);
        key(ctx, x + 2 * (s + gap), y + s + gap, s, s, "D", k[3].isPressed(), g);
        float bw = (3 * s + gap) / 2f;
        key(ctx, x, y + 2 * (s + gap), bw, s, "LMB\n" + Cps.left(), Cps.leftDown, g);
        key(ctx, x + bw + gap, y + 2 * (s + gap), bw, s, "RMB\n" + Cps.right(), Cps.rightDown, g);
        key(ctx, x, y + 3 * (s + gap), 3 * s + 2 * gap, 10, "", k[4].isPressed(), g);
    }

    /** Horizontal armor row above the hotbar (right half). */
    private static void armor(DrawContext ctx, MinecraftClient mc, int sw, int sh) {
        EquipmentSlot[] slots = { EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND };
        int x = sw / 2 + 10, y = sh - 76;
        for (EquipmentSlot slot : slots) {
            ItemStack st = mc.player.getEquippedStack(slot);
            if (st.isEmpty()) continue;
            ctx.drawItem(st, x, y);
            if (st.isDamageable()) {
                int pct = Math.round((st.getMaxDamage() - st.getDamage()) * 100f / st.getMaxDamage());
                int color = pct > 50 ? 0xFF00FF9D : pct > 20 ? 0xFFFFD23F : 0xFFFF2E55;
                var m = ctx.getMatrices();
                m.push();
                m.translate(x + 8, y - 6, 200);
                m.scale(0.5f, 0.5f, 1);
                String t = pct + "%";
                G2D.glowText(ctx, t, -G2D.width(t) / 2, 0, color, 0.6f);
                m.pop();
            }
            x += 18;
        }
    }

    private static void nowPlaying(DrawContext ctx, int sw, float g) {
        String t = "♫ " + MusicPlayer.current();
        int w = Math.max(G2D.width(t) + 40, 120);
        int x = sw / 2 - w / 2, y = 4;
        G2D.glow(ctx, x, y, x + w, y + 16, Colors.accent(), g * 0.8f);
        G2D.rect(ctx, x, y, x + w, y + 16, Colors.BG2);
        G2D.hgrad(ctx, x, y + 15, x + w, y + 16, Colors.accent(), Colors.accent2());
        G2D.glowText(ctx, t, x + 6, y + 4, MusicPlayer.isPaused() ? Colors.MUTED : Colors.TEXT, 0);
        float[] bands = MusicPlayer.bands();
        for (int i = 0; i < 6; i++) {
            float h = 2 + Math.min(1, bands[i]) * 10;
            G2D.vgrad(ctx, x + w - 30 + i * 4, y + 13 - h, x + w - 28 + i * 4, y + 13, Colors.accent2(), Colors.accent());
        }
    }

    private static void ticker(DrawContext ctx, int sw) {
        Ticker.tick();
        List<String> parts = new ArrayList<>();
        List<Integer> colors = new ArrayList<>();
        for (int i = 0; i < Ticker.SYMS.length; i++) {
            double c = Ticker.change(i);
            parts.add(Ticker.SYMS[i] + " $" + Ticker.fmt(Ticker.price(i)) + " " + (c >= 0 ? "▲" : "▼") + String.format("%.2f%%", Math.abs(c)) + "    ");
            colors.add(c >= 0 ? 0xFF00FF9D : 0xFFFF2E55);
        }
        parts.add("SIMULATED · NOT FINANCIAL ADVICE    ");
        colors.add(Colors.accent());
        int total = 0;
        for (String p : parts) total += G2D.width(p);
        int bw = 220, bx = sw / 2 - bw / 2, y = 23;
        G2D.rect(ctx, bx, y - 1, bx + bw, y + 10, 0x90000000);
        ctx.enableScissor(bx, y - 1, bx + bw, y + 10);
        int off = (int) ((System.currentTimeMillis() / 25) % total);
        for (int rep = 0; rep < 2 + bw / Math.max(1, total); rep++) {
            int x = bx + rep * total - off;
            for (int i = 0; i < parts.size(); i++) {
                if (x < bx + bw && x + G2D.width(parts.get(i)) > bx) G2D.glowText(ctx, parts.get(i), x, y, colors.get(i), 0);
                x += G2D.width(parts.get(i));
            }
        }
        ctx.disableScissor();
    }

    private static void crosshair(DrawContext ctx, int sw, int sh, float g) {
        float cx = sw / 2f, cy = sh / 2f;
        int c = 0xFFFFFFFF, gc = Colors.accent();
        String st = Modules.CROSSHAIR_STYLE.get();
        float gap = 2 + (Cps.leftDown ? 1.5f : 0);
        if (st.equals("circle")) {
            for (int i = 0; i < 24; i++) {
                double a = i / 24.0 * Math.PI * 2;
                float px = cx + (float) Math.cos(a) * 3.5f, py = cy + (float) Math.sin(a) * 3.5f;
                G2D.rect(ctx, px - 0.5f, py - 0.5f, px + 0.5f, py + 0.5f, c);
            }
            G2D.glow(ctx, cx - 3, cy - 3, cx + 3, cy + 3, gc, g * 0.6f);
        } else if (st.equals("diamond")) {
            for (int i = -4; i <= 4; i++) {
                float o = 4 - Math.abs(i);
                G2D.rect(ctx, cx + i - 0.5f, cy - o - 0.5f, cx + i + 0.5f, cy - o + 0.5f, c);
                G2D.rect(ctx, cx + i - 0.5f, cy + o - 0.5f, cx + i + 0.5f, cy + o + 0.5f, c);
            }
        } else {
            G2D.glow(ctx, cx - 0.5f, cy - 0.5f, cx + 0.5f, cy + 0.5f, gc, g * 1.2f);
            G2D.rect(ctx, cx - 0.5f, cy - 5 - gap, cx + 0.5f, cy - gap, c);
            G2D.rect(ctx, cx - 0.5f, cy + gap, cx + 0.5f, cy + 5 + gap, c);
            G2D.rect(ctx, cx - 5 - gap, cy - 0.5f, cx - gap, cy + 0.5f, c);
            G2D.rect(ctx, cx + gap, cy - 0.5f, cx + 5 + gap, cy + 0.5f, c);
            if (st.equals("cross-dot")) G2D.rect(ctx, cx - 0.5f, cy - 0.5f, cx + 0.5f, cy + 0.5f, gc);
        }
    }

    private Hud() {}
}
