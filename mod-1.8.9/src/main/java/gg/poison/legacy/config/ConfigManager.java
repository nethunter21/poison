package gg.poison.legacy.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import gg.poison.legacy.PoisonLegacy;
import gg.poison.legacy.module.Module;
import gg.poison.legacy.module.Modules;
import gg.poison.legacy.module.Setting;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Saves module state to config/poison.json. On startup, if the launcher wrote a newer
 * poison-config.json (same module/setting ids), those values are applied first, so what you
 * set in the launcher is what you get in game.
 */
public final class ConfigManager {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("poison.json");
    private static final Path LAUNCHER_FILE = FabricLoader.getInstance().getGameDir().resolve("poison-config.json");
    public static final Map<String, int[]> PANELS = new HashMap<>();
    private static String launcherStamp = "";
    private static boolean dirty;
    private static long lastSave;

    public static void load() {
        try {
            if (Files.exists(FILE)) {
                JsonObject root = new JsonParser().parse(new String(Files.readAllBytes(FILE), StandardCharsets.UTF_8)).getAsJsonObject();
                if (root.has("launcherStamp")) launcherStamp = root.get("launcherStamp").getAsString();
                applyModules(root.getAsJsonObject("modules"), "settings");
                if (root.has("panels")) for (Map.Entry<String, JsonElement> e : root.getAsJsonObject("panels").entrySet()) {
                    com.google.gson.JsonArray a = e.getValue().getAsJsonArray();
                    PANELS.put(e.getKey(), new int[] { a.get(0).getAsInt(), a.get(1).getAsInt(), a.size() > 2 ? a.get(2).getAsInt() : 0 });
                }
            }
        } catch (Exception ex) {
            PoisonLegacy.LOG.warn("Could not read poison.json, using defaults", ex);
        }
        importLauncher();
        save();
    }

    /** Pull settings from the launcher's export when it is newer than what we last imported. */
    private static void importLauncher() {
        try {
            if (!Files.exists(LAUNCHER_FILE)) return;
            JsonObject cfg = new JsonParser().parse(new String(Files.readAllBytes(LAUNCHER_FILE), StandardCharsets.UTF_8)).getAsJsonObject();
            String stamp = cfg.has("exported") ? cfg.get("exported").getAsString() : "";
            if (stamp.isEmpty() || stamp.equals(launcherStamp)) return;
            launcherStamp = stamp;
            if (cfg.has("modules")) applyModules(cfg.getAsJsonObject("modules"), "s");
            if (cfg.has("equipped")) {
                JsonObject eq = cfg.getAsJsonObject("equipped");
                if (eq.has("knife")) Modules.KNIFE_SKIN.fromJson(eq.get("knife"));
            }
            PoisonLegacy.LOG.info("Imported POISON launcher config ({})", stamp);
        } catch (Exception ex) {
            PoisonLegacy.LOG.warn("Could not import launcher config", ex);
        }
    }

    private static void applyModules(JsonObject modules, String settingsKey) {
        if (modules == null) return;
        for (Module m : Modules.ALL) {
            if (!modules.has(m.id) || !modules.get(m.id).isJsonObject()) continue;
            JsonObject o = modules.getAsJsonObject(m.id);
            if (o.has("on")) m.setEnabled(o.get("on").getAsBoolean());
            if (o.has(settingsKey) && o.get(settingsKey).isJsonObject()) {
                JsonObject s = o.getAsJsonObject(settingsKey);
                for (Setting<?> set : m.settings) if (s.has(set.id)) set.fromJson(s.get(set.id));
            }
        }
    }

    public static void markDirty() { dirty = true; }

    /** Called every tick; writes at most once a second. */
    public static void tick() {
        if (dirty && System.currentTimeMillis() - lastSave > 1000) save();
    }

    public static void save() {
        dirty = false;
        lastSave = System.currentTimeMillis();
        JsonObject root = new JsonObject();
        root.addProperty("launcherStamp", launcherStamp);
        JsonObject mods = new JsonObject();
        for (Module m : Modules.ALL) {
            JsonObject o = new JsonObject();
            o.addProperty("on", m.on());
            JsonObject s = new JsonObject();
            for (Setting<?> set : m.settings) s.add(set.id, set.toJson());
            o.add("settings", s);
            mods.add(m.id, o);
        }
        root.add("modules", mods);
        JsonObject panels = new JsonObject();
        for (Map.Entry<String, int[]> pe : PANELS.entrySet()) { String k = pe.getKey(); int[] v = pe.getValue();
            com.google.gson.JsonArray a = new com.google.gson.JsonArray();
            for (int i : v) a.add(new com.google.gson.JsonPrimitive(i));
            panels.add(k, a);
        }
        root.add("panels", panels);
        try {
            Files.createDirectories(FILE.getParent());
            Files.write(FILE, GSON.toJson(root).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            PoisonLegacy.LOG.warn("Could not save poison.json", ex);
        }
    }

    private ConfigManager() {}
}
