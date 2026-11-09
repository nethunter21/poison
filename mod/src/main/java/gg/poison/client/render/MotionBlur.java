package gg.poison.client.render;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.client.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.Framebuffer;
import net.minecraft.client.gl.SimpleFramebuffer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.texture.AbstractTexture;
import net.minecraft.util.Identifier;
import org.lwjgl.opengl.GL30;

/**
 * Accumulation motion blur. Each frame, before the HUD is drawn, the previous (already blurred)
 * frame is composited over the fresh world render with alpha = strength, then the result is
 * copied back into the history buffer. That exponential accumulation smears motion like a
 * long-exposure camera; the HUD is drawn afterwards so it stays sharp.
 */
public final class MotionBlur {
    private static final Identifier HISTORY_ID = Identifier.of("poison", "motion_blur_history");
    private static SimpleFramebuffer history;
    private static boolean primed;

    /** A texture wrapper around the history framebuffer's colour attachment (owned by the framebuffer). */
    private static final class HistoryTexture extends AbstractTexture {
        void point(int id) { this.glId = id; }
        @Override public void close() { /* the framebuffer owns the GL texture */ }
        @Override public void clearGlId() { this.glId = -1; }
    }
    private static final HistoryTexture TEXTURE = new HistoryTexture();
    private static boolean registered;

    public static void apply(DrawContext ctx) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (!Modules.MOTION_BLUR.on() || mc.world == null) { primed = false; return; }
        Framebuffer main = mc.getFramebuffer();
        int w = main.textureWidth, h = main.textureHeight;
        if (history == null) {
            history = new SimpleFramebuffer(w, h, false);
            primed = false;
        } else if (history.textureWidth != w || history.textureHeight != h) {
            history.resize(w, h);
            primed = false;
        }
        if (!registered) { mc.getTextureManager().registerTexture(HISTORY_ID, TEXTURE); registered = true; }
        TEXTURE.point(history.getColorAttachment());

        if (primed) {
            float strength = Modules.MB_STRENGTH.f();
            if (Modules.MB_FPS_SCALE.get()) {
                // roughly constant trail length in seconds (tuned at 60 fps), clamped so blur stays
                // visible on slow PCs and doesn't over-smear at very high refresh rates
                int fps = Math.max(10, mc.getCurrentFps());
                double exp = Math.max(0.5, Math.min(1.5, 60.0 / fps));
                strength = (float) Math.pow(strength, exp);
            }
            int a = Math.max(0, Math.min(255, (int) (strength * 255)));
            int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
            // framebuffer textures are bottom-up: sample v from 1 -> 0
            ctx.drawTexture(RenderLayer::getGuiTextured, HISTORY_ID, 0, 0, 0f, (float) sh, sw, sh, sw, -sh, sw, sh, (a << 24) | 0xFFFFFF);
            ctx.draw();
        }
        // copy the composited frame into history
        GlStateManager._glBindFramebuffer(GL30.GL_READ_FRAMEBUFFER, main.fbo);
        GlStateManager._glBindFramebuffer(GL30.GL_DRAW_FRAMEBUFFER, history.fbo);
        GlStateManager._glBlitFrameBuffer(0, 0, w, h, 0, 0, w, h, GL30.GL_COLOR_BUFFER_BIT, GL30.GL_NEAREST);
        main.beginWrite(false);
        primed = true;
    }

    private MotionBlur() {}
}
