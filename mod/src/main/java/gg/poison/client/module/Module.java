package gg.poison.client.module;

import java.util.ArrayList;
import java.util.List;

public class Module {
    public final String id, name, description;
    public final Category category;
    public final List<Setting<?>> settings = new ArrayList<>();
    private boolean enabled;

    public Module(String id, String name, Category category, boolean on, String description) {
        this.id = id; this.name = name; this.category = category; this.enabled = on; this.description = description;
    }

    public <S extends Setting<?>> S add(S s) { settings.add(s); return s; }
    public boolean on() { return enabled; }
    public void setEnabled(boolean v) { enabled = v; }
    public void toggle() { enabled = !enabled; }
    public Setting<?> setting(String sid) {
        for (Setting<?> s : settings) if (s.id.equals(sid)) return s;
        return null;
    }
}
