package gg.poison.client.render;

import gg.poison.client.util.Colors;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.text.Text;
import org.joml.Matrix4f;

/** 2D glow helpers on top of DrawContext (same look as the 1.8.9 client). */
public final class G2D {
    /** Rectangle with a colour per corner (tl, tr, br, bl). */
    public static void quad(DrawContext ctx, float x1, float y1, float x2, float y2, int tl, int tr, int br, int bl) {
        Matrix4f m = ctx.getMatrices().peek().getPositionMatrix();
        VertexConsumer vc = ((net.minecraft.client.render.VertexConsumerProvider.Immediate) vcp(ctx)).getBuffer(RenderLayer.getGui());
        vc.vertex(m, x1, y1, 0).color(tl);
        vc.vertex(m, x1, y2, 0).color(bl);
        vc.vertex(m, x2, y2, 0).color(br);
        vc.vertex(m, x2, y1, 0).color(tr);
    }
    private static net.minecraft.client.render.VertexConsumerProvider vcp(DrawContext ctx) {
        return ((gg.poison.client.mixin.DrawContextAccessor) ctx).poison$vertexConsumers();
    }
    public static void rect(DrawContext ctx, float x1, float y1, float x2, float y2, int c) { quad(ctx, x1, y1, x2, y2, c, c, c, c); }
    public static void hgrad(DrawContext ctx, float x1, float y1, float x2, float y2, int l, int r) { quad(ctx, x1, y1, x2, y2, l, r, r, l); }
    public static void vgrad(DrawContext ctx, float x1, float y1, float x2, float y2, int t, int b) { quad(ctx, x1, y1, x2, y2, t, t, b, b); }

    /** Soft neon glow around a rectangle (layered fading borders). */
    public static void glow(DrawContext ctx, float x1, float y1, float x2, float y2, int color, float strength) {
        if (strength <= 0) return;
        int layers = 7;
        for (int i = layers; i >= 1; i--) {
            int a = (int) (26 * strength * (1f - (i - 1f) / layers));
            int c = Colors.alpha(color, a);
            float o = i * 1.3f;
            rect(ctx, x1 - o, y1 - o, x2 + o, y1, c);
            rect(ctx, x1 - o, y2, x2 + o, y2 + o, c);
            rect(ctx, x1 - o, y1, x1, y2, c);
            rect(ctx, x2, y1, x2 + o, y2, c);
        }
    }

    /** Text with a coloured bloom. */
    public static void glowText(DrawContext ctx, String s, int x, int y, int color, float strength) {
        var tr = MinecraftClient.getInstance().textRenderer;
        if (strength > 0) {
            int gc = Colors.alpha(color, Math.min(255, (int) (70 * strength)));
            for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) if (dx != 0 || dy != 0) ctx.drawText(tr, Text.literal(s), x + dx, y + dy, gc, false);
        }
        ctx.drawTextWithShadow(tr, Text.literal(s), x, y, color);
    }

    public static int width(String s) { return MinecraftClient.getInstance().textRenderer.getWidth(s); }

    // ------------------------------------------------------------- mint look helpers
    public static final net.minecraft.util.Identifier INTER = net.minecraft.util.Identifier.of("poison", "inter");
    public static final net.minecraft.util.Identifier INTER_BOLD = net.minecraft.util.Identifier.of("poison", "inter_bold");
    public static final net.minecraft.util.Identifier INTER_BIG = net.minecraft.util.Identifier.of("poison", "inter_big");

    /** Text in the smooth Inter font. */
    public static Text t(String s, net.minecraft.util.Identifier font) { return Text.literal(s).styled(st -> st.withFont(font)); }
    public static int fw(String s, boolean bold) { return MinecraftClient.getInstance().textRenderer.getWidth(t(s, bold ? INTER_BOLD : INTER)); }
    public static void ft(DrawContext ctx, String s, int x, int y, int color, boolean bold) {
        ctx.drawText(MinecraftClient.getInstance().textRenderer, t(s, bold ? INTER_BOLD : INTER), x, y, color, false);
    }

    /** Anti-aliased-looking rounded rectangle built from thin horizontal strips. */
    public static void round(DrawContext ctx, float x1, float y1, float x2, float y2, float r, int color) {
        r = Math.min(r, Math.min((x2 - x1) / 2f, (y2 - y1) / 2f));
        if (r <= 0.5f) { rect(ctx, x1, y1, x2, y2, color); return; }
        rect(ctx, x1, y1 + r, x2, y2 - r, color);
        int steps = Math.max(2, (int) Math.ceil(r * 2));
        float h = r / steps;
        for (int i = 0; i < steps; i++) {
            float dy = r - (i + 0.5f) * h;              // distance from the corner centre line
            float inset = r - (float) Math.sqrt(Math.max(0, r * r - dy * dy));
            float yt = y1 + i * h, yb = y2 - (i + 1) * h;
            rect(ctx, x1 + inset, yt, x2 - inset, yt + h, color);
            rect(ctx, x1 + inset, yb, x2 - inset, yb + h, color);
        }
    }

    /** Pill = fully rounded rectangle. */
    public static void pill(DrawContext ctx, float x1, float y1, float x2, float y2, int color) { round(ctx, x1, y1, x2, y2, (y2 - y1) / 2f, color); }

    /** Soft glow behind a rounded shape: concentric fading rounded rects. */
    public static void roundGlow(DrawContext ctx, float x1, float y1, float x2, float y2, float r, int color, float strength) {
        if (strength <= 0) return;
        for (int i = 6; i >= 1; i--) {
            float o = i * 1.4f;
            round(ctx, x1 - o, y1 - o, x2 + o, y2 + o, r + o, Colors.alpha(color, (int) (14 * strength)));
        }
    }

    /** Tinted icon from assets/poison/textures/gui/icons/&lt;name&gt;.png. */
    public static void icon(DrawContext ctx, String name, int x, int y, int size, int color) {
        ctx.drawTexture(RenderLayer::getGuiTextured, net.minecraft.util.Identifier.of("poison", "textures/gui/icons/" + name + ".png"),
            x, y, 0f, 0f, size, size, size, size, size, size, color);
    }

    private G2D() {}
}
