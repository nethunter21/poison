package gg.poison.legacy.knife;

import java.util.HashMap;
import java.util.Map;

/**
 * Keyframe animator for the balisong — same clips and timings as the launcher preview
 * (launcher/js/knife.js). A one-shot clip layers over an idle loop; everything is a pure
 * function of time.
 */
public final class KnifeAnimator {
    public static final KnifeAnimator INSTANCE = new KnifeAnimator();

    public static final class Pose {
        public float px, py, pz, rx, ry, rz, a, b;
    }

    private static final float PI = (float) Math.PI, TAU = PI * 2;
    // key: t, px, py, pz, rx, ry, rz, a, b   (NaN = carry previous value)
    private static final float N = Float.NaN;

    private static final class Clip {
        final float dur; final boolean loop, linear; final float[][] keys;
        Clip(float dur, boolean loop, boolean linear, float[][] keys) { this.dur = dur; this.loop = loop; this.linear = linear; this.keys = keys; }
    }
    private static final Map<String, Clip> CLIPS = new HashMap<String, Clip>();

    private static void clip(String name, float dur, boolean loop, boolean linear, float[]... raw) {
        float[] prev = { 0, 0, 0, 0, 0, 0, 0, 0, 0 };
        float[][] keys = new float[raw.length][];
        for (int i = 0; i < raw.length; i++) {
            float[] k = new float[9];
            for (int f = 0; f < 9; f++) k[f] = f < raw[i].length && !Float.isNaN(raw[i][f]) ? raw[i][f] : (f == 0 ? 0 : prev[f]);
            keys[i] = prev = k;
        }
        CLIPS.put(name, new Clip(dur, loop, linear, keys));
    }

    static {
        //          t      px  py    pz    rx    ry    rz             a     b
        clip("idle_still", 2, true, false, new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, new float[] { 2 });
        clip("idle_chatter", 3.2f, true, false,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, new float[] { 1.6f },
            new float[] { 1.8f, N, N, N, N, N, 0.08f, N, 0.38f }, new float[] { 1.95f, N, N, N, N, N, 0, N, 0.05f },
            new float[] { 2.1f, N, N, N, N, N, 0.06f, N, 0.32f }, new float[] { 2.28f, N, N, N, N, N, 0, N, 0 }, new float[] { 3.2f });
        clip("idle_twirl", 0.9f, true, true,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, new float[] { 0.45f, N, N, N, N, N, -PI, N, 0.12f }, new float[] { 0.9f, N, N, N, N, N, -TAU, N, 0 });
        clip("idle_aerial", 3.4f, true, false,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, new float[] { 1.5f },
            new float[] { 1.75f, N, 0.55f, N, 0.4f, N, -PI, 0.7f, 0.3f },
            new float[] { 2.05f, N, 0.75f, N, 0, N, -TAU, 0.2f, 0.9f },
            new float[] { 2.35f, N, 0.2f, N, N, N, -TAU - PI, 0.6f, 0.4f },
            new float[] { 2.6f, N, 0, N, N, N, -2 * TAU, 0, 0 }, new float[] { 3.4f });
        clip("flip_open", 1.05f, false, false,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 1, 1 },
            new float[] { 0.16f, N, 0.06f, N, N, 0.5f, -0.9f, N, 0.55f },
            new float[] { 0.3f, N, N, N, N, 0.2f, -2.0f, N, 0.05f },
            new float[] { 0.46f, N, 0.1f, N, N, -0.3f, -3.4f, 0.55f, N },
            new float[] { 0.62f, N, N, N, N, 0, -4.9f, 0, 0.25f },
            new float[] { 0.8f, N, 0, N, N, N, -TAU, N, 0 },
            new float[] { 1.05f, N, N, N, N, N, -TAU, 0, 0 });
        clip("flip_close", 0.9f, false, false,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
            new float[] { 0.2f, N, N, N, N, 0.4f, 1.4f, N, 0.6f },
            new float[] { 0.38f, N, N, N, N, N, 2.8f, N, 1 },
            new float[] { 0.6f, N, N, N, N, -0.2f, 4.4f, 0.6f, N },
            new float[] { 0.8f, N, N, N, N, 0, TAU, 1, N }, new float[] { 0.9f });
        clip("inspect", 3.6f, false, false,
            new float[] { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
            new float[] { 0.5f, -0.1f, 0.08f, 0.12f, N, 1.25f, 0.35f },
            new float[] { 1.4f, N, N, N, N, 1.45f, 0.25f },
            new float[] { 1.9f, N, N, N, 0.2f, -1.3f, -0.3f },
            new float[] { 2.6f, N, N, N, N, -1.45f, -0.2f, N, 0.3f },
            new float[] { 2.85f, N, N, N, N, 0, -TAU - 0.2f, N, 0 },
            new float[] { 3.6f, 0, 0, 0, 0, 0, -TAU });
    }

    private String idle = "idle_chatter", shot;
    private float shotStart, speed = 1;
    private boolean closed;
    private Runnable after;

    public void setIdle(String name) { idle = "idle_" + name; }
    public boolean isClosed() { return closed; }

    public boolean busy(float now) {
        return shot != null && (now - shotStart) * speed < CLIPS.get(shot).dur;
    }

    public void play(String name, float now, float spd, Runnable then) {
        shot = name; shotStart = now; speed = spd; after = then;
    }

    public void flip(float now, float spd) {
        if (busy(now)) return;
        play(closed ? "flip_open" : "flip_close", now, spd, null);
    }

    /** Close then re-open: the classic show-off flip. */
    public void flipShow(float now, final float spd) {
        if (busy(now)) return;
        if (closed) play("flip_open", now, spd, null);
        else play("flip_close", now, spd, new Runnable() { public void run() { play("flip_open", now(), spd, null); } });
    }

    public void inspect(float now, final float spd) {
        if (busy(now)) return;
        if (closed) play("flip_open", now, 1.2f, new Runnable() { public void run() { play("inspect", now(), spd, null); } });
        else play("inspect", now, spd, null);
    }

    public void openFromClosed(float now, float spd) {
        closed = true;
        play("flip_open", now, spd, null);
    }

    private static float now() { return System.nanoTime() / 1_000_000_000f; }

    public Pose sample(float now) {
        if (shot != null) {
            Clip c = CLIPS.get(shot);
            float local = (now - shotStart) * speed;
            if (local < c.dur) return eval(c, local);
            if (shot.equals("flip_close")) closed = true;
            if (shot.equals("flip_open")) closed = false;
            shot = null;
            if (after != null) { Runnable r = after; after = null; r.run(); }
            if (shot != null) return sample(now);
        }
        if (closed) { Pose p = new Pose(); p.a = 1; p.b = 1; return p; }
        Clip idleClip = CLIPS.containsKey(idle) ? CLIPS.get(idle) : CLIPS.get("idle_still");
        return eval(idleClip, now);
    }

    private static Pose eval(Clip c, float t) {
        t = c.loop ? ((t % c.dur) + c.dur) % c.dur : Math.max(0, Math.min(c.dur, t));
        float[][] k = c.keys;
        int i = 0;
        while (i < k.length - 2 && t > k[i + 1][0]) i++;
        float[] k0 = k[i], k1 = k[Math.min(i + 1, k.length - 1)];
        float span = k1[0] - k0[0];
        float u = span <= 0 ? 1 : Math.max(0, Math.min(1, (t - k0[0]) / span));
        if (!c.linear) u = u < 0.5f ? 4 * u * u * u : 1 - (float) Math.pow(-2 * u + 2, 3) / 2;
        Pose p = new Pose();
        float[] v = new float[9];
        for (int f = 1; f < 9; f++) v[f] = k0[f] + (k1[f] - k0[f]) * u;
        p.px = v[1]; p.py = v[2]; p.pz = v[3]; p.rx = v[4]; p.ry = v[5]; p.rz = v[6]; p.a = v[7]; p.b = v[8];
        return p;
    }

    private KnifeAnimator() {}
}
