package gg.poison.legacy.gui;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.config.ConfigManager;
import gg.poison.legacy.hud.Notifications;
import gg.poison.legacy.module.Category;
import gg.poison.legacy.module.Module;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.module.Setting;
import gg.poison.legacy.music.MusicPlayer;
import gg.poison.legacy.render.R2D;
import gg.poison.legacy.util.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.util.Window;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** POISON client menu for 1.8.9 (Right Shift): glowing draggable category panels. */
public class ClickGui extends Screen {
    private static final int W = 124, HEADER = 16, ROW = 13, SET_ROW = 12, SLIDER_ROW = 19;
    private static final Set<String> EXPANDED = new HashSet<String>();

    private final List<Panel> panels = new ArrayList<Panel>();
    private final long openedAt = System.currentTimeMillis();
    private String search = "";
    private Panel dragging;
    private int dragDX, dragDY;
    private Setting.Num slider;
    private int sliderX;
    private String tooltip;

    private static final class Panel {
        final Category cat; int x, y; boolean collapsed;
        Panel(Category c, int x, int y) { cat = c; this.x = x; this.y = y; }
    }

    public ClickGui() {
        for (Category c : Category.values()) {
            int[] s = ConfigManager.PANELS.get(c.name());
            Panel p = new Panel(c, s != null ? s[0] : -1, s != null ? s[1] : -1);
            if (s != null) p.collapsed = s[2] == 1;
            panels.add(p);
        }
    }

    /** Draw at a fixed effective GUI scale of 2. */
    private float k() { return 2f / new Window(MinecraftClient.getInstance()).getScaleFactor(); }
    private int vw() { return (int) (width / k()); }
    private int vh() { return (int) (height / k()); }

    @Override
    public void init() {
        Keyboard.enableRepeatEvents(true);
        int cols = Math.max(1, (vw() - 12) / (W + 8));
        int x = 10, y = 30, col = 0, rowH = 0;
        for (Panel p : panels) {
            if (p.x >= 0 && p.x < vw() - 20 && p.y >= 0 && p.y < vh() - 10) continue;
            if (col == cols) { col = 0; x = 10; y += rowH + 10; rowH = 0; }
            p.x = x; p.y = y;
            rowH = Math.max(rowH, height(p));
            x += W + 8; col++;
        }
    }

    @Override public boolean shouldPauseGame() { return false; }

    private List<Module> visible(Category c) {
        List<Module> out = new ArrayList<Module>();
        String q = search.toLowerCase();
        for (Module m : Modules.ALL) if (m.category == c && (q.isEmpty() || m.name.toLowerCase().contains(q))) out.add(m);
        return out;
    }
    private int rowH(Setting<?> s) { return s instanceof Setting.Num ? SLIDER_ROW : SET_ROW; }
    private int height(Panel p) {
        if (p.collapsed) return HEADER;
        int h = HEADER;
        for (Module m : visible(p.cat)) { h += ROW; if (EXPANDED.contains(m.id)) for (Setting<?> s : m.settings) h += rowH(s); }
        return h + 2;
    }

    @Override
    public void render(int rawX, int rawY, float delta) {
        tooltip = null;
        float g = Theme.glow();
        float open = Math.min(1f, (System.currentTimeMillis() - openedAt) / 220f);
        float ease = 1 - (float) Math.pow(1 - open, 3);
        // themed backdrop
        R2D.vgrad(0, 0, width, height, Theme.alpha(0x140010, (int) (150 * ease)), Theme.alpha(Theme.accent(), (int) (60 * ease)));
        float k = k();
        int mx = (int) (rawX / k), my = (int) (rawY / k);
        GlStateManager.pushMatrix();
        GlStateManager.scale(k, k, 1);
        int vw = vw(), vh = vh();
        R2D.vgrad(0, 0, vw, 22, 0xE0140C1C, 0x00140C1C);
        float x = 10;
        String logo = "POISON";
        for (int i = 0; i < logo.length(); i++) {
            String ch = String.valueOf(logo.charAt(i));
            R2D.glowText(ch, x, 7, Theme.grad(i / 6f), g);
            x += R2D.width(ch);
        }
        R2D.text("client menu  |  1.8.9", x + 6, 7, Theme.MUTED);
        int sx = vw - 170;
        R2D.rect(sx, 4, sx + 160, 18, 0xA0000000);
        R2D.glow(sx, 4, sx + 160, 18, Theme.accent(), search.isEmpty() ? 0.2f : g);
        R2D.text(search.isEmpty() ? "type to search..." : search + (System.currentTimeMillis() / 400 % 2 == 0 ? "_" : ""), sx + 5, 7, search.isEmpty() ? Theme.MUTED : Theme.TEXT);

        GlStateManager.pushMatrix();
        GlStateManager.translate(0, (1 - ease) * 18, 0);
        for (Panel p : panels) drawPanel(p, mx, my, ease, g);
        GlStateManager.popMatrix();

        String hint = "Left-click toggle - Right-click settings - Drag headers - Right-click header collapse - Esc / RShift close";
        R2D.text(hint, vw / 2f - R2D.width(hint) / 2f, vh - 12, Theme.MUTED);
        if (MusicPlayer.current() != null) R2D.glowText("♫ " + MusicPlayer.current(), 10, vh - 24, Theme.accent(), g * 0.5f);
        if (tooltip != null && dragging == null && slider == null) {
            int tw = R2D.width(tooltip) + 8;
            int tx = Math.min(mx + 10, vw - tw - 2), ty = my + 10;
            R2D.glow(tx, ty, tx + tw, ty + 13, Theme.accent(), 0.5f);
            R2D.rect(tx, ty, tx + tw, ty + 13, 0xF0100A16);
            R2D.text(tooltip, tx + 4, ty + 3, Theme.TEXT);
        }
        GlStateManager.popMatrix();
    }

    private void drawPanel(Panel p, int mx, int my, float alpha, float g) {
        int h = height(p);
        R2D.glow(p.x, p.y, p.x + W, p.y + h, Theme.accent(), g * 0.8f * alpha);
        R2D.rect(p.x, p.y, p.x + W, p.y + h, Theme.alpha(0x0E0914, (int) (230 * alpha)));
        R2D.hgrad(p.x, p.y, p.x + W, p.y + HEADER, Theme.alpha(Theme.accent(), (int) (255 * alpha)), Theme.alpha(Theme.accent2(), (int) (255 * alpha)));
        R2D.text(p.cat.title.toUpperCase(), p.x + 5, p.y + 4, 0xFF140600);
        String count = String.valueOf(visible(p.cat).size());
        R2D.text(count, p.x + W - 5 - R2D.width(count), p.y + 4, 0xFF140600);
        if (p.collapsed) return;
        int y = p.y + HEADER;
        for (Module m : visible(p.cat)) {
            boolean hover = mx >= p.x && mx < p.x + W && my >= y && my < y + ROW;
            if (m.on()) {
                R2D.hgrad(p.x, y, p.x + W, y + ROW, Theme.alpha(Theme.accent(), 100), Theme.alpha(Theme.accent(), 10));
                R2D.rect(p.x, y, p.x + 2, y + ROW, Theme.accent());
                R2D.glowText(m.name, p.x + (hover ? 8 : 6), y + 3, Theme.TEXT, g * 0.4f);
            } else {
                if (hover) R2D.rect(p.x, y, p.x + W, y + ROW, 0x18FFFFFF);
                R2D.text(m.name, p.x + (hover ? 8 : 6), y + 3, Theme.MUTED);
            }
            if (!m.settings.isEmpty()) R2D.text(EXPANDED.contains(m.id) ? "-" : "...", p.x + W - 12, y + 2, Theme.MUTED);
            if (hover) tooltip = m.description;
            y += ROW;
            if (!EXPANDED.contains(m.id)) continue;
            for (Setting<?> s : m.settings) {
                int rh = rowH(s);
                R2D.rect(p.x, y, p.x + W, y + rh, 0x66000000);
                int tx = p.x + 8;
                R2D.text(s.label, tx, y + 2, 0xFFD9CBBD);
                if (s instanceof Setting.Bool) {
                    boolean v = ((Setting.Bool) s).get();
                    int swx = p.x + W - 20;
                    R2D.rect(swx, y + 2, swx + 14, y + 9, v ? Theme.accent() : 0x50FFFFFF);
                    if (v) R2D.glow(swx, y + 2, swx + 14, y + 9, Theme.accent(), g * 0.5f);
                    R2D.rect(v ? swx + 8 : swx + 1, y + 3, v ? swx + 13 : swx + 6, y + 8, 0xFFFFFFFF);
                } else if (s instanceof Setting.Num) {
                    Setting.Num n = (Setting.Num) s;
                    String v = n.display();
                    R2D.text(v, p.x + W - 6 - R2D.width(v), y + 2, Theme.accent());
                    int bx = tx, bw = W - 16, by = y + 13;
                    float frac = (float) ((n.get() - n.min) / (n.max - n.min));
                    R2D.rect(bx, by, bx + bw, by + 2, 0x40FFFFFF);
                    R2D.hgrad(bx, by, bx + bw * frac, by + 2, Theme.accent(), Theme.accent2());
                    R2D.glow(bx + bw * frac - 1, by - 1, bx + bw * frac + 1, by + 3, Theme.accent(), g * 0.6f);
                    R2D.rect(bx + bw * frac - 2, by - 2, bx + bw * frac + 2, by + 4, 0xFFFFFFFF);
                } else if (s instanceof Setting.Mode) {
                    String v = "< " + pretty(((Setting.Mode) s).get()) + " >";
                    R2D.text(v, p.x + W - 6 - R2D.width(v), y + 2, Theme.accent());
                } else if (s instanceof Setting.Color) {
                    R2D.rect(p.x + W - 20, y + 2, p.x + W - 6, y + 9, ((Setting.Color) s).get());
                }
                y += rh;
            }
        }
    }

    private static String pretty(String v) { return v.startsWith("knife_") ? v.substring(6) : v; }

    @Override
    protected void mouseClicked(int rawX, int rawY, int button) {
        int mx = (int) (rawX / k()), my = (int) (rawY / k());
        for (int i = panels.size() - 1; i >= 0; i--) {
            Panel p = panels.get(i);
            if (mx < p.x || mx >= p.x + W || my < p.y || my >= p.y + height(p)) continue;
            panels.remove(i);
            panels.add(p);
            if (my < p.y + HEADER) {
                if (button == 1) { p.collapsed = !p.collapsed; savePanels(); }
                else { dragging = p; dragDX = mx - p.x; dragDY = my - p.y; }
                return;
            }
            int y = p.y + HEADER;
            for (Module m : visible(p.cat)) {
                if (my >= y && my < y + ROW) {
                    if (button == 0) { m.toggle(); Notifications.module(m); ConfigManager.markDirty(); click(); }
                    else if (button == 1 && !m.settings.isEmpty()) { if (!EXPANDED.remove(m.id)) EXPANDED.add(m.id); click(); }
                    return;
                }
                y += ROW;
                if (!EXPANDED.contains(m.id)) continue;
                for (Setting<?> s : m.settings) {
                    int rh = rowH(s);
                    if (my >= y && my < y + rh) {
                        if (s instanceof Setting.Bool) ((Setting.Bool) s).set(!((Setting.Bool) s).get());
                        else if (s instanceof Setting.Mode) ((Setting.Mode) s).cycle(button == 1 ? -1 : 1);
                        else if (s instanceof Setting.Color) ((Setting.Color) s).cycle();
                        else if (s instanceof Setting.Num) { slider = (Setting.Num) s; sliderX = p.x + 8; dragSlider(mx); }
                        ConfigManager.markDirty();
                        click();
                        return;
                    }
                    y += rh;
                }
            }
            return;
        }
    }

    private void dragSlider(int mx) {
        float frac = Math.max(0, Math.min(1, (mx - sliderX) / (float) (W - 16)));
        slider.set(slider.min + (slider.max - slider.min) * frac);
        ConfigManager.markDirty();
    }

    @Override
    protected void mouseDragged(int rawX, int rawY, int button, long time) {
        int mx = (int) (rawX / k()), my = (int) (rawY / k());
        if (dragging != null) {
            dragging.x = Math.max(0, Math.min(vw() - W, mx - dragDX));
            dragging.y = Math.max(0, Math.min(vh() - HEADER, my - dragDY));
        } else if (slider != null) dragSlider(mx);
    }

    @Override
    protected void mouseReleased(int mx, int my, int button) {
        if (dragging != null) savePanels();
        dragging = null;
        slider = null;
    }

    private void savePanels() {
        for (Panel p : panels) ConfigManager.PANELS.put(p.cat.name(), new int[] { p.x, p.y, p.collapsed ? 1 : 0 });
        ConfigManager.markDirty();
    }

    @Override
    protected void keyPressed(char chr, int key) {
        if (key == Keyboard.KEY_RSHIFT || key == Keyboard.KEY_ESCAPE) { client.setScreen(null); return; }
        if (key == Keyboard.KEY_BACK && !search.isEmpty()) { search = search.substring(0, search.length() - 1); return; }
        if ((Character.isLetterOrDigit(chr) || chr == ' ') && search.length() < 24) search += chr;
    }

    @Override
    public void removed() {
        Keyboard.enableRepeatEvents(false);
        ConfigManager.save();
    }

    private static void click() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) mc.player.playSound("random.click", 0.3f, 1.6f);
    }
}
