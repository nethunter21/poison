package gg.poison.client.module;

public enum Category {
    RENDER("Render", "◈"), ANIM("Animations", "✦"), CAMERA("Camera", "◉"), HUD("HUD", "▦"),
    MUSIC("Music", "♫"), CRYPTO("Crypto", "₿"), UTIL("Utility", "⚙");

    public final String title, icon;
    Category(String title, String icon) { this.title = title; this.icon = icon; }
}
