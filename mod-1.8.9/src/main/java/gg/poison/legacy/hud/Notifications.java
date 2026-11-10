package gg.poison.legacy.hud;

import gg.poison.legacy.module.Module;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.render.R2D;
import gg.poison.legacy.util.Theme;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** Slide-in glowing toasts (bottom right). */
public final class Notifications {
    private static final class Toast {
        final String title, body; final int color; final long t;
        Toast(String title, String body, int color) { this.title = title; this.body = body; this.color = color; this.t = System.currentTimeMillis(); }
    }
    private static final List<Toast> TOASTS = new ArrayList<Toast>();

    public static void push(String title, String body, int color) {
        synchronized (TOASTS) {
            TOASTS.add(new Toast(title, body, color));
            if (TOASTS.size() > 5) TOASTS.remove(0);
        }
    }

    public static void module(Module m) {
        if (Modules.NOTIFS.on()) push(m.name, m.on() ? "enabled" : "disabled", m.on() ? 0xFF00FF9D : 0xFFA3958A);
    }

    public static void render(int sw, int sh, float g) {
        long now = System.currentTimeMillis();
        int y = sh - 40;
        synchronized (TOASTS) {
            for (Iterator<Toast> it = TOASTS.iterator(); it.hasNext(); ) if (now - it.next().t > 3000) it.remove();
            for (int i = TOASTS.size() - 1; i >= 0; i--) {
                Toast t = TOASTS.get(i);
                float age = (now - t.t) / 1000f;
                float in = Math.min(1, age / 0.25f), out = Math.max(0, (age - 2.6f) / 0.4f);
                float slide = (float) Math.pow(1 - in, 3) + out;
                int w = Math.max(R2D.width(t.title), R2D.width(t.body)) + 24;
                float x = sw - w - 6 + slide * (w + 10);
                R2D.glow(x, y, x + w, y + 24, t.color, g * 0.6f);
                R2D.rect(x, y, x + w, y + 24, Theme.BG);
                R2D.rect(x, y, x + 2, y + 24, t.color);
                R2D.rect(x, y + 23, x + w * (1 - Math.min(1, age / 3f)), y + 24, t.color);
                R2D.text(t.title, x + 8, y + 3, Theme.TEXT);
                R2D.text(t.body, x + 8, y + 13, t.color);
                y -= 30;
            }
        }
    }

    private Notifications() {}
}
