package gg.poison.legacy.module;

public enum Category {
    RENDER("Render"), FX("Effects"), ANIM("Animations"), CAMERA("Camera"), HUD("HUD"), MUSIC("Music"), CRYPTO("Crypto"), UTIL("Utility");

    public final String title;
    Category(String title) { this.title = title; }
}
