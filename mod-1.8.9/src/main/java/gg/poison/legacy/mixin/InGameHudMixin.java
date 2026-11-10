package gg.poison.legacy.mixin;

import gg.poison.legacy.hud.Hud;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.render.MotionBlur;
import net.minecraft.client.gui.hud.InGameHud;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(InGameHud.class)
public class InGameHudMixin {
    /** Motion blur before any HUD element so the HUD stays sharp. */
    @Inject(method = "render", at = @At("HEAD"))
    private void poison$blur(float tickDelta, CallbackInfo ci) { MotionBlur.apply(); }

    @Inject(method = "render", at = @At("TAIL"))
    private void poison$hud(float tickDelta, CallbackInfo ci) { Hud.render(); }

    /** Hide the vanilla crosshair when the custom one is on. */
    @Inject(method = "showCrosshair", at = @At("HEAD"), cancellable = true)
    private void poison$crosshair(CallbackInfoReturnable<Boolean> cir) { if (Modules.CROSSHAIR.on()) cir.setReturnValue(false); }
}
