package gg.poison.client.mixin;

import gg.poison.client.render.MotionBlur;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Motion blur is composited right after the world, before any HUD, so the HUD stays sharp. */
@Mixin(InGameHud.class)
public class InGameHudMixin {
    /** Custom hotbar replaces the vanilla hotbar, hearts/hunger and (optionally) XP. */
    @Inject(method = "renderHotbar", at = @At("HEAD"), cancellable = true)
    private void poison$hotbar(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        if (gg.poison.client.module.Modules.CUSTOM_HOTBAR.on()) ci.cancel();
    }

    @Inject(method = "renderStatusBars", at = @At("HEAD"), cancellable = true)
    private void poison$statusBars(DrawContext context, CallbackInfo ci) {
        if (gg.poison.client.module.Modules.CUSTOM_HOTBAR.on()) ci.cancel();
    }

    @Inject(method = "renderExperienceBar", at = @At("HEAD"), cancellable = true)
    private void poison$xpBar(DrawContext context, int x, CallbackInfo ci) {
        if (gg.poison.client.module.Modules.CUSTOM_HOTBAR.on() && gg.poison.client.module.Modules.HOTBAR_HIDE_XP.get()) ci.cancel();
    }

    @Inject(method = "renderExperienceLevel", at = @At("HEAD"), cancellable = true)
    private void poison$xpLevel(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        if (gg.poison.client.module.Modules.CUSTOM_HOTBAR.on() && gg.poison.client.module.Modules.HOTBAR_HIDE_XP.get()) ci.cancel();
    }

    /** Hide the vanilla crosshair when the custom one is on. */
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true)
    private void poison$crosshair(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        if (gg.poison.client.module.Modules.CROSSHAIR.on()) ci.cancel();
    }

    @Inject(method = "render", at = @At("HEAD"))
    private void poison$motionBlur(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        MotionBlur.apply(context);
    }
}
