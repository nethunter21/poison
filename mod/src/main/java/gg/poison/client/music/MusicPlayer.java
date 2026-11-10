package gg.poison.client.music;

import gg.poison.client.PoisonClient;
import gg.poison.client.hud.Notifications;
import gg.poison.client.module.Modules;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.sound.OggAudioStream;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.SourceDataLine;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.stream.Stream;

/**
 * In-game music player. Plays the bundled POISON FM tracks (the same tracks the launcher
 * synthesizes) plus any .ogg / .wav you drop in &lt;game dir&gt;/poison/music. Audio runs on its own
 * thread straight to the sound card, independent of Minecraft's music volume, and a cheap
 * filter bank feeds the beat-reactive HUD glow.
 */
public final class MusicPlayer {
    private record Track(String title, String resource, Path file, double duration, List<Lyric> lyrics) {}
    /** One timed lyric line (seconds). */
    public record Lyric(double time, String text) {}

    private static final List<Track> TRACKS = new ArrayList<>();
    private static final Random RNG = new Random();
    private static volatile int index = -1;
    private static volatile boolean paused = true, skip, running;
    private static volatile int skipDir = 1;
    private static volatile float level;
    private static final float[] BANDS = new float[6];
    private static Thread thread;

    public static Path userDir() { return FabricLoader.getInstance().getGameDir().resolve("poison").resolve("music"); }

    public static void scan() {
        TRACKS.clear();
        try (InputStream in = MusicPlayer.class.getResourceAsStream("/assets/poison/music/index.txt")) {
            if (in != null) for (String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\n")) {
                String[] kv = line.trim().split("=", 2);
                if (kv.length != 2) continue;
                String[] td = kv[1].split("\\|", 2);
                double dur = td.length > 1 ? parseD(td[1]) : 0;
                String res = "/assets/poison/music/" + kv[0];
                String lrc = res.replaceFirst("\\.[^.]+$", ".lrc");
                TRACKS.add(new Track(td[0], res, null, dur, parseLrc(MusicPlayer.class.getResourceAsStream(lrc))));
            }
        } catch (Exception e) { PoisonClient.LOG.warn("music index", e); }
        try {
            Files.createDirectories(userDir());
            try (Stream<Path> s = Files.list(userDir())) {
                s.filter(p -> { String n = p.getFileName().toString().toLowerCase(); return n.endsWith(".ogg") || n.endsWith(".wav"); })
                 .sorted().forEach(p -> {
                     Path lrc = p.resolveSibling(p.getFileName().toString().replaceFirst("\\.[^.]+$", ".lrc"));
                     List<Lyric> ly = List.of();
                     try { if (Files.exists(lrc)) ly = parseLrc(Files.newInputStream(lrc)); } catch (Exception ignored) { }
                     TRACKS.add(new Track(p.getFileName().toString().replaceFirst("\\.[^.]+$", ""), null, p, wavDuration(p), ly));
                 });
            }
        } catch (Exception e) { PoisonClient.LOG.warn("music folder", e); }
    }

    private static double parseD(String s) { try { return Double.parseDouble(s.trim()); } catch (Exception e) { return 0; } }

    private static double wavDuration(Path p) {
        if (!p.toString().toLowerCase().endsWith(".wav")) return 0;
        try (AudioInputStream a = AudioSystem.getAudioInputStream(p.toFile())) {
            return a.getFrameLength() / (double) a.getFormat().getFrameRate();
        } catch (Exception e) { return 0; }
    }

    /** Parse an .lrc file: lines like "[01:23.45]text" (several time tags per line allowed). */
    static List<Lyric> parseLrc(InputStream in) {
        List<Lyric> out = new ArrayList<>();
        if (in == null) return out;
        try (in) {
            java.util.regex.Pattern tag = java.util.regex.Pattern.compile("\\[(\\d+):(\\d+(?:[.:]\\d+)?)\\]");
            for (String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\\r?\\n")) {
                java.util.regex.Matcher m = tag.matcher(line);
                List<Double> times = new ArrayList<>();
                int end = 0;
                while (m.find() && m.start() == end) {
                    times.add(Integer.parseInt(m.group(1)) * 60 + parseD(m.group(2).replace(':', '.')));
                    end = m.end();
                }
                String text = line.substring(end).trim();
                for (double t : times) if (!text.isEmpty()) out.add(new Lyric(t, text));
            }
        } catch (Exception ignored) { }
        out.sort(java.util.Comparator.comparingDouble(Lyric::time));
        return out;
    }

    private static volatile SourceDataLine liveLine;

    /** Seconds played in the current track (from the audio line's own clock). */
    public static double position() {
        SourceDataLine l = liveLine;
        return l != null ? l.getMicrosecondPosition() / 1e6 : 0;
    }
    public static double duration() { int i = index; return i >= 0 && i < TRACKS.size() ? TRACKS.get(i).duration() : 0; }
    public static String artist() { int i = index; return i >= 0 && i < TRACKS.size() ? (TRACKS.get(i).file() == null ? "POISON FM" : "Local file") : ""; }

    /** Current lyric line, or null. */
    public static Lyric lyric() { return lyricAt(0); }
    /** Lyric line offset from the current one (0 = current, 1 = next). */
    public static Lyric lyricAt(int offset) {
        int i = index;
        if (i < 0 || i >= TRACKS.size() || paused) return null;
        List<Lyric> ly = TRACKS.get(i).lyrics();
        double t = position();
        int cur = -1;
        for (int k = 0; k < ly.size(); k++) if (ly.get(k).time() <= t) cur = k;
        int want = cur + offset;
        return cur >= 0 && want < ly.size() ? ly.get(want) : null;
    }

    public static String current() {
        int i = index;
        return i >= 0 && i < TRACKS.size() ? TRACKS.get(i).title : null;
    }
    public static boolean isPaused() { return paused; }
    public static float level() { return level; }
    public static float[] bands() { return BANDS; }
    public static int count() { return TRACKS.size(); }

    public static void togglePause() {
        if (!Modules.MUSIC.on() || TRACKS.isEmpty()) return;
        if (index < 0) { next(); return; }
        paused = !paused;
        Notifications.push("POISON FM", paused ? "paused" : "▶ " + current(), 0xFFFF8A00);
    }

    public static void next() { change(1); }
    public static void prev() { change(-1); }

    private static void change(int dir) {
        if (!Modules.MUSIC.on() || TRACKS.isEmpty()) return;
        skipDir = dir;
        paused = false;
        if (thread == null || !thread.isAlive()) {
            index = pick(index, dir);
            start();
        } else skip = true;
    }

    private static int pick(int from, int dir) {
        if (TRACKS.isEmpty()) return -1;
        if (Modules.MUSIC_SHUFFLE.get() && TRACKS.size() > 1) {
            int n; do { n = RNG.nextInt(TRACKS.size()); } while (n == from);
            return n;
        }
        return Math.floorMod(from + dir, TRACKS.size());
    }

    public static void applyVolume() { /* volume is applied per buffer on the audio thread */ }

    public static void stop() { running = false; paused = true; }

    private static void start() {
        running = true;
        thread = new Thread(MusicPlayer::loop, "POISON-FM");
        thread.setDaemon(true);
        thread.start();
    }

    private static void loop() {
        int failures = 0;
        while (running) {
            int i = index;
            if (i < 0 || i >= TRACKS.size()) return;
            Track t = TRACKS.get(i);
            if (failures >= 3) { Notifications.push("POISON FM", "stopped after repeated errors", 0xFFFF2E55); running = false; paused = true; break; }
            Notifications.push("POISON FM", "▶ " + t.title, 0xFFFF8A00);
            try {
                playOne(t);
                failures = 0;
            } catch (IllegalArgumentException | javax.sound.sampled.LineUnavailableException e) {
                // no usable audio output (no device, or it's held exclusively by another app)
                PoisonClient.LOG.warn("No audio output for POISON FM: {}", e.getMessage());
                Notifications.push("POISON FM", "no audio output device available", 0xFFFF2E55);
                running = false;
                paused = true;
                index = -1;
                break;
            } catch (Exception e) {
                PoisonClient.LOG.warn("Could not play {}", t.title, e);
                Notifications.push("POISON FM", "can't play " + t.title, 0xFFFF2E55);
                failures++;
                try { Thread.sleep(500); } catch (InterruptedException ignored) { }
            }
            if (!running) break;
            if (!Modules.MUSIC.on()) { running = false; paused = true; break; }
            int dir = skip ? skipDir : 1;
            skip = false;
            index = pick(index, dir);
        }
        level = 0;
    }

    private static InputStream open(Track t) throws Exception {
        InputStream raw = t.file != null ? Files.newInputStream(t.file) : MusicPlayer.class.getResourceAsStream(t.resource);
        if (raw == null) throw new IllegalStateException("missing " + t.resource);
        return new BufferedInputStream(raw);
    }

    private static void playOne(Track t) throws Exception {
        String name = t.file != null ? t.file.toString().toLowerCase() : t.resource.toLowerCase();
        if (name.endsWith(".wav")) {
            try (AudioInputStream ais = AudioSystem.getAudioInputStream(open(t))) {
                AudioFormat src = ais.getFormat();
                AudioFormat pcm = new AudioFormat(AudioFormat.Encoding.PCM_SIGNED, src.getSampleRate(), 16, src.getChannels(), src.getChannels() * 2, src.getSampleRate(), false);
                try (AudioInputStream conv = AudioSystem.getAudioInputStream(pcm, ais)) {
                    byte[] buf = new byte[8192];
                    stream(pcm, () -> { int n = conv.read(buf); return n <= 0 ? null : ByteBuffer.wrap(buf, 0, n).order(ByteOrder.LITTLE_ENDIAN); });
                }
            }
        } else {
            try (OggAudioStream ogg = new OggAudioStream(open(t))) {
                AudioFormat f = ogg.getFormat();
                AudioFormat pcm = new AudioFormat(f.getSampleRate(), 16, f.getChannels(), true, ByteOrder.nativeOrder() == ByteOrder.BIG_ENDIAN);
                stream(pcm, () -> {
                    ByteBuffer b = ogg.read(8192);
                    return b == null || !b.hasRemaining() ? null : b.order(ByteOrder.nativeOrder());
                });
            }
        }
    }

    private interface Source { ByteBuffer next() throws Exception; }

    private static void stream(AudioFormat fmt, Source src) throws Exception {
        SourceDataLine line = (SourceDataLine) AudioSystem.getLine(new DataLine.Info(SourceDataLine.class, fmt));
        liveLine = line;
        line.open(fmt, (int) (fmt.getSampleRate() * fmt.getFrameSize() / 5)); // ~200ms buffer
        line.start();
        boolean big = fmt.isBigEndian();
        int ch = fmt.getChannels();
        float[] lp = new float[BANDS.length];
        float[] cut = { 0.01f, 0.03f, 0.07f, 0.15f, 0.3f, 0.6f };
        byte[] out = new byte[0];
        try {
            while (running && !skip && Modules.MUSIC.on()) {
                if (paused) { line.stop(); Thread.sleep(50); level *= 0.8f; continue; }
                if (!line.isRunning()) line.start();
                ByteBuffer b = src.next();
                if (b == null) break;
                int n = b.remaining() & ~1;
                if (out.length < n) out = new byte[n];
                float vol = Modules.MUSIC_VOLUME.f();
                float[] energy = new float[BANDS.length];
                int samples = 0;
                for (int k = 0; k < n; k += 2) {
                    int lo = b.get(b.position() + (big ? k + 1 : k)) & 0xFF, hi = b.get(b.position() + (big ? k : k + 1));
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
                    out[big ? k + 1 : k] = (byte) v;
                    out[big ? k : k + 1] = (byte) (v >> 8);
                }
                if (samples > 0) {
                    for (int f = 0; f < BANDS.length; f++) {
                        float e = (float) Math.sqrt(energy[f] / samples) * (3f + f * 2f);
                        BANDS[f] = e > BANDS[f] ? e : BANDS[f] * 0.85f;
                    }
                    float bass = Math.min(1, Math.max(0, (BANDS[0] + BANDS[1]) * 0.9f - 0.15f));
                    level = bass > level ? bass : level * 0.88f;
                }
                line.write(out, 0, n);
            }
            if (!skip && running) line.drain();
        } finally {
            line.stop();
            line.flush();
            line.close();
            if (liveLine == line) liveLine = null;
        }
    }

    private MusicPlayer() {}
}
