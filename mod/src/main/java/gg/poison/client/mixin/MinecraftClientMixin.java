package gg.poison.client.mixin;

import gg.poison.client.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Self chams: outline glow on YOUR OWN player only, in third person. Never other entities. */
@Mixin(MinecraftClient.class)
public class MinecraftClientMixin {
    @Inject(method = "hasOutline", at = @At("HEAD"), cancellable = true)
    private void poison$selfChams(Entity entity, CallbackInfoReturnable<Boolean> cir) {
        MinecraftClient mc = (MinecraftClient) (Object) this;
        if (Modules.SELF_CHAMS.on() && entity == mc.player && !mc.options.getPerspective().isFirstPerson()) cir.setReturnValue(true);
    }
}
