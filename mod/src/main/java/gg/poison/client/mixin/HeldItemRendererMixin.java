package gg.poison.client.mixin;

import gg.poison.client.knife.Balisong;
import gg.poison.client.module.Modules;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.item.HeldItemRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.ModelTransformationMode;
import net.minecraft.registry.tag.ItemTags;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** First-person: draw the animated balisong instead of any sword (visual only). */
@Mixin(HeldItemRenderer.class)
public class HeldItemRendererMixin {
    @org.spongepowered.asm.mixin.Shadow @org.spongepowered.asm.mixin.Final private net.minecraft.client.render.item.ItemRenderer itemRenderer;
    @Inject(method = "renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ModelTransformationMode;ZLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V",
            at = @At("HEAD"), cancellable = true)
    private void poison$knife(LivingEntity entity, ItemStack stack, ModelTransformationMode mode, boolean leftHanded,
                              MatrixStack matrices, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
        if (Modules.BUTTERFLY.on() && mode.isFirstPerson() && stack.isIn(ItemTags.SWORDS)) {
            Balisong.renderFirstPerson(matrices, vcp, light, leftHanded);
            ci.cancel();
            return;
        }
        // Item Glow: any other held item rendered again through the neon glow wrapper
        if (Modules.ITEM_GLOW.on() && mode.isFirstPerson() && !stack.isEmpty()) {
            int a = (int) (Modules.ITEM_GLOW_AMOUNT.f() * 150 * Math.min(1.6f, gg.poison.client.util.Colors.glow()));
            VertexConsumerProvider glow = gg.poison.client.render.GlowConsumers.wrap(vcp, gg.poison.client.util.Colors.alpha(gg.poison.client.util.Colors.accent(), a));
            this.itemRenderer.renderItem(entity, stack, mode, leftHanded, matrices, glow, entity.getWorld(), light,
                net.minecraft.client.render.OverlayTexture.DEFAULT_UV, entity.getId() + mode.ordinal());
            ci.cancel();
        }
    }

    /** Flush the glow pass after the hand's items have been drawn so it sits on top. */
    @Inject(method = "renderItem(FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider$Immediate;Lnet/minecraft/client/network/ClientPlayerEntity;I)V", at = @At("TAIL"))
    private void poison$flushGlow(CallbackInfo ci) { gg.poison.client.render.GlowConsumers.flush(); }
}
