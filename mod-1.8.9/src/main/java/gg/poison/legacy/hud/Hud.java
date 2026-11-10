package gg.poison.legacy.hud;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.module.Category;
import gg.poison.legacy.module.Module;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.music.MusicPlayer;
import gg.poison.legacy.render.R2D;
import gg.poison.legacy.util.Cps;
import gg.poison.legacy.util.Theme;
import gg.poison.legacy.util.Ticker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.DiffuseLighting;
import net.minecraft.client.util.Window;
import net.minecraft.item.ItemStack;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

/** POISON 1.8.9 HUD: neon glow everywhere, animated array list. */
public final class Hud {
    private static long last = System.nanoTime();

    public static void render() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden || mc.options.debugEnabled) return;
        Window w = new Window(mc);
        int sw = w.getWidth(), sh = w.getHeight();
        long now = System.nanoTime();
        float dt = Math.min(0.1f, (now - last) / 1e9f);
        last = now;
        float g = Theme.glow();

        GlStateManager.pushMatrix();
        if (Modules.SCREEN_GLOW.on()) screenGlow(sw, sh, g);
        int y = 4;
        if (Modules.WATERMARK.on()) y = watermark(g);
        y = pills(mc, y, g);
        if (Modules.ARRAYLIST.on()) arrayList(sw, dt, g);
        if (Modules.KEYSTROKES.on()) keystrokes(mc, 4, sh - 96, g);
        if (Modules.ARMOR.on()) armor(mc, sw, sh);
        if (Modules.NOW_PLAYING.on() && MusicPlayer.current() != null) nowPlaying(sw, g);
        if (Modules.TICKER.on()) ticker(sw);
        if (Modules.CROSSHAIR.on() && mc.options.perspective == 0 && mc.currentScreen == null) crosshair(sw, sh, g);
        Notifications.render(sw, sh, g);
        GlStateManager.popMatrix();
        GlStateManager.color(1, 1, 1, 1);
    }

    private static void screenGlow(int sw, int sh, float g) {
        int a = (int) (90 * Modules.SCREEN_GLOW_AMOUNT.f() * Math.min(2f, g));
        int c1 = Theme.alpha(Theme.accent(), a), c2 = Theme.alpha(Theme.accent2(), a), z1 = Theme.alpha(Theme.accent(), 0), z2 = Theme.alpha(Theme.accent2(), 0);
        int d = Math.max(20, sh / 7);
        R2D.vgrad(0, 0, sw, d, c1, z1);
        R2D.vgrad(0, sh - d, sw, sh, z2, c2);
        R2D.hgrad(0, 0, d, sh, c1, z1);
        R2D.hgrad(sw - d, 0, sw, sh, z2, c2);
    }

    private static int watermark(float g) {
        String style = Modules.WATERMARK_STYLE.get();
        String name = "POISON";
        if (style.equals("box")) {
            String info = " | b1.5.0 | " + MinecraftClient.getCurrentFps() + " fps | " + new SimpleDateFormat("HH:mm").format(new Date());
            int w = R2D.width(name) + R2D.width(info) + 10;
            R2D.glow(4, 4, 4 + w, 18, Theme.accent(), g);
            R2D.rect(4, 4, 4 + w, 18, Theme.BG);
            R2D.hgrad(4, 4, 4 + w, 5, Theme.accent(), Theme.accent2());
            R2D.glowText(name, 9, 7, Theme.accent(), g);
            R2D.text(info, 9 + R2D.width(name), 7, 0xFFDDDDDD);
            return 24;
        }
        if (style.equals("minimal")) {
            R2D.glowText(name + " b1.5.0", 4, 4, Theme.accent(), g * 0.6f);
            return 16;
        }
        // "glow": big gradient letters with bloom
        GlStateManager.pushMatrix();
        GlStateManager.translate(5, 4, 0);
        GlStateManager.scale(1.6f, 1.6f, 1);
        float x = 0;
        for (int i = 0; i < name.length(); i++) {
            String ch = String.valueOf(name.charAt(i));
            R2D.glowText(ch, x, 0, Theme.grad(i / 6f), g * 1.3f);
            x += R2D.width(ch);
        }
        GlStateManager.popMatrix();
        R2D.text("b1.5.0", 6 + (int) (x * 1.6f) + 2, 9, 0xFFBBBBBB);
        R2D.hgrad(4, 19, 4 + x * 1.6f + 40, 20, Theme.accent(), Theme.alpha(Theme.accent2(), 0));
        return 24;
    }

    private static int pills(MinecraftClient mc, int y, float g) {
        List<String[]> p = new ArrayList<String[]>();
        if (Modules.FPS.on()) p.add(new String[] { "FPS", String.valueOf(MinecraftClient.getCurrentFps()) });
        if (Modules.CPS.on()) p.add(new String[] { "CPS", Cps.left() + " | " + Cps.right() });
        if (Modules.PING.on()) {
            PlayerListEntry e = mc.getNetworkHandler() != null ? mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()) : null;
            int ping = e != null ? e.getLatency() : 0;
            p.add(new String[] { "PING", ping + "ms" + (Modules.GAS_METER.on() ? "  §7gas " + ping * 3 + " gwei" : "") });
        }
        if (Modules.COORDS.on()) p.add(new String[] { "XYZ", String.format("%.1f / %.1f / %.1f", mc.player.x, mc.player.y, mc.player.z) });
        if (Modules.CLOCK.on()) p.add(new String[] { "TIME", new SimpleDateFormat("HH:mm").format(new Date()) });
        for (String[] s : p) {
            int w = R2D.width(s[0]) + R2D.width(s[1]) + 12;
            R2D.glow(3, y, 3 + w, y + 12, Theme.accent(), g * 0.35f);
            R2D.hgrad(3, y, 3 + w, y + 12, 0xB0000000, 0x60000000);
            R2D.vgrad(3, y, 4, y + 12, Theme.accent(), Theme.accent2());
            R2D.glowText(s[0], 7, y + 2, Theme.accent(), g * 0.5f);
            R2D.text(s[1], 10 + R2D.width(s[0]), y + 2, Theme.TEXT);
            y += 14;
        }
        return y;
    }

    private static void arrayList(int sw, float dt, float g) {
        List<Module> list = new ArrayList<Module>();
        for (Module m : Modules.ALL) {
            boolean show = m.on() && m.category != Category.HUD && m.category != Category.UTIL;
            m.anim += ((show ? 1 : 0) - m.anim) * Math.min(1, dt * 10);
            if (m.anim > 0.02f) list.add(m);
        }
        Collections.sort(list, new Comparator<Module>() {
            public int compare(Module a, Module b) { return R2D.width(b.name) - R2D.width(a.name); }
        });
        float y = 2;
        for (int i = 0; i < list.size(); i++) {
            Module m = list.get(i);
            float a = m.anim;
            int w = R2D.width(m.name);
            float x = sw - (w + 8) * a;
            int color = Modules.ARRAY_COLOR.is("accent") ? Theme.accent() : Modules.ARRAY_COLOR.is("rainbow") ? Theme.wave(0, 2f) : Theme.grad(i / 10f);
            if (Modules.ARRAY_BG.get()) R2D.hgrad(x - 2, y, sw, y + 11 * a, Theme.alpha(0, (int) (110 * a)), Theme.alpha(0, (int) (170 * a)));
            if (Modules.ARRAY_GLOW.get()) R2D.hgrad(sw - 14, y, sw, y + 11 * a, Theme.alpha(color, 0), Theme.alpha(color, (int) (90 * g * a)));
            R2D.rect(sw - 2, y, sw, y + 11 * a, color);
            R2D.glowText(m.name, x + 2, y + 2, color, Modules.ARRAY_GLOW.get() ? g * 0.7f * a : 0);
            y += 11 * a;
        }
    }

    private static void key(float x, float y, float w, float h, String label, boolean down, float g) {
        if (down) {
            R2D.glow(x, y, x + w, y + h, Theme.accent(), g * 0.8f);
            R2D.vgrad(x, y, x + w, y + h, Theme.alpha(Theme.accent(), 230), Theme.alpha(Theme.accent2(), 230));
        } else R2D.rect(x, y, x + w, y + h, 0x90000000);
        String[] lines = label.split("\n");
        float ty = y + h / 2 - lines.length * 4.5f + 1;
        for (String l : lines) {
            R2D.text(l, x + w / 2 - R2D.width(l) / 2f, ty, down ? 0xFF140600 : Theme.TEXT);
            ty += 9;
        }
    }

    private static void keystrokes(MinecraftClient mc, int x, int y, float g) {
        KeyBinding[] k = { mc.options.forwardKey, mc.options.leftKey, mc.options.backKey, mc.options.rightKey, mc.options.jumpKey };
        int s = 20, gap = 2;
        key(x + s + gap, y, s, s, "W", k[0].isPressed(), g);
        key(x, y + s + gap, s, s, "A", k[1].isPressed(), g);
        key(x + s + gap, y + s + gap, s, s, "S", k[2].isPressed(), g);
        key(x + 2 * (s + gap), y + s + gap, s, s, "D", k[3].isPressed(), g);
        float bw = (3 * s + gap) / 2f;
        key(x, y + 2 * (s + gap), bw, s, "LMB\n" + Cps.left(), Cps.leftDown(), g);
        key(x + bw + gap, y + 2 * (s + gap), bw, s, "RMB\n" + Cps.right(), Cps.rightDown(), g);
        key(x, y + 3 * (s + gap), 3 * s + 2 * gap, 10, "", k[4].isPressed(), g);
    }

    /** Horizontal armor row above the hotbar (right half), clear of the module list. */
    private static void armor(MinecraftClient mc, int sw, int sh) {
        List<ItemStack> stacks = new ArrayList<ItemStack>();
        for (int i = 3; i >= 0; i--) if (mc.player.inventory.armor[i] != null) stacks.add(mc.player.inventory.armor[i]);
        if (mc.player.getMainHandStack() != null) stacks.add(mc.player.getMainHandStack());
        int x = sw / 2 + 10, y = sh - 76;
        for (ItemStack st : stacks) {
            GlStateManager.pushMatrix();
            DiffuseLighting.enable();
            mc.getItemRenderer().renderInGuiWithOverrides(st, x, y);
            DiffuseLighting.disable();
            GlStateManager.popMatrix();
            if (st.isDamageable()) {
                int pct = Math.round((st.getMaxDamage() - st.getDamage()) * 100f / st.getMaxDamage());
                int color = pct > 50 ? 0xFF00FF9D : pct > 20 ? 0xFFFFD23F : 0xFFFF2E55;
                GlStateManager.pushMatrix();
                GlStateManager.translate(x + 8, y - 6, 0);
                GlStateManager.scale(0.5f, 0.5f, 1);
                String t = pct + "%";
                R2D.glowText(t, -R2D.width(t) / 2f, 0, color, 0.6f);
                GlStateManager.popMatrix();
            }
            x += 18;
        }
    }

    private static void nowPlaying(int sw, float g) {
        String t = "♫ " + MusicPlayer.current();
        int w = Math.max(R2D.width(t) + 40, 120);
        int x = sw / 2 - w / 2, y = 4;
        R2D.glow(x, y, x + w, y + 16, Theme.accent(), g * 0.8f);
        R2D.rect(x, y, x + w, y + 16, Theme.BG);
        R2D.hgrad(x, y + 15, x + w, y + 16, Theme.accent(), Theme.accent2());
        R2D.text(t, x + 6, y + 4, MusicPlayer.isPaused() ? Theme.MUTED : Theme.TEXT);
        float[] bands = MusicPlayer.bands();
        for (int i = 0; i < 6; i++) {
            float h = 2 + Math.min(1, bands[i]) * 10;
            R2D.vgrad(x + w - 30 + i * 4, y + 13 - h, x + w - 28 + i * 4, y + 13, Theme.accent2(), Theme.accent());
        }
    }

    private static void ticker(int sw) {
        Ticker.tick();
        List<String> parts = new ArrayList<String>();
        List<Integer> colors = new ArrayList<Integer>();
        for (int i = 0; i < Ticker.SYMS.length; i++) {
            double c = Ticker.change(i);
            parts.add(Ticker.SYMS[i] + " $" + Ticker.fmt(Ticker.price(i)) + " " + (c >= 0 ? "+" : "-") + String.format("%.2f%%", Math.abs(c)) + "    ");
            colors.add(c >= 0 ? 0xFF00FF9D : 0xFFFF2E55);
        }
        parts.add("SIMULATED - NOT FINANCIAL ADVICE    ");
        colors.add(Theme.accent());
        int total = 0;
        for (String p : parts) total += R2D.width(p);
        int bw = 220, bx = sw / 2 - bw / 2, y = 23;
        R2D.rect(bx, y - 1, bx + bw, y + 10, 0x90000000);
        net.minecraft.client.util.Window win = new Window(MinecraftClient.getInstance());
        int sf = win.getScaleFactor();
        org.lwjgl.opengl.GL11.glEnable(org.lwjgl.opengl.GL11.GL_SCISSOR_TEST);
        org.lwjgl.opengl.GL11.glScissor(bx * sf, MinecraftClient.getInstance().height - (y + 10) * sf, bw * sf, 11 * sf);
        int off = (int) ((System.currentTimeMillis() / 25) % total);
        for (int rep = 0; rep < 2 + bw / Math.max(1, total); rep++) {
            int x = bx + rep * total - off;
            for (int i = 0; i < parts.size(); i++) {
                if (x < bx + bw && x + R2D.width(parts.get(i)) > bx) R2D.text(parts.get(i), x, y, colors.get(i));
                x += R2D.width(parts.get(i));
            }
        }
        org.lwjgl.opengl.GL11.glDisable(org.lwjgl.opengl.GL11.GL_SCISSOR_TEST);
    }

    private static void crosshair(int sw, int sh, float g) {
        float cx = sw / 2f, cy = sh / 2f;
        int c = 0xFFFFFFFF;
        int glowC = Theme.accent();
        String st = Modules.CROSSHAIR_STYLE.get();
        float gap = 2 + (Cps.leftDown() ? 1.5f : 0);
        if (st.equals("circle")) {
            R2D.ring(cx, cy, 3.2, 5.5, Theme.alpha(glowC, (int) (60 * g)), Theme.alpha(glowC, 0));
            R2D.ring(cx, cy, 3, 4, c, c);
        } else if (st.equals("diamond")) {
            R2D.line(cx, cy - 4, cx + 4, cy, 2, c); R2D.line(cx + 4, cy, cx, cy + 4, 2, c);
            R2D.line(cx, cy + 4, cx - 4, cy, 2, c); R2D.line(cx - 4, cy, cx, cy - 4, 2, c);
        } else {
            R2D.glow(cx - 0.5f, cy - 0.5f, cx + 0.5f, cy + 0.5f, glowC, g * 1.2f);
            R2D.rect(cx - 0.5f, cy - 5 - gap, cx + 0.5f, cy - gap, c);
            R2D.rect(cx - 0.5f, cy + gap, cx + 0.5f, cy + 5 + gap, c);
            R2D.rect(cx - 5 - gap, cy - 0.5f, cx - gap, cy + 0.5f, c);
            R2D.rect(cx + gap, cy - 0.5f, cx + 5 + gap, cy + 0.5f, c);
            if (st.equals("cross-dot")) R2D.rect(cx - 0.5f, cy - 0.5f, cx + 0.5f, cy + 0.5f, glowC);
        }
    }

    private Hud() {}
}
