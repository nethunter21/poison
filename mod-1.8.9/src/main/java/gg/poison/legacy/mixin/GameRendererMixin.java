package gg.poison.legacy.mixin;

import gg.poison.legacy.PoisonLegacy;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.render.WorldFx;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public class GameRendererMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
    private void poison$zoom(float tickDelta, boolean changingFov, CallbackInfoReturnable<Float> cir) {
        float z = PoisonLegacy.zoomFactor();
        if (z != 1f) cir.setReturnValue(cir.getReturnValue() / z);
    }

    @Inject(method = "bobViewWhenHurt", at = @At("HEAD"), cancellable = true)
    private void poison$noHurtCam(float tickDelta, CallbackInfo ci) { if (Modules.NO_HURT_CAM.on()) ci.cancel(); }

    /** World-space effects, drawn with the camera transform right before the hand. */
    @Inject(method = "renderWorld(IFJ)V", at = @At(value = "INVOKE_STRING", target = "Lnet/minecraft/util/profiler/Profiler;swap(Ljava/lang/String;)V", args = "ldc=hand"))
    private void poison$worldFx(int anaglyph, float tickDelta, long limitTime, CallbackInfo ci) { WorldFx.render(tickDelta); }
}
