package gg.poison.client.render;

import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.VertexConsumers;
import net.minecraft.client.util.BufferAllocator;

/**
 * Neon "crystal" glow: every vertex drawn through {@link #wrap} is also written, in a flat
 * accent colour, into an additive buffer that is flushed AFTER the normal geometry —
 * so held items / your own model light up like glowing glass. Self-only by design.
 */
public final class GlowConsumers {
    private static final VertexConsumerProvider.Immediate GLOW = VertexConsumerProvider.immediate(new BufferAllocator(1 << 18));
    private static boolean pending;

    public static VertexConsumerProvider wrap(VertexConsumerProvider base, int argb) {
        pending = true;
        return layer -> VertexConsumers.union(base.getBuffer(layer), new Tint(GLOW.getBuffer(RenderLayer.getLightning()), argb));
    }

    /** Draw the queued glow (call after the base geometry has been drawn). */
    public static void flush() {
        if (!pending) return;
        pending = false;
        GLOW.draw();
    }

    /** Forwards positions, forces our colour; other attributes are ignored by the POSITION_COLOR layer. */
    private record Tint(VertexConsumer target, int argb) implements VertexConsumer {
        @Override public VertexConsumer vertex(float x, float y, float z) { target.vertex(x, y, z); return this; }
        @Override public VertexConsumer color(int r, int g, int b, int a) {
            target.color((argb >> 16) & 255, (argb >> 8) & 255, argb & 255, argb >>> 24); return this;
        }
        @Override public VertexConsumer texture(float u, float v) { return this; }
        @Override public VertexConsumer overlay(int u, int v) { return this; }
        @Override public VertexConsumer light(int u, int v) { return this; }
        @Override public VertexConsumer normal(float x, float y, float z) { return this; }
    }

    private GlowConsumers() {}
}
