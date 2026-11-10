package gg.poison.legacy.mixin;

import gg.poison.legacy.render.WorldFx;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hit/kill effects react to hits YOU make (the attack itself is untouched). */
@Mixin(ClientPlayerInteractionManager.class)
public class ClientPlayerInteractionManagerMixin {
    @Inject(method = "attackEntity", at = @At("HEAD"))
    private void poison$hit(PlayerEntity player, Entity target, CallbackInfo ci) { WorldFx.onHit(target); }
}
