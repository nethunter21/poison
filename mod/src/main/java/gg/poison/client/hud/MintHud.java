package gg.poison.client.hud;

import gg.poison.client.module.Module;
import gg.poison.client.module.Modules;
import gg.poison.client.music.MusicPlayer;
import gg.poison.client.render.G2D;
import gg.poison.client.util.Colors;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.util.InputUtil;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.util.math.RotationAxis;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * "Mint" HUD layout: black rounded pills with smooth Inter text and mint accents —
 * info bar, synced lyrics pill, music card with spinning vinyl, keybinds panel and a
 * slim custom hotbar.
 */
public final class MintHud {
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
    private static final int PANEL = 0xE6080808, PANEL_SOFT = 0xCC0B0B0B, WHITE = 0xFFFFFFFF, GRAY = 0xFF9A9A9A;
    private static float vinyl;
    private static long lastNs = System.nanoTime();

    // TPS estimate from how fast the server advances world time
    private static long tpsWorld = -1, tpsAt;
    private static float tps = 20;

    public static void tickTps(MinecraftClient mc) {
        if (mc.world == null) { tpsWorld = -1; return; }
        long now = System.currentTimeMillis(), wt = mc.world.getTime();
        if (tpsWorld < 0) { tpsWorld = wt; tpsAt = now; return; }
        if (now - tpsAt >= 2000) {
            float measured = (wt - tpsWorld) / ((now - tpsAt) / 1000f);
            tps = Math.max(0, Math.min(20, tps * 0.5f + measured * 0.5f));
            tpsWorld = wt; tpsAt = now;
        }
    }

    public static void render(DrawContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        long ns = System.nanoTime();
        float dt = Math.min(0.1f, (ns - lastNs) / 1e9f);
        lastNs = ns;
        float g = Colors.glow();
        int y = 4;
        if (Modules.INFO_BAR.on()) y = infoBar(ctx, mc, sw, y, g) + 4;
        if (Modules.LYRICS.on() && MusicPlayer.current() != null && !MusicPlayer.isPaused()) y = lyricsPill(ctx, sw, y) + 4;
        if (Modules.MUSIC_CARD.on() && MusicPlayer.current() != null) musicCard(ctx, sw, y, dt);
        if (Modules.KEYBINDS_HUD.on()) keybinds(ctx, 4, (int) (sh * 0.36f), g);
    }

    // ------------------------------------------------------------------ top bar
    private static int infoBar(DrawContext ctx, MinecraftClient mc, int sw, int y, float g) {
        PlayerListEntry e = mc.getNetworkHandler() != null && mc.player != null ? mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()) : null;
        String server = mc.getCurrentServerEntry() != null ? mc.getCurrentServerEntry().address : "singleplayer";
        String[][] items = {
            { "wifi", (e != null ? e.getLatency() : 0) + " ms" },
            { "cloud", server },
            { "gauge", Math.round(tps) + " TPS" },
            { "user", mc.player != null ? mc.player.getName().getString() : "" },
            { "clock", LocalTime.now().format(CLOCK) },
        };
        int ic = 7, gap = 2, sep = 7, h = 13;
        int w = 8 + ic + sep;
        for (String[] it : items) w += ic + gap + G2D.fw(it[1], true) + sep;
        w = w - sep + 6;
        int x = sw / 2 - w / 2;
        G2D.roundGlow(ctx, x, y, x + w, y + h, h / 2f, Colors.accent(), g * 0.35f);
        G2D.pill(ctx, x, y, x + w, y + h, PANEL);
        int cx = x + 6;
        G2D.icon(ctx, "logo", cx, y + 3, ic, Colors.accent());
        cx += ic + sep;
        for (String[] it : items) {
            G2D.icon(ctx, it[0], cx, y + 3, ic, Colors.accent());
            cx += ic + gap;
            G2D.ft(ctx, it[1], cx, y + 3, WHITE, true);
            cx += G2D.fw(it[1], true) + sep;
        }
        return y + h;
    }

    // ------------------------------------------------------------------ lyrics
    private static int lyricsPill(DrawContext ctx, int sw, int y) {
        MusicPlayer.Lyric l = MusicPlayer.lyric();
        String text = l != null ? l.text() : MusicPlayer.current() + "  ·  " + MusicPlayer.artist();
        int h = 13, w = G2D.fw(text, true) + 24;
        int x = sw / 2 - w / 2;
        G2D.pill(ctx, x, y, x + w, y + h, PANEL);
        // equaliser icon bars react to the music
        float[] b = MusicPlayer.bands();
        for (int i = 0; i < 4; i++) {
            float bh = 2 + Math.min(1, b[i]) * 6;
            G2D.round(ctx, x + 6 + i * 2.2f, y + 10 - bh, x + 7.4f + i * 2.2f, y + 10, 0.6f, Colors.accent());
        }
        G2D.ft(ctx, text, x + 18, y + 3, WHITE, true);
        return y + h;
    }

    // ------------------------------------------------------------------ music card
    private static String time(double s) { int t = (int) Math.max(0, s); return (t / 60) + ":" + String.format("%02d", t % 60); }

    private static void musicCard(DrawContext ctx, int sw, int y, float dt) {
        int w = 152, h = 46, x = sw / 2 - w / 2;
        G2D.round(ctx, x, y, x + w, y + h, 6, PANEL);
        // spinning vinyl
        if (!MusicPlayer.isPaused()) vinyl += dt * 140;
        var m = ctx.getMatrices();
        m.push();
        m.translate(x + 4 + 19, y + 4 + 19, 0);
        m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(vinyl % 360));
        G2D.icon(ctx, "vinyl", -19, -19, 38, 0xFFFFFFFF);
        m.pop();
        int tx = x + 48;
        String title = MusicPlayer.current();
        String artist = MusicPlayer.artist();
        G2D.ft(ctx, clip(title, w - 54, true), tx, y + 5, WHITE, true);
        G2D.ft(ctx, artist, tx, y + 14, GRAY, false);
        // controls
        int cy = y + 23, mid = tx + (w - 54) / 2;
        G2D.icon(ctx, "prev", mid - 18, cy + 2, 7, 0xFFCFCFCF);
        G2D.round(ctx, mid - 5, cy, mid + 6, cy + 11, 2.5f, Colors.alpha(Colors.accent(), 70));
        G2D.icon(ctx, MusicPlayer.isPaused() ? "play" : "pause", mid - 3, cy + 2, 7, Colors.accent());
        G2D.icon(ctx, "next", mid + 12, cy + 2, 7, 0xFFCFCFCF);
        // progress
        double pos = MusicPlayer.position(), dur = MusicPlayer.duration();
        int py = y + 38;
        var mm = ctx.getMatrices();
        mm.push();
        mm.translate(tx, py - 2, 0);
        mm.scale(0.7f, 0.7f, 1);
        G2D.ft(ctx, time(pos), 0, 0, GRAY, false);
        String total = dur > 0 ? time(dur) : "--:--";
        G2D.ft(ctx, total, (int) ((w - 54) / 0.7f) - G2D.fw(total, false), 0, GRAY, false);
        mm.pop();
        int bx1 = tx + 16, bx2 = x + w - 22;
        G2D.pill(ctx, bx1, py, bx2, py + 2, 0x40FFFFFF);
        float f = dur > 0 ? (float) Math.min(1, pos / dur) : 0;
        if (f > 0) G2D.pill(ctx, bx1, py, bx1 + (bx2 - bx1) * f, py + 2, Colors.accent());
    }

    private static String clip(String s, int maxW, boolean bold) {
        if (G2D.fw(s, bold) <= maxW) return s;
        while (s.length() > 1 && G2D.fw(s + "…", bold) > maxW) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    // ------------------------------------------------------------------ keybinds
    private static void keybinds(DrawContext ctx, int x, int y, float g) {
        List<Module> bound = new ArrayList<>();
        for (Module m : Modules.ALL) if (m.key >= 0) bound.add(m);
        int h = 12;
        int hw = G2D.fw("Keybinds", true) + 24;
        G2D.pill(ctx, x, y, x + hw, y + h, PANEL);
        G2D.ft(ctx, "Keybinds", x + 6, y + 2, WHITE, true);
        G2D.round(ctx, x + hw - 14, y + 2, x + hw - 4, y + 10, 2, Colors.alpha(Colors.accent(), 60));
        G2D.icon(ctx, "keyboard", x + hw - 13, y + 2, 8, Colors.accent());
        y += h + 3;
        for (Module m : bound) {
            String key = keyName(m.key);
            int nw = G2D.fw(m.name, false) + 12;
            if (m.on()) G2D.roundGlow(ctx, x, y, x + nw, y + h, h / 2f, Colors.accent(), g * 0.25f);
            G2D.pill(ctx, x, y, x + nw, y + h, PANEL);
            G2D.ft(ctx, m.name, x + 6, y + 2, m.on() ? WHITE : GRAY, false);
            int kx = x + nw + 2, kw = Math.max(h, G2D.fw(key, true) + 8);
            G2D.pill(ctx, kx, y, kx + kw, y + h, PANEL);
            G2D.ft(ctx, key, kx + kw / 2 - G2D.fw(key, true) / 2, y + 2, m.on() ? Colors.accent() : WHITE, true);
            y += h + 2;
        }
    }

    public static String keyName(int key) {
        String s = InputUtil.fromKeyCode(key, 0).getLocalizedText().getString();
        return s.length() > 6 ? s.substring(0, 6) : s.toUpperCase();
    }

    // ------------------------------------------------------------------ hotbar
    public static void hotbar(DrawContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        PlayerEntity p = mc.player;
        if (p == null || mc.interactionManager == null || p.isSpectator()) return;
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        int slot = 20, gap = 1, pad = 2;
        int w = 9 * slot + 8 * gap + pad * 2, h = slot + pad * 2;
        int x = sw / 2 - w / 2, y = sh - h - 3;
        var tr = mc.textRenderer;

        // main bar
        G2D.round(ctx, x, y, x + w, y + h, 5, PANEL_SOFT);
        int sel = p.getInventory().selectedSlot;
        for (int i = 0; i < 9; i++) {
            int sx = x + pad + i * (slot + gap), sy = y + pad;
            if (i == sel) {
                G2D.roundGlow(ctx, sx, sy, sx + slot, sy + slot, 4, Colors.accent(), 0.6f);
                G2D.round(ctx, sx, sy, sx + slot, sy + slot, 4, Colors.accent());
                G2D.round(ctx, sx + 1, sy + 1, sx + slot - 1, sy + slot - 1, 3.5f, 0xFF15201B);
            } else G2D.round(ctx, sx, sy, sx + slot, sy + slot, 4, 0x55141414);
            ItemStack st = p.getInventory().getStack(i);
            if (!st.isEmpty()) { ctx.drawItem(st, sx + 2, sy + 2); ctx.drawStackOverlay(tr, st, sx + 2, sy + 2); }
        }
        // offhand box
        ItemStack off = p.getOffHandStack();
        int ox = x - h - 4;
        G2D.round(ctx, ox, y, ox + h, y + h, 5, PANEL_SOFT);
        if (!off.isEmpty()) { ctx.drawItem(off, ox + 4, y + 4); ctx.drawStackOverlay(tr, off, ox + 4, y + 4); }
        // armor box
        EquipmentSlot[] armor = { EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET };
        int ax = x + w + 4, aw = 4 * slot + 3 * gap + pad * 2;
        G2D.round(ctx, ax, y, ax + aw, y + h, 5, PANEL_SOFT);
        for (int i = 0; i < 4; i++) {
            ItemStack st = p.getEquippedStack(armor[i]);
            int sx = ax + pad + i * (slot + gap);
            if (st.isEmpty()) continue;
            ctx.drawItem(st, sx + 2, y + pad + 1);
            if (st.isDamageable()) {
                float f = 1f - st.getDamage() / (float) st.getMaxDamage();
                G2D.pill(ctx, sx + 3, y + h - 4, sx + slot - 3, y + h - 3, 0x40FFFFFF);
                G2D.pill(ctx, sx + 3, y + h - 4, sx + 3 + (slot - 6) * f, y + h - 3, f > 0.25f ? Colors.accent() : 0xFFFF3B5C);
            }
        }
        // health + hunger bars
        int by = y - 10, half = (w - 4) / 2;
        float hp = p.getHealth(), max = Math.max(1, p.getMaxHealth()), abs = p.getAbsorptionAmount();
        bar(ctx, x, by, x + half, by + 8, hp / max, 0xFFEC2F5B, abs > 0 ? Math.min(1, abs / max) : 0, (int) Math.ceil(hp + abs) + "");
        int food = p.getHungerManager().getFoodLevel();
        bar(ctx, x + half + 4, by, x + w, by + 8, food / 20f, 0xFFE9A13A, 0, food + "");
        if (p.getAir() < p.getMaxAir()) bar(ctx, x + half + 4, by - 6, x + w, by - 3, Math.max(0, p.getAir()) / (float) p.getMaxAir(), 0xFF5BC0FF, 0, null);

        if (Modules.HOTBAR_INV.get()) inventoryPreview(ctx, p, 3, sh - 3 * 13 - 5);
    }

    private static void bar(DrawContext ctx, float x1, float y1, float x2, float y2, float f, int color, float extra, String label) {
        float r = (y2 - y1) / 2f;
        G2D.round(ctx, x1, y1, x2, y2, r, 0xB0000000);
        float fx = x1 + (x2 - x1) * Math.max(0, Math.min(1, f));
        if (fx > x1 + 1) G2D.round(ctx, x1, y1, fx, y2, r, color);
        if (extra > 0) G2D.round(ctx, x1, y1, x1 + (x2 - x1) * extra, y1 + 2, 1, 0xFFFFD84D);
        if (label != null) {
            var m = ctx.getMatrices();
            m.push();
            m.translate((x1 + x2) / 2f, y1 + 1.6f, 0);
            m.scale(0.62f, 0.62f, 1);
            G2D.ft(ctx, label, -G2D.fw(label, true) / 2, 0, WHITE, true);
            m.pop();
        }
    }

    private static void inventoryPreview(DrawContext ctx, PlayerEntity p, int x, int y) {
        int s = 13;
        G2D.round(ctx, x - 2, y - 2, x + 9 * s + 1, y + 3 * s + 1, 4, PANEL_SOFT);
        var m = ctx.getMatrices();
        for (int row = 0; row < 3; row++) for (int col = 0; col < 9; col++) {
            ItemStack st = p.getInventory().getStack(9 + row * 9 + col);
            if (st.isEmpty()) continue;
            m.push();
            m.translate(x + col * s, y + row * s, 0);
            m.scale(0.72f, 0.72f, 1);
            ctx.drawItem(st, 1, 1);
            ctx.drawStackOverlay(MinecraftClient.getInstance().textRenderer, st, 1, 1);
            m.pop();
        }
    }

    private MintHud() {}
}
