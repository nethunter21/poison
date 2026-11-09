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

    public static void render(DrawContext ctx) {
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
