package gg.poison.client.module;

import java.util.ArrayList;
import java.util.List;

import static gg.poison.client.module.Category.*;

/**
 * Every in-game POISON module. All are legit: visual, HUD, QoL or audio.
 * No combat or movement advantages. Chams only affect YOUR OWN player.
 */
public final class Modules {
    public static final List<Module> ALL = new ArrayList<>();

    private static Module m(String id, String name, Category c, boolean on, String desc) {
        Module mod = new Module(id, name, c, on, desc);
        ALL.add(mod);
        return mod;
    }

    // ---------------- RENDER ----------------
    public static final Module MOTION_BLUR = m("motionblur", "Motion Blur", RENDER, true, "Frame-accumulation motion blur. Smooth, cinematic, render-video look.");
    public static final Setting.Num MB_STRENGTH = MOTION_BLUR.add(new Setting.Num("trail", "Strength", 0.55, 0.05, 0.92, 0.01));
    public static final Setting.Bool MB_FPS_SCALE = MOTION_BLUR.add(new Setting.Bool("fpsscale", "FPS independent", true));

    public static final Module SELF_CHAMS = m("selfchams", "Self Chams", RENDER, true, "Glow outline on your own player in third person. Self only.");
    public static final Setting.Color SELF_CHAMS_COLOR = SELF_CHAMS.add(new Setting.Color("color", "Color", 0xFFA855F7));

    public static final Module ITEM_CHAMS = m("itemchams", "Item Chams", RENDER, true, "Neon glow shell on your held butterfly knife.");
    public static final Setting.Color ITEM_CHAMS_COLOR = ITEM_CHAMS.add(new Setting.Color("color", "Color", 0xFFFFB347));
    public static final Setting.Bool ITEM_CHAMS_RAINBOW = ITEM_CHAMS.add(new Setting.Bool("rainbow", "Rainbow", false));

    public static final Module TIME_CHANGER = m("timechanger", "Time Changer", RENDER, false, "Client-side time of day (visual only).");
    public static final Setting.Num TIME = TIME_CHANGER.add(new Setting.Num("time", "Time", 0.75, 0, 1, 0.01));

    public static final Module NO_HURT_CAM = m("nohurtcam", "No Hurt Cam", RENDER, false, "Removes the camera shake when you take damage.");
    public static final Module LOW_FIRE = m("lowfire", "Low Fire", RENDER, true, "Lowers the burning overlay.");
    public static final Setting.Num LOW_FIRE_HEIGHT = LOW_FIRE.add(new Setting.Num("height", "Lower by", 0.3, 0, 0.6, 0.05));

    // ---------------- ANIMATIONS ----------------
    public static final Module BUTTERFLY = m("butterfly", "Butterfly Knife", ANIM, true, "Every sword becomes an animated balisong. Visual only. F = flip, I = inspect.");
    public static final Setting.Mode KNIFE_SKIN = BUTTERFLY.add(new Setting.Mode("skin", "Skin", "knife_genesis",
            "knife_genesis", "knife_fade", "knife_sapphire", "knife_bull", "knife_bear", "knife_ledger", "knife_poison", "knife_hash", "knife_moon"));
    public static final Setting.Mode KNIFE_IDLE = BUTTERFLY.add(new Setting.Mode("idle", "Idle", "chatter", "still", "chatter", "twirl", "aerial"));
    public static final Setting.Num KNIFE_AUTOFLIP = BUTTERFLY.add(new Setting.Num("autoflip", "Auto-flip every", 0, 0, 30, 1, "s"));
    public static final Setting.Num KNIFE_SPEED = BUTTERFLY.add(new Setting.Num("speed", "Flip speed", 1, 0.3, 2.5, 0.05));
    public static final Setting.Bool KNIFE_FLIP_SWAP = BUTTERFLY.add(new Setting.Bool("flipOnSwap", "Flip open on swap", true));

    public static final Module ITEM_POS = m("itempos", "Item Position", ANIM, false, "Move and scale the held knife.");
    public static final Setting.Num ITEM_X = ITEM_POS.add(new Setting.Num("x", "X", 0, -0.5, 0.5, 0.01));
    public static final Setting.Num ITEM_Y = ITEM_POS.add(new Setting.Num("y", "Y", 0, -0.5, 0.5, 0.01));
    public static final Setting.Num ITEM_Z = ITEM_POS.add(new Setting.Num("z", "Z", 0, -0.5, 0.5, 0.01));
    public static final Setting.Num ITEM_SCALE = ITEM_POS.add(new Setting.Num("scale", "Scale", 1, 0.4, 1.8, 0.01));

    // ---------------- CAMERA ----------------
    public static final Module ZOOM = m("zoom", "Zoom", CAMERA, true, "Hold Z to zoom. Scroll while zooming to adjust.");
    public static final Setting.Num ZOOM_FACTOR = ZOOM.add(new Setting.Num("factor", "Zoom", 4, 2, 10, 0.5, "x"));
    public static final Setting.Bool ZOOM_SMOOTH = ZOOM.add(new Setting.Bool("smooth", "Smooth", true));

    // ---------------- HUD ----------------
    public static final Module WATERMARK = m("watermark", "Watermark", HUD, true, "Glowing POISON watermark.");
    public static final Module ARRAYLIST = m("arraylist", "Array List", HUD, true, "Rainbow list of enabled modules.");
    public static final Setting.Mode ARRAY_COLOR = ARRAYLIST.add(new Setting.Mode("color", "Color", "wave", "wave", "accent", "rainbow"));
    public static final Setting.Bool ARRAY_BG = ARRAYLIST.add(new Setting.Bool("bg", "Background", true));
    public static final Module FPS = m("fps", "FPS", HUD, true, "Frames per second.");
    public static final Module CPS = m("cps", "CPS", HUD, true, "Clicks per second (display only).");
    public static final Module PING = m("ping", "Ping", HUD, true, "Server latency.");
    public static final Module COORDS = m("coords", "Coordinates", HUD, true, "XYZ + facing.");
    public static final Module CLOCK = m("clock", "Clock", HUD, false, "Real-time clock.");
    public static final Module KEYSTROKES = m("keystrokes", "Keystrokes", HUD, true, "WASD / Space / LMB / RMB with CPS.");
    public static final Module ARMOR = m("armor", "Armor Status", HUD, true, "Armor + held item durability.");
    public static final Module NOW_PLAYING = m("nowplaying", "Now Playing", HUD, true, "Current POISON FM track.");
    public static final Module TICKER = m("tickerhud", "Crypto Ticker HUD", HUD, true, "Scrolling ticker. Simulated prices, not real.");

    // ---------------- MUSIC ----------------
    public static final Module MUSIC = m("musicplayer", "Music Player", Category.MUSIC, true, "In-game POISON FM + your own .ogg/.wav files. Keys: [ ] \\");
    public static final Setting.Num MUSIC_VOLUME = MUSIC.add(new Setting.Num("volume", "Volume", 0.6, 0, 1, 0.01));
    public static final Setting.Bool MUSIC_SHUFFLE = MUSIC.add(new Setting.Bool("shuffle", "Shuffle", false));
    public static final Setting.Bool MUSIC_AUTOPLAY = MUSIC.add(new Setting.Bool("autoplay", "Autoplay on join", false));
    public static final Module BEAT_SYNC = m("beatsync", "Beat-Reactive Glow", Category.MUSIC, true, "HUD glow pulses with the bass.");

    // ---------------- CRYPTO ----------------
    public static final Module GAS_METER = m("gasmeter", "Gas Meter", CRYPTO, true, "Shows your ping as gas, in gwei. Pure vibes.");
    public static final Module HODL = m("hodl", "HODL Mode", CRYPTO, true, "Q needs a double-press so you never drop your sword by accident.");

    // ---------------- UTILITY ----------------
    public static final Module TOGGLE_SPRINT = m("togglesprint", "Toggle Sprint", UTIL, true, "Keeps you sprinting while you move forward (same as vanilla's toggle option).");
    public static final Module NOTIFS = m("notifs", "Notifications", UTIL, true, "Toast when a module is toggled.");

    public static Module byId(String id) {
        for (Module mod : ALL) if (mod.id.equals(id)) return mod;
        return null;
    }

    private Modules() {}
}
