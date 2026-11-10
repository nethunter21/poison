package gg.poison.legacy.mixin;

import gg.poison.legacy.module.Modules;
import gg.poison.legacy.render.WorldFx;
import net.minecraft.client.render.WorldRenderer;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.hit.BlockHitResult;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(WorldRenderer.class)
public class WorldRendererMixin {
    /** Neon block outline on the block YOU are looking at (same block vanilla outlines). */
    @Inject(method = "drawBlockOutline", at = @At("HEAD"), cancellable = true)
    private void poison$outline(PlayerEntity player, BlockHitResult hit, int i, float tickDelta, CallbackInfo ci) {
        if (!Modules.BLOCK_OUTLINE.on() || i != 0) return;
        WorldFx.drawBlockOutline(hit, tickDelta);
        ci.cancel();
    }
}
