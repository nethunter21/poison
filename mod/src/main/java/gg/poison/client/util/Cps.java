package gg.poison.client.util;

import java.util.ArrayDeque;

/** Click counter fed by the mouse mixin (display only). */
public final class Cps {
    private static final ArrayDeque<Long> LEFT = new ArrayDeque<>(), RIGHT = new ArrayDeque<>();
    public static boolean leftDown, rightDown;

    public static synchronized void click(int button, boolean down) {
        if (button == 0) leftDown = down;
        if (button == 1) rightDown = down;
        if (!down) return;
        if (button == 0) LEFT.add(System.currentTimeMillis());
        if (button == 1) RIGHT.add(System.currentTimeMillis());
    }

    public static synchronized int left() { prune(LEFT); return LEFT.size(); }
    public static synchronized int right() { prune(RIGHT); return RIGHT.size(); }

    private static void prune(ArrayDeque<Long> q) {
        long cut = System.currentTimeMillis() - 1000;
        while (!q.isEmpty() && q.peekFirst() < cut) q.pollFirst();
    }

    private Cps() {}
}
