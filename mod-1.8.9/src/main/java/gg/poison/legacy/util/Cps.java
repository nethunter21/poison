package gg.poison.legacy.util;

import java.util.ArrayDeque;

/** Click counter (display only). Fed by the attack/use hooks; "down" state polled from LWJGL. */
public final class Cps {
    private static final ArrayDeque<Long> LEFT = new ArrayDeque<Long>(), RIGHT = new ArrayDeque<Long>();

    public static synchronized void click(int button) {
        (button == 0 ? LEFT : RIGHT).add(System.currentTimeMillis());
    }
    public static synchronized int left() { prune(LEFT); return LEFT.size(); }
    public static synchronized int right() { prune(RIGHT); return RIGHT.size(); }
    public static boolean leftDown() { return org.lwjgl.input.Mouse.isButtonDown(0); }
    public static boolean rightDown() { return org.lwjgl.input.Mouse.isButtonDown(1); }

    private static void prune(ArrayDeque<Long> q) {
        long cut = System.currentTimeMillis() - 1000;
        while (!q.isEmpty() && q.peekFirst() < cut) q.pollFirst();
    }

    private Cps() {}
}
