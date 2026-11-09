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
    @Inject(method = "renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ModelTransformationMode;ZLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V",
            at = @At("HEAD"), cancellable = true)
    private void poison$knife(LivingEntity entity, ItemStack stack, ModelTransformationMode mode, boolean leftHanded,
                              MatrixStack matrices, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
        if (Modules.BUTTERFLY.on() && mode.isFirstPerson() && stack.isIn(ItemTags.SWORDS)) {
            Balisong.renderFirstPerson(matrices, vcp, light, leftHanded);
            ci.cancel();
        }
    }
}
