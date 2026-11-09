package gg.poison.client.mixin;

import gg.poison.client.hud.Notifications;
import gg.poison.client.module.Modules;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.registry.tag.ItemTags;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** HODL Mode: dropping a sword needs two Q presses within 0.5s. */
@Mixin(ClientPlayerEntity.class)
public class ClientPlayerEntityMixin {
    @Unique private long poison$lastDrop;

    @Inject(method = "dropSelectedItem", at = @At("HEAD"), cancellable = true)
    private void poison$hodl(boolean entireStack, CallbackInfoReturnable<Boolean> cir) {
        ClientPlayerEntity self = (ClientPlayerEntity) (Object) this;
        if (!Modules.HODL.on() || !self.getMainHandStack().isIn(ItemTags.SWORDS)) return;
        long now = System.currentTimeMillis();
        if (now - poison$lastDrop > 500) {
            poison$lastDrop = now;
            Notifications.push("HODL", "press Q again to drop", 0xFFFFD23F);
            cir.setReturnValue(false);
        }
    }
}
