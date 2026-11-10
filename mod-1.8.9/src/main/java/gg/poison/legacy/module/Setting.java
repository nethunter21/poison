package gg.poison.legacy.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

/** Module settings (ids match the launcher + 1.21.4 client so configs carry over). */
public abstract class Setting<T> {
    public final String id, label;
    protected T value;

    protected Setting(String id, String label, T def) { this.id = id; this.label = label; this.value = def; }
    public T get() { return value; }
    public void set(T v) { value = v; }
    public abstract JsonElement toJson();
    public abstract void fromJson(JsonElement e);

    public static class Bool extends Setting<Boolean> {
        public Bool(String id, String label, boolean def) { super(id, label, def); }
        public JsonElement toJson() { return new JsonPrimitive(value); }
        public void fromJson(JsonElement e) { if (e.isJsonPrimitive()) value = e.getAsBoolean(); }
    }

    public static class Num extends Setting<Double> {
        public final double min, max, step;
        public final String unit;
        public Num(String id, String label, double def, double min, double max, double step, String unit) {
            super(id, label, def); this.min = min; this.max = max; this.step = step; this.unit = unit;
        }
        public Num(String id, String label, double def, double min, double max, double step) { this(id, label, def, min, max, step, ""); }
        @Override public void set(Double v) {
            double s = Math.round((v - min) / step) * step + min;
            value = Math.max(min, Math.min(max, s));
        }
        public float f() { return value.floatValue(); }
        public String display() { return (step >= 1 ? String.valueOf(Math.round(value)) : String.format(step < 0.1 ? "%.2f" : "%.1f", value)) + unit; }
        public JsonElement toJson() { return new JsonPrimitive(value); }
        public void fromJson(JsonElement e) { if (e.isJsonPrimitive() && e.getAsJsonPrimitive().isNumber()) set(e.getAsDouble()); }
    }

    public static class Mode extends Setting<String> {
        public final String[] options;
        public Mode(String id, String label, String def, String... options) { super(id, label, def); this.options = options; }
        public void cycle(int dir) {
            int i = java.util.Arrays.asList(options).indexOf(value);
            value = options[Math.floorMod(i + dir, options.length)];
        }
        public boolean is(String s) { return value.equals(s); }
        public JsonElement toJson() { return new JsonPrimitive(value); }
        public void fromJson(JsonElement e) {
            if (!e.isJsonPrimitive()) return;
            String s = e.getAsString();
            for (String o : options) if (o.equals(s)) value = s;
        }
    }

    public static class Color extends Setting<Integer> {
        public static final int[] PALETTE = { 0xFFFF8A00, 0xFFFF2E88, 0xFFA855F7, 0xFF16C8FF, 0xFF00FF9D, 0xFFFFD23F, 0xFFFF1A1A, 0xFFFFFFFF };
        public Color(String id, String label, int def) { super(id, label, def); }
        public void cycle() {
            int i = 0;
            for (int k = 0; k < PALETTE.length; k++) if (PALETTE[k] == value) i = k + 1;
            value = PALETTE[i % PALETTE.length];
        }
        public JsonElement toJson() { return new JsonPrimitive(String.format("#%06x", value & 0xFFFFFF)); }
        public void fromJson(JsonElement e) {
            try { value = 0xFF000000 | Integer.parseInt(e.getAsString().replace("#", ""), 16); } catch (Exception ignored) { }
        }
    }
}
