package gg.poison.client.mixin;

import gg.poison.client.module.Modules;
import net.minecraft.client.gui.hud.InGameOverlayRenderer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Low Fire: shifts the burning overlay down. */
@Mixin(InGameOverlayRenderer.class)
public class InGameOverlayRendererMixin {
    @Inject(method = "renderFireOverlay", at = @At("HEAD"))
    private static void poison$lowFireStart(MatrixStack matrices, VertexConsumerProvider vcp, CallbackInfo ci) {
        matrices.push();
        if (Modules.LOW_FIRE.on()) matrices.translate(0, -Modules.LOW_FIRE_HEIGHT.f(), 0);
    }

    @Inject(method = "renderFireOverlay", at = @At("RETURN"))
    private static void poison$lowFireEnd(MatrixStack matrices, VertexConsumerProvider vcp, CallbackInfo ci) {
        matrices.pop();
    }
}
