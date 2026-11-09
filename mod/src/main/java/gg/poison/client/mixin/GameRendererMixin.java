package gg.poison.client.mixin;

import gg.poison.client.PoisonClient;
import gg.poison.client.module.Modules;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public class GameRendererMixin {
    /** Zoom (hold C): divides the FOV smoothly. */
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
    private void poison$zoom(Camera camera, float tickDelta, boolean changingFov, CallbackInfoReturnable<Float> cir) {
        float z = PoisonClient.zoomFactor();
        if (z != 1f) cir.setReturnValue(cir.getReturnValue() / z);
    }

    /** No Hurt Cam. */
    @Inject(method = "tiltViewWhenHurt", at = @At("HEAD"), cancellable = true)
    private void poison$noHurtCam(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
        if (Modules.NO_HURT_CAM.on()) ci.cancel();
    }
}
