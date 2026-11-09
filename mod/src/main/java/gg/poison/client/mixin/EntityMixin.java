package gg.poison.client.mixin;

import gg.poison.client.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Colour of the self-chams outline (local player only). */
@Mixin(Entity.class)
public class EntityMixin {
    @Inject(method = "getTeamColorValue", at = @At("HEAD"), cancellable = true)
    private void poison$chamsColor(CallbackInfoReturnable<Integer> cir) {
        if (Modules.SELF_CHAMS.on() && (Object) this == MinecraftClient.getInstance().player)
            cir.setReturnValue(Modules.SELF_CHAMS_COLOR.get() & 0xFFFFFF);
    }
}
