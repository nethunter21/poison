package gg.poison.client.util;

import java.util.Random;

/** SIMULATED price ticker for the HUD. A local random walk: not real prices, no network. */
public final class Ticker {
    public static final String[] SYMS = { "BTC", "ETH", "SOL", "DOGE", "XMR", "PSN", "BLOCK", "XP" };
    private static final double[] PRICE = { 97000, 3400, 190, 0.38, 180, 4.2, 0.69, 13.37 };
    private static final double[] OPEN = PRICE.clone();
    private static final double[] VOL = { 0.0016, 0.002, 0.003, 0.004, 0.0022, 0.006, 0.005, 0.004 };
    private static final Random RNG = new Random();
    private static long last;

    public static void tick() {
        long now = System.currentTimeMillis();
        if (now - last < 1500) return;
        last = now;
        for (int i = 0; i < PRICE.length; i++) PRICE[i] *= 1 + (i == 5 ? 0.0004 : 0.00005) + (RNG.nextDouble() - 0.5) * 2 * VOL[i];
    }

    public static double price(int i) { return PRICE[i]; }
    public static double change(int i) { return (PRICE[i] - OPEN[i]) / OPEN[i] * 100; }

    public static String fmt(double p) {
        if (p >= 1000) return String.format("%,.0f", p);
        if (p >= 1) return String.format("%.2f", p);
        return String.format("%.4f", p);
    }

    private Ticker() {}
}
