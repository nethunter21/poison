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
    public static final Module THEME = m("theme", "Theme", RENDER, true, "Client colour scheme for every glow, HUD and menu.");
    public static final Setting.Mode THEME_MODE = THEME.add(new Setting.Mode("mode", "Scheme", "mint", "mint", "poison", "toxic", "vapor", "gold", "blood", "ice", "rainbow"));
    public static final Setting.Mode HUD_LAYOUT = THEME.add(new Setting.Mode("layout", "HUD layout", "mint", "mint", "classic"));
    public static final Setting.Num GLOW = THEME.add(new Setting.Num("glow", "Glow intensity", 1, 0, 2, 0.05));
    public static final Module SCREEN_GLOW = m("screenglow", "Screen Glow", RENDER, true, "Neon vignette around the screen edges, pulses with the music.");
    public static final Setting.Num SCREEN_GLOW_AMOUNT = SCREEN_GLOW.add(new Setting.Num("amount", "Intensity", 0.3, 0.05, 1, 0.05));
    public static final Setting.Mode SCREEN_GLOW_MODE = SCREEN_GLOW.add(new Setting.Mode("ambience", "Ambience", "full", "full", "edges"));
    public static final Module ITEM_GLOW = m("itemglow", "Item Glow", RENDER, true, "Your held items glow like neon crystal (first person + your own F5 model).").bind(71 /* G */);
    public static final Setting.Num ITEM_GLOW_AMOUNT = ITEM_GLOW.add(new Setting.Num("amount", "Intensity", 0.55, 0.1, 1, 0.05));
    public static final Module BLOCK_OUTLINE = m("outline", "Block Outline", RENDER, true, "Glowing outline + fill on the block you look at.");
    public static final Setting.Bool OUTLINE_FILL = BLOCK_OUTLINE.add(new Setting.Bool("fill", "Fill", true));

    // ---------------- EFFECTS (self-only / feedback on your own hits) ----------------
    public static final Module JUMP_CIRCLES = m("jumpcircles", "Jump Circles", FX, true, "Glowing rings expand on the ground where you jump.");
    public static final Setting.Num JUMP_SIZE = JUMP_CIRCLES.add(new Setting.Num("size", "Size", 1.4, 0.5, 3, 0.1));
    public static final Module CHINA_HAT = m("chinahat", "China Hat", FX, true, "Gradient glow cone above your head (F5).");
    public static final Setting.Num HAT_SIZE = CHINA_HAT.add(new Setting.Num("size", "Size", 0.6, 0.3, 1.2, 0.05));
    public static final Module TRAILS = m("trail", "Trails", FX, true, "Glowing ribbon trail behind you.").bind(78 /* N */);
    public static final Setting.Num TRAIL_LENGTH = TRAILS.add(new Setting.Num("length", "Length", 40, 10, 120, 5));
    public static final Module AURA = m("aura", "Aura Ring", FX, false, "Rotating neon ring around your feet.");
    public static final Setting.Num AURA_RADIUS = AURA.add(new Setting.Num("radius", "Radius", 0.8, 0.4, 1.6, 0.05));
    public static final Module HIT_FX = m("hitfx", "Hit Effects", FX, true, "Glowing particle burst on things you hit (visual only).").bind(74 /* J */);
    public static final Setting.Mode HIT_STYLE = HIT_FX.add(new Setting.Mode("style", "Style", "crystal", "crystal", "sparks", "coins", "hearts", "hex"));
    public static final Setting.Num HIT_AMOUNT = HIT_FX.add(new Setting.Num("amount", "Particles", 18, 4, 60, 1));
    public static final Module KILL_FX = m("killfx", "Kill Effects", FX, true, "Effect when something you hit dies (visual only).");
    public static final Setting.Mode KILL_STYLE = KILL_FX.add(new Setting.Mode("fx", "Effect", "vortex", "vortex", "liquidation", "lightning", "confetti", "rekt"));

    public static final Module MOTION_BLUR = m("motionblur", "Motion Blur", RENDER, true, "Frame-accumulation motion blur. Smooth, cinematic, render-video look.").bind(77 /* M */);
    public static final Setting.Num MB_STRENGTH = MOTION_BLUR.add(new Setting.Num("trail", "Strength", 0.55, 0.05, 0.92, 0.01));
    public static final Setting.Bool MB_FPS_SCALE = MOTION_BLUR.add(new Setting.Bool("fpsscale", "FPS independent", true));

    public static final Module SELF_CHAMS = m("selfchams", "Self Chams", RENDER, true, "Glow fill + outline on your own player in third person. Self only.").bind(72 /* H */);
    public static final Setting.Mode SELF_CHAMS_STYLE = SELF_CHAMS.add(new Setting.Mode("style", "Style", "both", "both", "fill", "outline"));
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
    public static final Setting.Mode WATERMARK_STYLE = WATERMARK.add(new Setting.Mode("style", "Style", "glow", "glow", "box", "minimal"));
    public static final Module INFO_BAR = m("infobar", "Info Bar", HUD, true, "Top bar: ping, server, TPS, name, clock.");
    public static final Module MUSIC_CARD = m("musiccard", "Music Card", HUD, true, "Now-playing card with spinning vinyl and progress.");
    public static final Module KEYBINDS_HUD = m("keybinds", "Keybinds", HUD, true, "Panel listing modules you bound to keys (middle-click a module in the menu to bind).");
    public static final Module CUSTOM_HOTBAR = m("hotbar2", "Custom Hotbar", HUD, true, "Rounded hotbar, slim health/hunger bars, offhand + armor boxes.");
    public static final Setting.Bool HOTBAR_INV = CUSTOM_HOTBAR.add(new Setting.Bool("inventory", "Inventory preview", true));
    public static final Setting.Bool HOTBAR_HIDE_XP = CUSTOM_HOTBAR.add(new Setting.Bool("hidexp", "Hide XP bar", true));
    public static final Module CROSSHAIR = m("crosshair", "Custom Crosshair", HUD, true, "Glowing custom crosshair.");
    public static final Setting.Mode CROSSHAIR_STYLE = CROSSHAIR.add(new Setting.Mode("style", "Style", "cross-dot", "cross", "cross-dot", "circle", "diamond"));
    public static final Module ARRAYLIST = m("arraylist", "Array List", HUD, true, "Rainbow list of enabled modules.");
    public static final Setting.Mode ARRAY_COLOR = ARRAYLIST.add(new Setting.Mode("color", "Color", "wave", "wave", "accent", "rainbow"));
    public static final Setting.Bool ARRAY_BG = ARRAYLIST.add(new Setting.Bool("bg", "Background", true));
    public static final Setting.Bool ARRAY_GLOW = ARRAYLIST.add(new Setting.Bool("glow", "Glow", true));
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
    public static final Module LYRICS = m("lyrics", "Lyrics", Category.MUSIC, true, "Synced lyrics (.lrc) in a pill and as giant 3D text in the world.").bind(75 /* K */);
    public static final Setting.Bool LYRICS_3D = LYRICS.add(new Setting.Bool("world", "3D world lyrics", true));
    public static final Setting.Num LYRICS_SIZE = LYRICS.add(new Setting.Num("size", "3D size", 1, 0.4, 2, 0.05));
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
