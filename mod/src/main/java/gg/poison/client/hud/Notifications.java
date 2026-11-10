package gg.poison.client.hud;

import gg.poison.client.module.Module;
import gg.poison.client.module.Modules;
import gg.poison.client.util.Colors;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** Slide-in toasts (bottom right). */
public final class Notifications {
    private record Toast(String title, String body, int color, long t) {}
    private static final List<Toast> TOASTS = new ArrayList<>();

    public static void push(String title, String body, int color) {
        synchronized (TOASTS) {
            TOASTS.add(new Toast(title, body, color, System.currentTimeMillis()));
            if (TOASTS.size() > 5) TOASTS.remove(0);
        }
    }

    public static void module(Module m) {
        if (Modules.NOTIFS.on()) push(m.name, m.on() ? "enabled" : "disabled", m.on() ? 0xFF00FF9D : 0xFFA3958A);
    }

    /** Mint layout: small black pills stacked above the hotbar, e.g. "Motion Blur enabled ●". */
    private static void renderPills(DrawContext ctx) {
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        long now = System.currentTimeMillis();
        int y = sh - (Modules.CUSTOM_HOTBAR.on() ? 58 : 62);
        synchronized (TOASTS) {
            for (Iterator<Toast> it = TOASTS.iterator(); it.hasNext(); ) if (now - it.next().t > 2200) it.remove();
            for (int i = TOASTS.size() - 1; i >= 0; i--) {
                Toast t = TOASTS.get(i);
                float age = (now - t.t) / 1000f;
                float a = Math.min(1, age / 0.15f) * Math.min(1, (2.2f - age) / 0.3f);
                String msg = t.title.equals("POISON FM") || t.title.startsWith("☠") || t.title.equals("HODL") ? t.body : t.title + " " + t.body;
                int w = gg.poison.client.render.G2D.fw(msg, false) + 22, h = 12;
                int x = sw / 2 - w / 2;
                int yy = (int) (y + (1 - Math.min(1, age / 0.15f)) * 6);
                gg.poison.client.render.G2D.pill(ctx, x, yy, x + w, yy + h, Colors.alpha(0x080808, (int) (225 * a)));
                gg.poison.client.render.G2D.ft(ctx, msg, x + 6, yy + 2, Colors.alpha(0xFFFFFF, (int) (255 * a)), false);
                boolean on = !t.body.equals("disabled");
                int dot = on ? Colors.alpha(Colors.accent(), (int) (255 * a)) : Colors.alpha(0x8A8A8A, (int) (255 * a));
                gg.poison.client.render.G2D.round(ctx, x + w - 12, yy + 3, x + w - 6, yy + 9, 3, dot);
                if (!on) gg.poison.client.render.G2D.round(ctx, x + w - 11, yy + 4, x + w - 7, yy + 8, 2, Colors.alpha(0x080808, (int) (225 * a)));
                y -= h + 3;
            }
        }
    }

    public static void render(DrawContext ctx) {
        if (Modules.HUD_LAYOUT.is("mint")) { renderPills(ctx); return; }
        MinecraftClient mc = MinecraftClient.getInstance();
        TextRenderer tr = mc.textRenderer;
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        long now = System.currentTimeMillis();
        int y = sh - 40;
        synchronized (TOASTS) {
            for (Iterator<Toast> it = TOASTS.iterator(); it.hasNext(); ) if (now - it.next().t > 3000) it.remove();
            for (int i = TOASTS.size() - 1; i >= 0; i--) {
                Toast t = TOASTS.get(i);
                float age = (now - t.t) / 1000f;
                float in = Math.min(1, age / 0.25f), out = Math.max(0, (age - 2.6f) / 0.4f);
                float slide = (1 - (1 - (float) Math.pow(1 - in, 3))) + out;
                int w = Math.max(tr.getWidth(t.title), tr.getWidth(t.body)) + 24;
                int x = sw - w - 6 + (int) (slide * (w + 10));
                ctx.fill(x, y, x + w, y + 24, 0xE0140C1C);
                ctx.fill(x, y, x + 2, y + 24, t.color);
                ctx.fill(x, y + 23, x + (int) (w * (1 - Math.min(1, age / 3f))), y + 24, Colors.alpha(t.color, 200));
                ctx.drawTextWithShadow(tr, Text.literal(t.title), x + 8, y + 3, Colors.TEXT);
                ctx.drawTextWithShadow(tr, Text.literal(t.body), x + 8, y + 13, t.color);
                y -= 28;
            }
        }
    }

    private Notifications() {}
}
