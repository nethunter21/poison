package gg.poison.legacy.mixin;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.music.MusicPlayer;
import gg.poison.legacy.util.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.entity.LivingEntityRenderer;
import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.entity.LivingEntity;
import org.lwjgl.opengl.GL11;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Self chams: additive glow shell around YOUR OWN model (third person only). */
@Mixin(LivingEntityRenderer.class)
public abstract class LivingEntityRendererMixin {
    @Shadow protected EntityModel model;

    @Inject(method = "renderModel", at = @At("TAIL"))
    private void poison$selfChams(LivingEntity entity, float f, float g, float h, float i, float j, float k, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (!Modules.SELF_CHAMS.on() || entity != mc.player || mc.options.perspective == 0) return;
        String st = Modules.SELF_CHAMS_MODE.get();
        int c = st.equals("rainbow") ? Theme.wave(0, 2f) : Theme.accent();
        float pulse = st.equals("pulse") ? 0.5f + 0.5f * (float) Math.sin(System.currentTimeMillis() / 200.0) : 0.8f;
        pulse = Math.min(1f, pulse + MusicPlayer.level() * 0.4f);
        GlStateManager.pushMatrix();
        GlStateManager.disableTexture();
        GlStateManager.disableLighting();
        GlStateManager.enableBlend();
        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE);
        GlStateManager.depthMask(false);
        for (int layer = 0; layer < 2; layer++) {
            float s = 1.04f + layer * 0.05f;
            GlStateManager.pushMatrix();
            GlStateManager.translate(0, 1.5f * (1 - s) * 0.5f, 0);
            GlStateManager.scale(s, s, s);
            GlStateManager.color(((c >> 16) & 255) / 255f, ((c >> 8) & 255) / 255f, (c & 255) / 255f, (layer == 0 ? 0.45f : 0.2f) * pulse);
            this.model.render(entity, f, g, h, i, j, k);
            GlStateManager.popMatrix();
        }
        GlStateManager.depthMask(true);
        GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        GlStateManager.disableBlend();
        GlStateManager.enableLighting();
        GlStateManager.enableTexture();
        GlStateManager.color(1, 1, 1, 1);
        GlStateManager.popMatrix();
    }
}
