package gg.poison.legacy.mixin;

import gg.poison.legacy.module.Modules;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Time Changer: client world only, visual. */
@Mixin(World.class)
public abstract class WorldMixin {
    @Shadow public boolean isClient;

    @Inject(method = "getTimeOfDay", at = @At("HEAD"), cancellable = true)
    private void poison$time(CallbackInfoReturnable<Long> cir) {
        if (isClient && Modules.TIME_CHANGER.on()) cir.setReturnValue((long) (Modules.TIME.get() * 24000));
    }
}
