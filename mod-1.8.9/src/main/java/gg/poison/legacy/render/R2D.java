package gg.poison.legacy.render;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.util.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormats;
import org.lwjgl.opengl.GL11;

/** 2D drawing for the HUD / menu: gradients, soft glows, bloom text, circles. */
public final class R2D {
    private static void begin() {
        GlStateManager.enableBlend();
        GlStateManager.disableTexture();
        GlStateManager.blendFuncSeparate(770, 771, 1, 0);
        GlStateManager.shadeModel(GL11.GL_SMOOTH);
    }
    private static void end() {
        GlStateManager.shadeModel(GL11.GL_FLAT);
        GlStateManager.enableTexture();
        GlStateManager.disableBlend();
    }
    private static void c(BufferBuilder b, double x, double y, int argb) {
        b.vertex(x, y, 0).color((argb >> 16) & 255, (argb >> 8) & 255, argb & 255, argb >>> 24).next();
    }

    /** Four-corner gradient rectangle (tl, tr, br, bl). */
    public static void quad(double x1, double y1, double x2, double y2, int tl, int tr, int br, int bl) {
        begin();
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        b.begin(GL11.GL_QUADS, VertexFormats.POSITION_COLOR);
        c(b, x1, y2, bl); c(b, x2, y2, br); c(b, x2, y1, tr); c(b, x1, y1, tl);
        t.draw();
        end();
    }
    public static void rect(double x1, double y1, double x2, double y2, int c) { quad(x1, y1, x2, y2, c, c, c, c); }
    public static void hgrad(double x1, double y1, double x2, double y2, int l, int r) { quad(x1, y1, x2, y2, l, r, r, l); }
    public static void vgrad(double x1, double y1, double x2, double y2, int top, int bottom) { quad(x1, y1, x2, y2, top, top, bottom, bottom); }

    /** Soft neon glow around a rectangle: layered fading borders (cheap bloom). */
    public static void glow(double x1, double y1, double x2, double y2, int color, float strength) {
        if (strength <= 0) return;
        int layers = 7;
        for (int i = layers; i >= 1; i--) {
            int a = (int) (26 * strength * (1f - (i - 1f) / layers));
            int col = Theme.alpha(color, a);
            double o = i * 1.3;
            rect(x1 - o, y1 - o, x2 + o, y1, col);
            rect(x1 - o, y2, x2 + o, y2 + o, col);
            rect(x1 - o, y1, x1, y2, col);
            rect(x2, y1, x2 + o, y2, col);
        }
    }

    /** Text with a coloured bloom behind it. */
    public static void glowText(String s, float x, float y, int color, float strength) {
        TextRenderer tr = MinecraftClient.getInstance().textRenderer;
        if (strength > 0) {
            int a = Math.min(255, (int) (70 * strength));
            int gc = Theme.alpha(color, a);
            GlStateManager.enableBlend();
            for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                tr.draw(s, (int) x + dx, (int) y + dy, gc, false);
            }
        }
        tr.draw(s, (int) x, (int) y, color, true);
    }

    public static void text(String s, float x, float y, int color) {
        MinecraftClient.getInstance().textRenderer.draw(s, (int) x, (int) y, color, true);
    }
    public static int width(String s) { return MinecraftClient.getInstance().textRenderer.getStringWidth(s); }

    /** Ring (or filled circle when inner == 0). */
    public static void ring(double cx, double cy, double inner, double outer, int cIn, int cOut) {
        begin();
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        b.begin(GL11.GL_TRIANGLE_STRIP, VertexFormats.POSITION_COLOR);
        for (int i = 0; i <= 48; i++) {
            double a = i / 48.0 * Math.PI * 2;
            c(b, cx + Math.cos(a) * outer, cy + Math.sin(a) * outer, cOut);
            c(b, cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, cIn);
        }
        t.draw();
        end();
    }

    public static void line(double x1, double y1, double x2, double y2, float width, int color) {
        begin();
        GL11.glLineWidth(width);
        Tessellator t = Tessellator.getInstance();
        BufferBuilder b = t.getBuffer();
        b.begin(GL11.GL_LINES, VertexFormats.POSITION_COLOR);
        c(b, x1, y1, color); c(b, x2, y2, color);
        t.draw();
        GL11.glLineWidth(1);
        end();
    }

    private R2D() {}
}
