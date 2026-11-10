package gg.poison.legacy.music;

import gg.poison.legacy.PoisonLegacy;
import gg.poison.legacy.hud.Notifications;
import gg.poison.legacy.module.Modules;
import net.fabricmc.loader.api.FabricLoader;
import paulscode.sound.SoundBuffer;
import paulscode.sound.codecs.CodecJOrbis;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.SourceDataLine;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * POISON FM for 1.8.9: bundled tracks + your own .ogg/.wav in &lt;game dir&gt;/poison/music.
 * OGG decoding uses the JOrbis codec that ships with 1.8.9's sound system.
 */
public final class MusicPlayer {
    private static final class Track {
        final String title; final URL url;
        Track(String title, URL url) { this.title = title; this.url = url; }
    }

    private static final List<Track> TRACKS = new ArrayList<Track>();
    private static final Random RNG = new Random();
    private static volatile int index = -1;
    private static volatile boolean paused = true, skip, running;
    private static volatile int skipDir = 1;
    private static volatile float level;
    private static final float[] BANDS = new float[6];
    private static Thread thread;

    public static File userDir() { return new File(FabricLoader.getInstance().getGameDir().toFile(), "poison" + File.separator + "music"); }

    public static void scan() {
        TRACKS.clear();
        try {
            InputStream in = MusicPlayer.class.getResourceAsStream("/assets/poison/music/index.txt");
            if (in != null) {
                byte[] all = readAll(in);
                for (String line : new String(all, StandardCharsets.UTF_8).split("\n")) {
                    String[] kv = line.trim().split("=", 2);
                    if (kv.length == 2) TRACKS.add(new Track(kv[1], MusicPlayer.class.getResource("/assets/poison/music/" + kv[0])));
                }
            }
        } catch (Exception e) { PoisonLegacy.LOG.warn("music index", e); }
        File dir = userDir();
        dir.mkdirs();
        File[] files = dir.listFiles();
        if (files != null) {
            Arrays.sort(files);
            for (File f : files) {
                String n = f.getName().toLowerCase();
                if (n.endsWith(".ogg") || n.endsWith(".wav")) {
                    try { TRACKS.add(new Track(f.getName().replaceFirst("\\.[^.]+$", ""), f.toURI().toURL())); } catch (Exception ignored) { }
                }
            }
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) out.write(b, 0, n);
        in.close();
        return out.toByteArray();
    }

    public static String current() { int i = index; return i >= 0 && i < TRACKS.size() ? TRACKS.get(i).title : null; }
    public static boolean isPaused() { return paused; }
    public static float level() { return level; }
    public static float[] bands() { return BANDS; }
    public static int count() { return TRACKS.size(); }

    public static void togglePause() {
        if (!Modules.MUSIC_PLAYER.on() || TRACKS.isEmpty()) return;
        if (index < 0) { next(); return; }
        paused = !paused;
        Notifications.push("POISON FM", paused ? "paused" : "playing " + current(), 0xFFFF8A00);
    }
    public static void next() { change(1); }
    public static void prev() { change(-1); }
    public static void stop() { running = false; paused = true; }

    private static void change(int dir) {
        if (!Modules.MUSIC_PLAYER.on() || TRACKS.isEmpty()) return;
        skipDir = dir;
        paused = false;
        if (thread == null || !thread.isAlive()) {
            index = pick(index, dir);
            running = true;
            thread = new Thread(new Runnable() { public void run() { loop(); } }, "POISON-FM");
            thread.setDaemon(true);
            thread.start();
        } else skip = true;
    }

    private static int pick(int from, int dir) {
        if (Modules.MUSIC_SHUFFLE.get() && TRACKS.size() > 1) {
            int n; do { n = RNG.nextInt(TRACKS.size()); } while (n == from);
            return n;
        }
        return Math.floorMod(from + dir, TRACKS.size());
    }

    private static void loop() {
        int failures = 0;
        while (running) {
            int i = index;
            if (i < 0 || i >= TRACKS.size()) break;
            Track t = TRACKS.get(i);
            if (failures >= 3) { Notifications.push("POISON FM", "stopped after repeated errors", 0xFFFF2E55); break; }
            Notifications.push("POISON FM", "playing " + t.title, 0xFFFF8A00);
            try {
                playOne(t);
                failures = 0;
            } catch (IllegalArgumentException e) {
                PoisonLegacy.LOG.warn("No audio output for POISON FM: {}", e.getMessage());
                Notifications.push("POISON FM", "no audio output device available", 0xFFFF2E55);
                break;
            } catch (Exception e) {
                PoisonLegacy.LOG.warn("Could not play " + t.title, e);
                failures++;
            }
            if (!running) break;
            if (!Modules.MUSIC_PLAYER.on()) break;
            int dir = skip ? skipDir : 1;
            skip = false;
            index = pick(index, dir);
        }
        running = false;
        paused = true;
        level = 0;
    }

    private static void playOne(Track t) throws Exception {
        if (t.url.getPath().toLowerCase().endsWith(".wav")) {
            AudioInputStream ais = AudioSystem.getAudioInputStream(new BufferedInputStream(t.url.openStream()));
            AudioFormat src = ais.getFormat();
            AudioFormat pcm = new AudioFormat(AudioFormat.Encoding.PCM_SIGNED, src.getSampleRate(), 16, src.getChannels(), src.getChannels() * 2, src.getSampleRate(), false);
            final AudioInputStream conv = AudioSystem.getAudioInputStream(pcm, ais);
            final byte[] buf = new byte[8192];
            try {
                stream(pcm, new Source() { public byte[] next() throws Exception { int n = conv.read(buf); return n <= 0 ? null : Arrays.copyOf(buf, n); } });
            } finally { conv.close(); ais.close(); }
        } else {
            final CodecJOrbis codec = new CodecJOrbis();
            if (!codec.initialize(t.url)) throw new IllegalStateException("cannot decode " + t.title);
            try {
                stream(codec.getAudioFormat(), new Source() {
                    public byte[] next() {
                        if (codec.endOfStream()) return null;
                        SoundBuffer b = codec.read();
                        return b == null ? null : b.audioData;
                    }
                });
            } finally { codec.cleanup(); }
        }
    }

    private interface Source { byte[] next() throws Exception; }

    private static void stream(AudioFormat fmt, Source src) throws Exception {
        SourceDataLine line = (SourceDataLine) AudioSystem.getLine(new DataLine.Info(SourceDataLine.class, fmt));
        line.open(fmt, (int) (fmt.getSampleRate() * fmt.getFrameSize() / 5));
        line.start();
        boolean big = fmt.isBigEndian();
        int ch = fmt.getChannels();
        float[] lp = new float[BANDS.length];
        float[] cut = { 0.01f, 0.03f, 0.07f, 0.15f, 0.3f, 0.6f };
        try {
            while (running && !skip && Modules.MUSIC_PLAYER.on()) {
                if (paused) { line.stop(); Thread.sleep(50); level *= 0.8f; continue; }
                if (!line.isRunning()) line.start();
                byte[] b = src.next();
                if (b == null) break;
                int n = b.length & ~1;
                float vol = Modules.MUSIC_VOLUME.f();
                float[] energy = new float[BANDS.length];
                int samples = 0;
                for (int k = 0; k < n; k += 2) {
                    int lo = b[big ? k + 1 : k] & 0xFF, hi = b[big ? k : k + 1];
                    float s = (short) ((hi << 8) | lo) / 32768f;
                    if ((k / 2) % ch == 0) {
                        float prev = 0;
                        for (int f = 0; f < lp.length; f++) {
                            lp[f] += (s - lp[f]) * cut[f];
                            float band = lp[f] - prev;
                            energy[f] += band * band;
                            prev = lp[f];
                        }
                        samples++;
                    }
                    int v = Math.max(-32768, Math.min(32767, Math.round(s * vol * 32767)));
                    b[big ? k + 1 : k] = (byte) v;
                    b[big ? k : k + 1] = (byte) (v >> 8);
                }
                if (samples > 0) {
                    for (int f = 0; f < BANDS.length; f++) {
                        float e = (float) Math.sqrt(energy[f] / samples) * (3f + f * 2f);
                        BANDS[f] = e > BANDS[f] ? e : BANDS[f] * 0.85f;
                    }
                    float bass = Math.min(1, Math.max(0, (BANDS[0] + BANDS[1]) * 0.9f - 0.15f));
                    level = bass > level ? bass : level * 0.88f;
                }
                line.write(b, 0, n);
            }
            if (!skip && running) line.drain();
        } finally {
            line.stop(); line.flush(); line.close();
        }
    }

    private MusicPlayer() {}
}
