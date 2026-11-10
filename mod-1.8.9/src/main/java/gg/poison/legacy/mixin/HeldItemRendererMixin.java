package gg.poison.legacy.mixin;

import com.mojang.blaze3d.platform.GlStateManager;
import gg.poison.legacy.knife.Balisong;
import gg.poison.legacy.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.item.HeldItemRenderer;
import net.minecraft.client.render.model.json.ModelTransformation;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.SwordItem;
import net.minecraft.util.math.MathHelper;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(HeldItemRenderer.class)
public class HeldItemRendererMixin {
    @Unique private static float poison$swing;

    @Inject(method = "renderArmHoldingItem", at = @At("HEAD"))
    private void poison$captureSwing(float tickDelta, CallbackInfo ci) {
        poison$swing = MinecraftClient.getInstance().player.getHandSwingProgress(tickDelta);
    }

    /** 1.7 animations: keep the swing while blocking (the classic block-hit look). */
    @ModifyArg(method = "renderArmHoldingItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/item/HeldItemRenderer;applyEquipAndSwingOffset(FF)V", ordinal = 2), index = 1)
    private float poison$blockHit(float swing) {
        return Modules.OLD_ANIM.on() ? poison$swing : swing;
    }

    /** Sword block styles. */
    @Inject(method = "applySwordBlockTransformation", at = @At("HEAD"), cancellable = true)
    private void poison$blockStyle(CallbackInfo ci) {
        if (!Modules.OLD_ANIM.on() || Modules.BLOCK_STYLE.is("1.7")) return;
        float s = MathHelper.sin(MathHelper.sqrt(poison$swing) * (float) Math.PI);
        String st = Modules.BLOCK_STYLE.get();
        GlStateManager.translate(-0.5F, 0.2F, 0.0F);
        GlStateManager.rotate(30.0F, 0.0F, 1.0F, 0.0F);
        GlStateManager.rotate(-80.0F, 1.0F, 0.0F, 0.0F);
        GlStateManager.rotate(60.0F, 0.0F, 1.0F, 0.0F);
        if (st.equals("exhibition")) { GlStateManager.translate(0, 0.25f, 0.1f); GlStateManager.rotate(-s * 35, 1, 0, 0); }
        else if (st.equals("slide")) { GlStateManager.translate(-s * 0.4f, 0, 0); GlStateManager.rotate(s * 20, 0, 0, 1); }
        else if (st.equals("spin")) GlStateManager.rotate(System.currentTimeMillis() % 720 / 2f, 0, 1, 0);
        else if (st.equals("push")) { GlStateManager.translate(0, 0, -s * 0.5f); GlStateManager.rotate(-s * 20, 1, 0, 0); }
        else if (st.equals("swank")) { GlStateManager.rotate(s * 30, 0, 1, 0); GlStateManager.rotate(-s * 40, 1, 0, 0); }
        ci.cancel();
    }

    /** First person: draw the animated balisong instead of any sword (visual only). */
    @Inject(method = "renderItem", at = @At("HEAD"), cancellable = true)
    private void poison$knife(LivingEntity entity, ItemStack stack, ModelTransformation.Mode mode, CallbackInfo ci) {
        if (Modules.BUTTERFLY.on() && mode == ModelTransformation.Mode.FIRST_PERSON && stack != null && stack.getItem() instanceof SwordItem) {
            Balisong.renderFirstPerson();
            ci.cancel();
        }
    }
}
