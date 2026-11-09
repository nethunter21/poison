package gg.poison.client.mixin;

import gg.poison.client.module.Modules;
import net.minecraft.client.world.ClientWorld;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Time Changer: client-side visual time of day. Server time is untouched. */
@Mixin(ClientWorld.Properties.class)
public class ClientWorldPropertiesMixin {
    @Inject(method = "getTimeOfDay", at = @At("HEAD"), cancellable = true)
    private void poison$time(CallbackInfoReturnable<Long> cir) {
        // slider 0..1 maps to sunrise -> noon -> sunset -> midnight (0.75 = 18000 ticks)
        if (Modules.TIME_CHANGER.on()) cir.setReturnValue((long) (Modules.TIME.get() * 24000));
    }
}
