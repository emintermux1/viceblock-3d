#!/usr/bin/env python3
import math, os, struct, subprocess, wave

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
SR = 44100

def write_wav(path, samples):
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        buf = bytearray()
        for s in samples:
            v = max(-1.0, min(1.0, s))
            buf += struct.pack("<h", int(v * 32767))
        w.writeframes(bytes(buf))

def sine(t, f, ph=0.0):
    return math.sin(2 * math.pi * f * t + ph)

def to_mp3(wav, mp3):
    subprocess.check_call(["ffmpeg", "-y", "-i", wav, "-codec:a", "libmp3lame", "-qscale:a", "4", mp3],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(wav)

def music():
    sec = 36.0
    n = int(SR * sec)
    beat = 60.0 / 96
    notes = [110.0, 130.81, 146.83, 164.81, 146.83, 130.81, 123.47, 110.0]
    arp = [329.63, 392.0, 440.0, 523.25, 440.0, 392.0]
    out = []
    for i in range(n):
        t = i / SR
        bass_f = notes[int(t / (beat * 4)) % len(notes)]
        pad = 0.10 * sine(t, bass_f * 2, 0.2) + 0.07 * sine(t, bass_f * 3.01, 0.7)
        pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t / beat)
        bass = 0.22 * sine(t, bass_f) * (0.55 + 0.45 * pulse)
        step = int((t / (beat / 4))) % len(arp)
        gate = 1.0 if (t % (beat / 4)) < (beat / 8) else 0.15
        arpv = 0.07 * sine(t, arp[step]) * gate
        hat = 0.0
        if (t % beat) < 0.035:
            hat = ((hash(i) % 1000) / 1000.0 - 0.5) * 0.09
        pos = t % (beat * 2)
        kick = 0.0
        if pos < 0.12:
            kick = 0.28 * math.sin(2 * math.pi * (70 - pos * 220) * pos) * (1 - pos / 0.12)
        shim = 0.03 * sine(t, 660 + 12 * math.sin(t * 0.4))
        s = (bass + pad + arpv + hat + kick + shim) * 0.85
        fade = 1.0
        if t < 1.2: fade = t / 1.2
        if t > sec - 1.2: fade = (sec - t) / 1.2
        out.append(s * fade)
    wav = os.path.join(OUT, "nova-city.wav")
    write_wav(wav, out)
    to_mp3(wav, os.path.join(OUT, "nova-city.mp3"))

def burst(name, sec, fn):
    n = int(SR * sec)
    out = [fn(i / SR, i) for i in range(n)]
    wav = os.path.join(OUT, name + ".wav")
    write_wav(wav, out)
    to_mp3(wav, os.path.join(OUT, name + ".mp3"))

if __name__ == "__main__":
    music()
    burst("gun", 0.16, lambda t, i: (((hash(i * 17) % 2000) / 1000.0 - 1.0) * math.exp(-t * 28) * 0.7 + math.sin(2 * math.pi * 1800 * t) * math.exp(-t * 80) * 0.35 + math.sin(2 * math.pi * 90 * t) * math.exp(-t * 22) * 0.5))
    burst("engine", 2.0, lambda t, i: (0.35 * sine(t, 52) + 0.18 * sine(t, 104) + 0.06 * ((hash(i) % 1000) / 1000.0 - 0.5)) * (0.7 + 0.3 * math.sin(2 * math.pi * 18 * t)) * 0.55)
    burst("siren", 2.4, lambda t, i: (0.28 * sine(t, 780 if int(t / 0.55) % 2 == 0 else 560) + 0.12 * sine(t, 1.5 * (780 if int(t / 0.55) % 2 == 0 else 560))))
    burst("boom", 0.7, lambda t, i: (((hash(i * 31) % 2000) / 1000.0 - 1.0) * math.exp(-t * 6) * 0.45 + math.sin(2 * math.pi * (70 - t * 40) * t) * math.exp(-t * 4) * 0.7))
    burst("reload", 0.35, lambda t, i: ((math.sin(2 * math.pi * 2400 * t) * math.exp(-abs(t - 0.04) * 90) if t < 0.12 else 0) * 0.4 + (math.sin(2 * math.pi * 1600 * t) * math.exp(-abs(t - 0.18) * 70) if 0.12 < t < 0.28 else 0) * 0.35))
    burst("melee", 0.18, lambda t, i: (math.sin(2 * math.pi * 70 * t) * math.exp(-t * 18) * 0.7 + ((hash(i * 9) % 1000) / 1000.0 - 0.5) * math.exp(-t * 30) * 0.4))
    burst("empty", 0.08, lambda t, i: math.sin(2 * math.pi * 2100 * t) * math.exp(-t * 40) * 0.25)
    burst("web", 0.28, lambda t, i: (
        math.sin(2 * math.pi * (1400 + t * 2200) * t) * math.exp(-t * 10) * 0.38
        + math.sin(2 * math.pi * (420 + t * 180) * t) * math.exp(-t * 8) * 0.22
        + ((hash(i * 19) % 1000) / 1000.0 - 0.5) * math.exp(-t * 18) * 0.16
    ))
    burst("whoosh", 0.42, lambda t, i: (
        ((hash(i * 23) % 1000) / 1000.0 - 0.5) * math.exp(-t * 6) * 0.42
        + math.sin(2 * math.pi * (180 + t * 90) * t) * math.exp(-t * 5) * 0.18
    ))
    burst("impact", 0.32, lambda t, i: (
        math.sin(2 * math.pi * (70 - t * 40) * t) * math.exp(-t * 9) * 0.62
        + ((hash(i * 11) % 1000) / 1000.0 - 0.5) * math.exp(-t * 14) * 0.28
    ))
    print("audio", os.listdir(OUT))
