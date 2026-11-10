package gg.poison.legacy;

import gg.poison.legacy.config.ConfigManager;
import gg.poison.legacy.gui.ClickGui;
import gg.poison.legacy.hud.Notifications;
import gg.poison.legacy.knife.KnifeAnimator;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.music.MusicPlayer;
import gg.poison.legacy.render.WorldFx;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.MinecraftClient;
import net.minecraft.item.ItemStack;
import net.minecraft.item.SwordItem;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.lwjgl.input.Keyboard;

public class PoisonLegacy implements ClientModInitializer {
    public static final Logger LOG = LogManager.getLogger("POISON");
    // default keys (no vanilla 1.8.9 conflicts): RShift menu, R flip, I inspect, Z zoom, [ ] \ music
    private static final int[] KEYS = { Keyboard.KEY_RSHIFT, Keyboard.KEY_R, Keyboard.KEY_I, Keyboard.KEY_LBRACKET, Keyboard.KEY_RBRACKET, Keyboard.KEY_BACKSLASH };
    private static final boolean[] DOWN = new boolean[KEYS.length];
    private static int lastSlot = -1;
    private static float lastAutoFlip, zoomCur = 1f;
    private static long lastFrame = System.nanoTime();
    private static boolean joined;

    @Override
    public void onInitializeClient() {
        ConfigManager.load();
        MusicPlayer.scan();
        LOG.info("POISON 1.8.9 client initialised: {} modules, {} tracks", Modules.ALL.size(), MusicPlayer.count());
    }

    private static float now() { return System.nanoTime() / 1_000_000_000f; }

    private static boolean pressed(int i) {
        boolean d = Keyboard.isKeyDown(KEYS[i]);
        boolean edge = d && !DOWN[i];
        DOWN[i] = d;
        return edge;
    }

    /** Called at the end of every client tick. */
    public static void tick() {
        MinecraftClient mc = MinecraftClient.getInstance();
        ConfigManager.tick();
        boolean inGame = mc.currentScreen == null;
        boolean[] e = new boolean[KEYS.length];
        for (int i = 0; i < KEYS.length; i++) e[i] = pressed(i) && inGame;
        if (e[0] && mc.player != null) mc.setScreen(new ClickGui());
        if (e[3]) MusicPlayer.prev();
        if (e[4]) MusicPlayer.next();
        if (e[5]) MusicPlayer.togglePause();
        if (!Modules.MUSIC_PLAYER.on() && MusicPlayer.current() != null && !MusicPlayer.isPaused()) MusicPlayer.stop();

        if (mc.player == null) { joined = false; return; }
        if (!joined) { joined = true; Notifications.push("POISON", "1.8.9 client loaded - Right Shift = menu", 0xFFFF8A00); }
        WorldFx.tick();
        ItemStack held = mc.player.getMainHandStack();
        boolean sword = held != null && held.getItem() instanceof SwordItem;
        KnifeAnimator anim = KnifeAnimator.INSTANCE;
        anim.setIdle(Modules.KNIFE_IDLE.get());
        float spd = Modules.KNIFE_SPEED.f();
        if (e[1] && sword && Modules.BUTTERFLY.on()) anim.flipShow(now(), spd);
        if (e[2] && sword && Modules.BUTTERFLY.on()) anim.inspect(now(), spd);
        int slot = mc.player.inventory.selectedSlot;
        if (slot != lastSlot) {
            if (lastSlot != -1 && sword && Modules.BUTTERFLY.on() && Modules.KNIFE_FLIP_SWAP.get() && !anim.busy(now())) anim.openFromClosed(now(), spd * 1.2f);
            lastSlot = slot;
        }
        float auto = Modules.KNIFE_AUTOFLIP.f();
        if (auto > 0 && sword && now() - lastAutoFlip > auto && !anim.busy(now())) { lastAutoFlip = now(); anim.flipShow(now(), spd); }
        if (Modules.TOGGLE_SPRINT.on() && inGame && mc.options.forwardKey.isPressed() && !mc.player.isSneaking()
                && !mc.player.isUsingItem() && mc.player.getHungerManager().getFoodLevel() > 6 && !mc.player.isSprinting())
            mc.player.setSprinting(true);
    }

    public static boolean isZooming() {
        MinecraftClient mc = MinecraftClient.getInstance();
        return Modules.ZOOM.on() && mc.currentScreen == null && Keyboard.isKeyDown(Keyboard.KEY_Z);
    }

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
