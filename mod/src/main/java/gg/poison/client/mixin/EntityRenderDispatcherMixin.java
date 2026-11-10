package gg.poison.client.mixin;

import gg.poison.client.module.Modules;
import gg.poison.client.render.GlowConsumers;
import gg.poison.client.util.Colors;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.EntityRenderDispatcher;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Self chams "fill": YOUR OWN model (and what you hold) rendered with the neon glow pass in F5. */
@Mixin(EntityRenderDispatcher.class)
public abstract class EntityRenderDispatcherMixin {
    @Unique private static boolean poison$inGlow;

    @Shadow public abstract <E extends Entity> void render(E entity, double x, double y, double z, float tickDelta, MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light);

    @Inject(method = "render(Lnet/minecraft/entity/Entity;DDDFLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V", at = @At("HEAD"), cancellable = true)
    private void poison$selfGlow(Entity entity, double x, double y, double z, float tickDelta, MatrixStack matrices, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (poison$inGlow || entity != mc.player || !Modules.SELF_CHAMS.on() || Modules.SELF_CHAMS_STYLE.is("outline")
                || mc.options.getPerspective().isFirstPerson()) return;
        int a = (int) (95 * Math.min(1.6f, Colors.glow()));
        poison$inGlow = true;
        try {
            this.render(entity, x, y, z, tickDelta, matrices, GlowConsumers.wrap(vcp, Colors.alpha(Colors.accent(), a)), light);
        } finally {
            poison$inGlow = false;
        }
        ci.cancel();
    }
}
