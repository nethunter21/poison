package gg.poison.client.hud;

import gg.poison.client.module.Category;
import gg.poison.client.module.Module;
import gg.poison.client.module.Modules;
import gg.poison.client.music.MusicPlayer;
import gg.poison.client.util.Colors;
import gg.poison.client.util.Cps;
import gg.poison.client.util.Ticker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** POISON in-game HUD. */
public final class Hud {
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    public static void render(DrawContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) return;
        TextRenderer tr = mc.textRenderer;
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        float beat = Modules.BEAT_SYNC.on() ? MusicPlayer.level() : 0f;

        int y = 4;
        if (Modules.WATERMARK.on()) {
            int glow = Colors.alpha(Colors.ACCENT, (int) (60 + beat * 150));
            ctx.fill(3, 3, 8 + tr.getWidth("☠ POISON") + tr.getWidth(" b1.4.2") + 4, 16, 0x90000000);
            ctx.fill(3, 15, 8 + tr.getWidth("☠ POISON") + tr.getWidth(" b1.4.2") + 4, 16, glow);
            String w = "☠ POISON";
            int x = 6;
            for (int i = 0; i < w.length(); i++) {
                String ch = String.valueOf(w.charAt(i));
                ctx.drawTextWithShadow(tr, Text.literal(ch), x, 5, Colors.lerp(Colors.ACCENT, Colors.ACCENT2, (float) (Math.sin(System.currentTimeMillis() / 400.0 + i * 0.5) * 0.5 + 0.5)));
                x += tr.getWidth(ch);
            }
            ctx.drawTextWithShadow(tr, Text.literal(" b1.4.2"), x, 5, 0xFFBBBBBB);
            y = 20;
        }

        // info pills
        List<String[]> pills = new ArrayList<>();
        if (Modules.FPS.on()) pills.add(new String[] { "FPS", String.valueOf(mc.getCurrentFps()) });
        if (Modules.CPS.on()) pills.add(new String[] { "CPS", Cps.left() + " | " + Cps.right() });
        if (Modules.PING.on()) {
            PlayerListEntry e = mc.getNetworkHandler() != null ? mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()) : null;
            int ping = e != null ? e.getLatency() : 0;
            pills.add(new String[] { "PING", ping + "ms" + (Modules.GAS_METER.on() ? "  ⛽ " + ping * 3 + " gwei" : "") });
        }
        if (Modules.COORDS.on()) {
            String facing = mc.player.getHorizontalFacing().asString();
            pills.add(new String[] { "XYZ", String.format("%.1f / %.1f / %.1f  %s", mc.player.getX(), mc.player.getY(), mc.player.getZ(), facing) });
        }
        if (Modules.CLOCK.on()) pills.add(new String[] { "TIME", LocalTime.now().format(CLOCK) });
        for (String[] p : pills) {
            int w = tr.getWidth(p[0]) + tr.getWidth(p[1]) + 12;
            ctx.fill(3, y, 3 + w, y + 12, 0x80000000);
            ctx.fill(3, y, 4, y + 12, Colors.ACCENT);
            ctx.drawTextWithShadow(tr, Text.literal(p[0]), 7, y + 2, Colors.ACCENT);
            ctx.drawTextWithShadow(tr, Text.literal(p[1]), 10 + tr.getWidth(p[0]), y + 2, Colors.TEXT);
            y += 14;
        }

        if (Modules.ARRAYLIST.on()) arrayList(ctx, tr, sw);
        if (Modules.KEYSTROKES.on()) keystrokes(ctx, tr, mc, 4, sh - 92);
        if (Modules.ARMOR.on()) armor(ctx, tr, mc, sw, sh);
        if (Modules.NOW_PLAYING.on() && MusicPlayer.current() != null) nowPlaying(ctx, tr, sw, beat);
        if (Modules.TICKER.on()) ticker(ctx, tr, sw, sh);
        Notifications.render(ctx);
    }

    private static void arrayList(DrawContext ctx, TextRenderer tr, int sw) {
        List<Module> on = new ArrayList<>();
        for (Module m : Modules.ALL) if (m.on() && m.category != Category.HUD && m.category != Category.UTIL) on.add(m);
        on.sort(Comparator.comparingInt((Module m) -> tr.getWidth(m.name)).reversed());
        int y = 2;
        for (int i = 0; i < on.size(); i++) {
            Module m = on.get(i);
            int w = tr.getWidth(m.name);
            int color = Modules.ARRAY_COLOR.is("accent") ? Colors.ACCENT : Modules.ARRAY_COLOR.is("rainbow") ? Colors.wave(0, 2f) : Colors.wave(i, 1f);
            if (Modules.ARRAY_BG.get()) ctx.fill(sw - w - 6, y, sw, y + 11, 0x90000000);
            ctx.fill(sw - 2, y, sw, y + 11, color);
            ctx.drawTextWithShadow(tr, Text.literal(m.name), sw - w - 4, y + 2, color);
            y += 11;
        }
    }

    private static void key(DrawContext ctx, TextRenderer tr, int x, int y, int w, int h, String label, boolean down) {
        ctx.fill(x, y, x + w, y + h, down ? Colors.alpha(Colors.ACCENT, 220) : 0x80000000);
        if (down) ctx.drawBorder(x - 1, y - 1, w + 2, h + 2, Colors.alpha(Colors.ACCENT, 120));
        String[] lines = label.split("\n");
        int ty = y + h / 2 - lines.length * 5 + 1;
        for (String l : lines) { ctx.drawCenteredTextWithShadow(tr, Text.literal(l), x + w / 2, ty, down ? 0xFF140600 : Colors.TEXT); ty += 9; }
    }

    private static void keystrokes(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int x, int y) {
        KeyBinding[] k = { mc.options.forwardKey, mc.options.leftKey, mc.options.backKey, mc.options.rightKey, mc.options.jumpKey };
        int s = 20, g = 2;
        key(ctx, tr, x + s + g, y, s, s, "W", k[0].isPressed());
        key(ctx, tr, x, y + s + g, s, s, "A", k[1].isPressed());
        key(ctx, tr, x + s + g, y + s + g, s, s, "S", k[2].isPressed());
        key(ctx, tr, x + 2 * (s + g), y + s + g, s, s, "D", k[3].isPressed());
        int bw = (3 * s + 2 * g - g) / 2;
        key(ctx, tr, x, y + 2 * (s + g), bw, s, "LMB\n" + Cps.left(), Cps.leftDown);
        key(ctx, tr, x + bw + g, y + 2 * (s + g), bw, s, "RMB\n" + Cps.right(), Cps.rightDown);
        key(ctx, tr, x, y + 3 * (s + g), 3 * s + 2 * g, 10, "▬▬", k[4].isPressed());
    }

    private static void armor(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int sw, int sh) {
        EquipmentSlot[] slots = { EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND };
        int y = sh - 100;
        for (EquipmentSlot slot : slots) {
            ItemStack st = mc.player.getEquippedStack(slot);
            if (st.isEmpty()) continue;
            int x = sw - 22;
            ctx.drawItem(st, x, y);
            if (st.isDamageable()) {
                int pct = Math.round((st.getMaxDamage() - st.getDamage()) * 100f / st.getMaxDamage());
                String t = pct + "%";
                int color = pct > 50 ? 0xFF00FF9D : pct > 20 ? 0xFFFFD23F : 0xFFFF2E55;
                ctx.drawTextWithShadow(tr, Text.literal(t), x - tr.getWidth(t) - 3, y + 4, color);
            }
            y += 17;
        }
    }

    private static void nowPlaying(DrawContext ctx, TextRenderer tr, int sw, float beat) {
        String t = "♫ " + MusicPlayer.current();
        int w = Math.max(tr.getWidth(t) + 40, 120);
        int x = sw / 2 - w / 2, y = 4;
        ctx.fill(x, y, x + w, y + 16, 0xA0000000);
        ctx.drawBorder(x, y, w, 16, Colors.alpha(Colors.ACCENT, (int) (90 + beat * 160)));
        ctx.drawTextWithShadow(tr, Text.literal(t), x + 6, y + 4, MusicPlayer.isPaused() ? Colors.MUTED : Colors.TEXT);
        float[] bands = MusicPlayer.bands();
        for (int i = 0; i < 6; i++) {
            int h = 2 + (int) (MathHelper.clamp(bands[i], 0, 1) * 10);
            ctx.fill(x + w - 30 + i * 4, y + 13 - h, x + w - 28 + i * 4, y + 13, Colors.ACCENT);
        }
    }

    private static void ticker(DrawContext ctx, TextRenderer tr, int sw, int sh) {
        Ticker.tick();
        StringBuilder sb = new StringBuilder();
        List<int[]> colors = new ArrayList<>();
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < Ticker.SYMS.length; i++) {
            double c = Ticker.change(i);
            parts.add(Ticker.SYMS[i] + " $" + Ticker.fmt(Ticker.price(i)) + " " + (c >= 0 ? "▲" : "▼") + String.format("%.2f%%", Math.abs(c)) + "    ");
            colors.add(new int[] { c >= 0 ? 0xFF00FF9D : 0xFFFF2E55 });
        }
        parts.add("SIMULATED · NOT FINANCIAL ADVICE    ");
        colors.add(new int[] { Colors.alpha(Colors.ACCENT, 200) });
        int total = 0;
        for (String p : parts) total += tr.getWidth(p);
        // clipped strip under the now-playing widget, clear of the hotbar and side HUDs
        int bw = 220, bx = sw / 2 - bw / 2, y = 23;
        ctx.fill(bx, y - 1, bx + bw, y + 10, 0x90000000);
        ctx.enableScissor(bx, y - 1, bx + bw, y + 10);
        int off = (int) ((System.currentTimeMillis() / 25) % total);
        for (int rep = 0; rep < 2 + bw / Math.max(1, total); rep++) {
            int x = bx + rep * total - off;
            for (int i = 0; i < parts.size(); i++) {
                if (x < bx + bw && x + tr.getWidth(parts.get(i)) > bx) ctx.drawTextWithShadow(tr, Text.literal(parts.get(i)), x, y, colors.get(i)[0]);
                x += tr.getWidth(parts.get(i));
            }
        }
        ctx.disableScissor();
        sb.setLength(0);
    }

    private Hud() {}
}
