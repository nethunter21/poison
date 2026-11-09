package gg.poison.client.mixin;

import gg.poison.client.PoisonClient;
import gg.poison.client.module.Modules;
import gg.poison.client.util.Cps;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public class MouseMixin {
    /** CPS counter (display only — nothing is ever clicked for you). */
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void poison$cps(long window, int button, int action, int mods, CallbackInfo ci) {
        if (MinecraftClient.getInstance().currentScreen == null && window == MinecraftClient.getInstance().getWindow().getHandle())
            Cps.click(button, action == 1);
    }

    /** Scroll while zooming adjusts the zoom instead of the hotbar. */
    @Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true)
    private void poison$zoomScroll(long window, double horizontal, double vertical, CallbackInfo ci) {
        if (PoisonClient.isZooming() && MinecraftClient.getInstance().currentScreen == null) {
            Modules.ZOOM_FACTOR.set(Modules.ZOOM_FACTOR.get() + Math.signum(vertical) * 0.5);
            ci.cancel();
        }
    }
}
