package gg.poison.client;

import gg.poison.client.config.ConfigManager;
import gg.poison.client.gui.ClickGuiScreen;
import gg.poison.client.hud.Hud;
import gg.poison.client.hud.Notifications;
import gg.poison.client.knife.KnifeAnimator;
import gg.poison.client.module.Modules;
import gg.poison.client.music.MusicPlayer;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.fabricmc.fabric.api.resource.ResourcePackActivationType;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PoisonClient implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("POISON");
    private static final String CAT = "key.categories.poison";

    private static KeyBinding menuKey, flipKey, inspectKey, zoomKey, musicNext, musicPrev, musicPause;
    private static float zoomCur = 1f;
    private static long lastFrame = System.nanoTime();
    private static int lastSlot = -1;
    private static float lastAutoFlip;

    @Override
    public void onInitializeClient() {
        ConfigManager.load();
        MusicPlayer.scan();

        menuKey = reg("key.poison.menu", GLFW.GLFW_KEY_RIGHT_SHIFT);
        flipKey = reg("key.poison.flip", GLFW.GLFW_KEY_R);
        inspectKey = reg("key.poison.inspect", GLFW.GLFW_KEY_I);
        zoomKey = reg("key.poison.zoom", GLFW.GLFW_KEY_Z); // C is taken by vanilla (save toolbar)
        musicPrev = reg("key.poison.music_prev", GLFW.GLFW_KEY_LEFT_BRACKET);
        musicNext = reg("key.poison.music_next", GLFW.GLFW_KEY_RIGHT_BRACKET);
        musicPause = reg("key.poison.music_pause", GLFW.GLFW_KEY_BACKSLASH);

        HudRenderCallback.EVENT.register((ctx, tick) -> Hud.render(ctx));
        ClientTickEvents.END_CLIENT_TICK.register(PoisonClient::tick);
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            Notifications.push("☠ POISON", "client loaded · Right Shift = menu", 0xFFFF8A00);
            if (Modules.MUSIC.on() && Modules.MUSIC_AUTOPLAY.get() && MusicPlayer.current() == null) MusicPlayer.next();
        });

        // inventory / third-person balisong model (toggle under Options → Resource Packs)
        FabricLoader.getInstance().getModContainer("poison").ifPresent(c ->
            ResourceManagerHelper.registerBuiltinResourcePack(Identifier.of("poison", "balisong"), c,
                Text.literal("POISON Balisong"), ResourcePackActivationType.DEFAULT_ENABLED));
        LOG.info("POISON client initialised: {} modules, {} tracks", Modules.ALL.size(), MusicPlayer.count());
    }

    private static KeyBinding reg(String id, int key) {
        return KeyBindingHelper.registerKeyBinding(new KeyBinding(id, InputUtil.Type.KEYSYM, key, CAT));
    }

    private static float now() { return System.nanoTime() / 1_000_000_000f; }

    private static void tick(MinecraftClient mc) {
        ConfigManager.tick();
        while (menuKey.wasPressed()) if (mc.currentScreen == null) mc.setScreen(new ClickGuiScreen());
        while (musicNext.wasPressed()) MusicPlayer.next();
        while (musicPrev.wasPressed()) MusicPlayer.prev();
        while (musicPause.wasPressed()) MusicPlayer.togglePause();
        if (!Modules.MUSIC.on() && MusicPlayer.current() != null && !MusicPlayer.isPaused()) MusicPlayer.stop();

        if (mc.player == null) return;
        boolean holdingSword = mc.player.getMainHandStack().isIn(ItemTags.SWORDS);
        KnifeAnimator anim = KnifeAnimator.INSTANCE;
        anim.setIdle(Modules.KNIFE_IDLE.get());
        float spd = Modules.KNIFE_SPEED.f();
        while (flipKey.wasPressed()) if (holdingSword && Modules.BUTTERFLY.on()) anim.flipShow(now(), spd);
        while (inspectKey.wasPressed()) if (holdingSword && Modules.BUTTERFLY.on()) anim.inspect(now(), spd);

        int slot = mc.player.getInventory().selectedSlot;
        if (slot != lastSlot) {
            if (lastSlot != -1 && holdingSword && Modules.BUTTERFLY.on() && Modules.KNIFE_FLIP_SWAP.get() && !anim.busy(now()))
                anim.openFromClosed(now(), spd * 1.2f);
            lastSlot = slot;
        }
        float auto = Modules.KNIFE_AUTOFLIP.f();
        if (auto > 0 && holdingSword && now() - lastAutoFlip > auto && !anim.busy(now())) {
            lastAutoFlip = now();
            anim.flipShow(now(), spd);
        }

        if (Modules.TOGGLE_SPRINT.on() && mc.currentScreen == null) {
            boolean canSprint = mc.options.forwardKey.isPressed() && !mc.player.isSneaking() && !mc.player.isUsingItem();
            if (canSprint && !mc.player.isSprinting()) mc.player.setSprinting(true);
        }
    }

    public static boolean isZooming() { return Modules.ZOOM.on() && zoomKey != null && zoomKey.isPressed(); }

    /** Smoothed zoom divisor, updated per frame. */
    public static float zoomFactor() {
        long t = System.nanoTime();
        float dt = Math.min(0.1f, (t - lastFrame) / 1e9f);
        lastFrame = t;
        float target = isZooming() ? Modules.ZOOM_FACTOR.f() : 1f;
        if (Modules.ZOOM_SMOOTH.get()) zoomCur += (target - zoomCur) * (1 - (float) Math.exp(-dt * 14));
        else zoomCur = target;
        if (Math.abs(zoomCur - 1f) < 0.002f) zoomCur = 1f;
        return zoomCur;
    }
}
