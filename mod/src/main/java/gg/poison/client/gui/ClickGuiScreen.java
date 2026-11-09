package gg.poison.client.gui;

import gg.poison.client.config.ConfigManager;
import gg.poison.client.hud.Notifications;
import gg.poison.client.module.Category;
import gg.poison.client.module.Module;
import gg.poison.client.module.Modules;
import gg.poison.client.module.Setting;
import gg.poison.client.music.MusicPlayer;
import gg.poison.client.util.Colors;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** POISON client menu (Right Shift): draggable category panels, like the launcher's ClickGUI. */
public class ClickGuiScreen extends Screen {
    private static final int W = 124, HEADER = 16, ROW = 13, SET_ROW = 12, SLIDER_ROW = 19;
    private static final Set<String> EXPANDED = new HashSet<>();

    private final List<Panel> panels = new ArrayList<>();
    private final long openedAt = System.currentTimeMillis();
    private String search = "";
    private Panel dragging;
    private int dragDX, dragDY;
    private Setting.Num slider;
    private int sliderX;

    private static class Panel {
        final Category cat;
        int x, y;
        boolean collapsed;
        Panel(Category c, int x, int y) { cat = c; this.x = x; this.y = y; }
    }

    public ClickGuiScreen() {
        super(Text.literal("POISON"));
        for (Category c : Category.values()) {
            int[] saved = ConfigManager.PANELS.get(c.name());
            Panel p = new Panel(c, saved != null ? saved[0] : -1, saved != null ? saved[1] : -1);
            if (saved != null) p.collapsed = saved[2] == 1;
            panels.add(p);
        }
    }

    /** The menu draws at a fixed effective GUI scale of 2 regardless of the game's GUI scale. */
    private float k() {
        double sf = MinecraftClient.getInstance().getWindow().getScaleFactor();
        return (float) (2.0 / sf);
    }
    private int vw() { return (int) (this.width / k()); }
    private int vh() { return (int) (this.height / k()); }

    @Override
    protected void init() {
        // flow panels without a saved position into rows that fit the screen
        int cols = Math.max(1, (vw() - 12) / (W + 8));
        int x = 10, y = 30, col = 0, rowH = 0;
        for (Panel p : panels) {
            if (p.x >= 0 && p.x < vw() - 20 && p.y >= 0 && p.y < vh() - 10) continue;
            if (col == cols) { col = 0; x = 10; y += rowH + 10; rowH = 0; }
            p.x = x; p.y = y;
            rowH = Math.max(rowH, panelHeight(p));
            x += W + 8; col++;
        }
    }

    @Override public boolean shouldPause() { return false; }

    private List<Module> visible(Category c) {
        List<Module> out = new ArrayList<>();
        String q = search.toLowerCase();
        for (Module m : Modules.ALL) if (m.category == c && (q.isEmpty() || m.name.toLowerCase().contains(q))) out.add(m);
        return out;
    }

    private int rowHeight(Setting<?> s) { return s instanceof Setting.Num ? SLIDER_ROW : SET_ROW; }

    private int panelHeight(Panel p) {
        if (p.collapsed) return HEADER;
        int h = HEADER;
        for (Module m : visible(p.cat)) {
            h += ROW;
            if (EXPANDED.contains(m.id)) for (Setting<?> s : m.settings) h += rowHeight(s);
        }
        return h + 2;
    }

    @Override
    public void render(DrawContext ctx, int rawX, int rawY, float delta) {
        super.render(ctx, rawX, rawY, delta);
        float k = k();
        int mouseX = (int) (rawX / k), mouseY = (int) (rawY / k);
        ctx.getMatrices().push();
        ctx.getMatrices().scale(k, k, 1);
        int width = vw(), height = vh();
        TextRenderer tr = this.textRenderer;
        float open = Math.min(1f, (System.currentTimeMillis() - openedAt) / 220f);
        float ease = 1 - (float) Math.pow(1 - open, 3);

        // top bar
        ctx.fillGradient(0, 0, width, 22, 0xE0140C1C, 0x00140C1C);
        int logoColor = Colors.wave(0, 1.5f);
        ctx.drawTextWithShadow(tr, Text.literal("☠ POISON"), 10, 7, logoColor);
        ctx.drawTextWithShadow(tr, Text.literal("client menu"), 10 + tr.getWidth("☠ POISON") + 6, 7, Colors.MUTED);
        String sb = search.isEmpty() ? "type to search…" : search + (System.currentTimeMillis() / 400 % 2 == 0 ? "_" : "");
        int sx = width - 170;
        ctx.fill(sx, 4, sx + 160, 18, 0xA0000000);
        ctx.drawBorder(sx, 4, 160, 14, search.isEmpty() ? 0x40FFFFFF : Colors.ACCENT);
        ctx.drawTextWithShadow(tr, Text.literal("⌕ " + sb), sx + 5, 7, search.isEmpty() ? Colors.MUTED : Colors.TEXT);

        ctx.getMatrices().push();
        ctx.getMatrices().translate(0, (1 - ease) * 18, 0);
        for (Panel p : panels) drawPanel(ctx, tr, p, mouseX, mouseY, ease);
        ctx.getMatrices().pop();

        String hint = "Left-click toggle · Right-click settings · Drag headers · Right-click header collapse · Esc / RShift close";
        ctx.drawCenteredTextWithShadow(tr, Text.literal(hint), width / 2, height - 12, Colors.MUTED);
        if (MusicPlayer.current() != null)
            ctx.drawTextWithShadow(tr, Text.literal("♫ " + MusicPlayer.current() + (MusicPlayer.isPaused() ? "  (paused)" : "")), 10, height - 24, Colors.ACCENT);
        ctx.getMatrices().pop();
        if (tooltip != null && dragging == null && slider == null) ctx.drawTooltip(tr, Text.literal(tooltip), rawX, rawY);
    }

    private void drawPanel(DrawContext ctx, TextRenderer tr, Panel p, int mx, int my, float alpha) {
        int h = panelHeight(p);
        int a = (int) (alpha * 255);
        // glow + body
        ctx.fill(p.x - 2, p.y - 2, p.x + W + 2, p.y + h + 2, Colors.alpha(Colors.ACCENT, (int) (40 * alpha)));
        ctx.fill(p.x, p.y, p.x + W, p.y + h, Colors.alpha(0x0E0914, (int) (225 * alpha)));
        ctx.fillGradient(p.x, p.y, p.x + W, p.y + HEADER, Colors.alpha(Colors.ACCENT, a), Colors.alpha(Colors.ACCENT2, a));
        ctx.drawText(tr, Text.literal(p.cat.icon + " " + p.cat.title.toUpperCase()), p.x + 5, p.y + 4, 0xFF140600, false);
        String count = String.valueOf(visible(p.cat).size());
        ctx.drawText(tr, Text.literal(count), p.x + W - 5 - tr.getWidth(count), p.y + 4, 0xFF140600, false);
        if (p.collapsed) return;

        int y = p.y + HEADER;
        for (Module m : visible(p.cat)) {
            boolean hover = mx >= p.x && mx < p.x + W && my >= y && my < y + ROW;
            if (m.on()) {
                ctx.fillGradient(p.x, y, p.x + W, y + ROW, Colors.alpha(Colors.ACCENT, 90), Colors.alpha(Colors.ACCENT, 10));
                ctx.fill(p.x, y, p.x + 2, y + ROW, Colors.ACCENT);
            } else if (hover) ctx.fill(p.x, y, p.x + W, y + ROW, 0x18FFFFFF);
            ctx.drawText(tr, Text.literal(m.name), p.x + (hover ? 8 : 6), y + 3, m.on() ? Colors.TEXT : Colors.MUTED, m.on());
            if (!m.settings.isEmpty()) ctx.drawText(tr, Text.literal(EXPANDED.contains(m.id) ? "−" : "⋯"), p.x + W - 9, y + 3, Colors.MUTED, false);
            if (hover && !m.description.isEmpty()) tooltip = m.description;
            y += ROW;
            if (!EXPANDED.contains(m.id)) continue;
            for (Setting<?> s : m.settings) {
                int rh = rowHeight(s);
                ctx.fill(p.x, y, p.x + W, y + rh, 0x66000000);
                int tx = p.x + 8;
                if (s instanceof Setting.Bool b) {
                    ctx.drawText(tr, Text.literal(s.label), tx, y + 2, 0xFFD9CBBD, false);
                    int swx = p.x + W - 20;
                    ctx.fill(swx, y + 2, swx + 14, y + 9, b.get() ? Colors.ACCENT : 0x50FFFFFF);
                    ctx.fill(b.get() ? swx + 8 : swx + 1, y + 3, b.get() ? swx + 13 : swx + 6, y + 8, 0xFFFFFFFF);
                } else if (s instanceof Setting.Num n) {
                    ctx.drawText(tr, Text.literal(s.label), tx, y + 2, 0xFFD9CBBD, false);
                    String v = n.display();
                    ctx.drawText(tr, Text.literal(v), p.x + W - 6 - tr.getWidth(v), y + 2, Colors.ACCENT, false);
                    int bx = tx, bw = W - 16, by = y + 13;
                    float frac = (float) ((n.get() - n.min) / (n.max - n.min));
                    ctx.fill(bx, by, bx + bw, by + 2, 0x40FFFFFF);
                    ctx.fillGradient(bx, by, bx + (int) (bw * frac), by + 2, Colors.ACCENT, Colors.ACCENT2);
                    int kx = bx + (int) (bw * frac);
                    ctx.fill(kx - 2, by - 2, kx + 2, by + 4, 0xFFFFFFFF);
                } else if (s instanceof Setting.Mode md) {
                    ctx.drawText(tr, Text.literal(s.label), tx, y + 2, 0xFFD9CBBD, false);
                    String v = "‹ " + pretty(md.get()) + " ›";
                    ctx.drawText(tr, Text.literal(v), p.x + W - 6 - tr.getWidth(v), y + 2, Colors.ACCENT, false);
                } else if (s instanceof Setting.Color c) {
                    ctx.drawText(tr, Text.literal(s.label), tx, y + 2, 0xFFD9CBBD, false);
                    ctx.fill(p.x + W - 20, y + 2, p.x + W - 6, y + 9, c.get());
                }
                y += rh;
            }
        }
    }

    private String tooltip;

    private static String pretty(String v) { return v.startsWith("knife_") ? v.substring(6) : v; }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        tooltip = null;
        super.renderBackground(ctx, mouseX, mouseY, delta);
        ctx.fillGradient(0, 0, this.width, this.height, 0x40FF8A00, 0x60140010);
    }


    @Override
    public boolean mouseClicked(double mxD, double myD, int button) {
        int mx = (int) (mxD / k()), my = (int) (myD / k());
        for (int i = panels.size() - 1; i >= 0; i--) {
            Panel p = panels.get(i);
            if (mx < p.x || mx >= p.x + W || my < p.y || my >= p.y + panelHeight(p)) continue;
            panels.remove(i);
            panels.add(p); // bring to front
            if (my < p.y + HEADER) {
                if (button == 1) { p.collapsed = !p.collapsed; savePanels(); click(); }
                else { dragging = p; dragDX = mx - p.x; dragDY = my - p.y; }
                return true;
            }
            int y = p.y + HEADER;
            for (Module m : visible(p.cat)) {
                if (my >= y && my < y + ROW) {
                    if (button == 0) {
                        m.toggle();
                        Notifications.module(m);
                        ConfigManager.markDirty();
                        click();
                    } else if (button == 1 && !m.settings.isEmpty()) {
                        if (!EXPANDED.remove(m.id)) EXPANDED.add(m.id);
                        click();
                    }
                    return true;
                }
                y += ROW;
                if (!EXPANDED.contains(m.id)) continue;
                for (Setting<?> s : m.settings) {
                    int rh = rowHeight(s);
                    if (my >= y && my < y + rh) {
                        if (s instanceof Setting.Bool b) b.set(!b.get());
                        else if (s instanceof Setting.Mode md) md.cycle(button == 1 ? -1 : 1);
                        else if (s instanceof Setting.Color c) c.cycle();
                        else if (s instanceof Setting.Num n) { slider = n; sliderX = p.x + 8; dragSlider(mx); }
                        if (s == Modules.MUSIC_VOLUME) MusicPlayer.applyVolume();
                        ConfigManager.markDirty();
                        click();
                        return true;
                    }
                    y += rh;
                }
            }
            return true;
        }
        return super.mouseClicked(mxD, myD, button);
    }

    private void dragSlider(int mx) {
        float frac = Math.max(0, Math.min(1, (mx - sliderX) / (float) (W - 16)));
        slider.set(slider.min + (slider.max - slider.min) * frac);
        if (slider == Modules.MUSIC_VOLUME) MusicPlayer.applyVolume();
        ConfigManager.markDirty();
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging != null) {
            dragging.x = Math.max(0, Math.min(vw() - W, (int) (mx / k()) - dragDX));
            dragging.y = Math.max(0, Math.min(vh() - HEADER, (int) (my / k()) - dragDY));
            return true;
        }
        if (slider != null) { dragSlider((int) (mx / k())); return true; }
        return super.mouseDragged(mx, my, button, dx, dy);
    }

    @Override
    public boolean mouseReleased(double mx, double my, int button) {
        if (dragging != null) savePanels();
        dragging = null;
        slider = null;
        return super.mouseReleased(mx, my, button);
    }

    private void savePanels() {
        for (Panel p : panels) ConfigManager.PANELS.put(p.cat.name(), new int[] { p.x, p.y, p.collapsed ? 1 : 0 });
        ConfigManager.markDirty();
    }

    @Override
    public boolean keyPressed(int key, int scan, int mods) {
        if (key == GLFW.GLFW_KEY_RIGHT_SHIFT || key == GLFW.GLFW_KEY_ESCAPE) { close(); return true; }
        if (key == GLFW.GLFW_KEY_BACKSPACE && !search.isEmpty()) { search = search.substring(0, search.length() - 1); return true; }
        return super.keyPressed(key, scan, mods);
    }

    @Override
    public boolean charTyped(char chr, int mods) {
        if (Character.isLetterOrDigit(chr) || chr == ' ') { if (search.length() < 24) search += chr; return true; }
        return super.charTyped(chr, mods);
    }

    @Override
    public void close() {
        ConfigManager.save();
        super.close();
    }

    private static void click() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) mc.player.playSound(net.minecraft.sound.SoundEvents.UI_BUTTON_CLICK.value(), 0.3f, 1.6f);
    }
}
