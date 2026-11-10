package gg.poison.legacy.mixin;

import gg.poison.legacy.PoisonLegacy;
import gg.poison.legacy.util.Cps;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MinecraftClient.class)
public class MinecraftClientMixin {
    @Inject(method = "tick", at = @At("TAIL"))
    private void poison$tick(CallbackInfo ci) { PoisonLegacy.tick(); }

    /** CPS counter (display only — nothing is clicked for you). */
    @Inject(method = "doAttack", at = @At("HEAD"))
    private void poison$left(CallbackInfo ci) { Cps.click(0); }

    @Inject(method = "doUse", at = @At("HEAD"))
    private void poison$right(CallbackInfo ci) { Cps.click(1); }
}
