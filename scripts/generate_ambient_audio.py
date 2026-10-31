#!/usr/bin/env python3
"""
Generate a subtle, pleasant, royalty-free ambient instrumental background track
for Ganganathan's developer portfolio.

Features:
- Chord progression: Dm9 -> Bbmaj7 -> Gm9 -> Cmaj9 / Asus4
- Ethereal bell / Rhodes harmonic overtones and gentle stereo panning
- Low-pass filter and smooth harmonic envelope
- Perfect 24-second seamless loop with crossfade
- Generates 32kHz 16-bit stereo PCM WAV
"""

import os
import wave
import struct
import math

def generate_ambient_track(output_path="public/audio/default-ambient.wav"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sample_rate = 32000
    duration = 24.0
    total_samples = int(sample_rate * duration)

    # Chord progression: (start_time, end_time, chord_frequencies_hz)
    chords = [
        (0.0, 6.0, [73.42, 146.83, 220.00, 261.63, 329.63, 349.23, 440.00]),
        (6.0, 12.0, [58.27, 116.54, 174.61, 220.00, 293.66, 349.23, 440.00]),
        (12.0, 18.0, [49.00, 98.00, 146.83, 174.61, 233.08, 293.66, 392.00]),
        (18.0, 24.0, [65.41, 130.81, 196.00, 246.94, 293.66, 329.63, 392.00])
    ]

    # Melodic sparkle notes: (time_sec, freq_hz, stereo_pan_0_to_1)
    sparkles = [
        (1.5, 523.25, 0.3), (3.0, 659.25, 0.7), (4.5, 587.33, 0.4),
        (7.5, 698.46, 0.6), (9.0, 587.33, 0.3), (10.5, 523.25, 0.7),
        (13.5, 587.33, 0.4), (15.0, 783.99, 0.6), (16.5, 698.46, 0.3),
        (19.5, 659.25, 0.7), (21.0, 523.25, 0.3), (22.5, 493.88, 0.5)
    ]

    left_buffer = [0.0] * total_samples
    right_buffer = [0.0] * total_samples

    for start_t, end_t, freqs in chords:
        start_s = int(start_t * sample_rate)
        end_s = int(end_t * sample_rate)
        chord_len = end_s - start_s
        for i in range(chord_len):
            idx = start_s + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            # Smooth envelope: attack 0.8s, release 0.8s
            env = 1.0
            if t < 0.8:
                env = t / 0.8
            elif t > (end_t - start_t - 0.8):
                env = (end_t - start_t - t) / 0.8
                if env < 0:
                    env = 0

            # Subtle LFO modulation
            lfo = 1.0 + 0.15 * math.sin(2.0 * math.pi * 0.25 * (idx / sample_rate))

            sample_val = 0.0
            for f_idx, f in enumerate(freqs):
                weight = 0.28 / (1.0 + f_idx * 0.35)
                # Fundamental sine + warm 2nd harmonic
                tone = math.sin(2.0 * math.pi * f * t) + 0.25 * math.sin(4.0 * math.pi * f * t + 0.5)
                sample_val += tone * weight

            val = sample_val * env * lfo * 0.32
            # Stereo separation
            left_buffer[idx] += val * (1.0 + 0.12 * math.sin(t * 1.5))
            right_buffer[idx] += val * (1.0 - 0.12 * math.sin(t * 1.5))

    # Add bell sparkle echoes
    for sp_t, sp_f, sp_pan in sparkles:
        sp_start = int(sp_t * sample_rate)
        sp_dur = int(2.2 * sample_rate)
        for i in range(sp_dur):
            idx = sp_start + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            decay = math.exp(-t * 2.8)
            val = math.sin(2.0 * math.pi * sp_f * t) * decay * 0.09
            left_buffer[idx] += val * (1.0 - sp_pan)
            right_buffer[idx] += val * sp_pan

    # Seamless loop smoothing: crossfade first and last 0.6 seconds
    fade_samples = int(0.6 * sample_rate)
    for i in range(fade_samples):
        alpha = i / fade_samples
        end_idx = total_samples - fade_samples + i
        l_end = left_buffer[end_idx]
        r_end = right_buffer[end_idx]
        l_start = left_buffer[i]
        r_start = right_buffer[i]

        w = 0.5 * (1.0 - math.cos(math.pi * alpha))
        left_buffer[i] = l_start * w + l_end * (1.0 - w)
        right_buffer[i] = r_start * w + r_end * (1.0 - w)
        left_buffer[end_idx] = l_start * w + l_end * (1.0 - w)
        right_buffer[end_idx] = r_start * w + r_end * (1.0 - w)

    # Peak normalization to prevent clipping (-1.4 dB headroom)
    max_val = max(max(abs(x) for x in left_buffer), max(abs(x) for x in right_buffer))
    gain = 0.85 / max(max_val, 0.001)

    with wave.open(output_path, "w") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = bytearray()
        for i in range(total_samples):
            l_int = int(max(-32767, min(32767, left_buffer[i] * gain * 32767)))
            r_int = int(max(-32767, min(32767, right_buffer[i] * gain * 32767)))
            frames.extend(struct.pack("<hh", l_int, r_int))
        wav.writeframes(frames)

    file_size = os.path.getsize(output_path)
    print(f"Generated {output_path} ({file_size} bytes, {duration}s stereo 32kHz)")

if __name__ == "__main__":
    generate_ambient_track()

