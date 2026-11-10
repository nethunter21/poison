package gg.poison.legacy.render;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.util.Window;
import org.lwjgl.opengl.GL11;

/**
 * Accumulation motion blur for 1.8.9. Before the HUD: draw the previous (already blurred) frame
 * over the fresh world render at alpha = strength, then copy the result back into the history
 * texture with glCopyTexSubImage2D (works with or without framebuffers, GL 1.1).
 */
public final class MotionBlur {
    private static int tex = -1, texW, texH;
    private static boolean primed;

    public static void apply() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (!Modules.MOTION_BLUR.on() || mc.world == null) { primed = false; return; }
        int w = mc.width, h = mc.height;
        if (tex == -1 || w != texW || h != texH) {
            if (tex == -1) tex = GL11.glGenTextures();
            GlStateManager.bindTexture(tex);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);
            GL11.glTexImage2D(GL11.GL_TEXTURE_2D, 0, GL11.GL_RGBA8, w, h, 0, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, (java.nio.ByteBuffer) null);
            texW = w; texH = h; primed = false;
        }
        if (primed) {
            float strength = Modules.MB_STRENGTH.f();
            if (Modules.MB_FPS_SCALE.get()) {
                int fps = Math.max(10, MinecraftClient.getCurrentFps());
                strength = (float) Math.pow(strength, Math.max(0.5, Math.min(1.5, 60.0 / fps)));
            }
            Window win = new Window(mc);
            double sw = win.getScaledWidth(), sh = win.getScaledHeight();
            GlStateManager.enableTexture();
            GlStateManager.bindTexture(tex);
            GlStateManager.enableBlend();
            GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
            GlStateManager.disableDepthTest();
            GlStateManager.disableAlphaTest();
            GlStateManager.color(1, 1, 1, strength);
            Tessellator t = Tessellator.getInstance();
            BufferBuilder b = t.getBuffer();
            b.begin(GL11.GL_QUADS, VertexFormats.POSITION_TEXTURE);
            b.vertex(0, sh, 0).texture(0, 0).next();
            b.vertex(sw, sh, 0).texture(1, 0).next();
            b.vertex(sw, 0, 0).texture(1, 1).next();
            b.vertex(0, 0, 0).texture(0, 1).next();
            t.draw();
            GlStateManager.color(1, 1, 1, 1);
            GlStateManager.enableAlphaTest();
            GlStateManager.enableDepthTest();
        }
        GlStateManager.bindTexture(tex);
        GL11.glCopyTexSubImage2D(GL11.GL_TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
        primed = true;
    }

    private MotionBlur() {}
}
