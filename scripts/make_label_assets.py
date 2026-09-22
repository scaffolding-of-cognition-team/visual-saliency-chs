#!/usr/bin/env python3
"""Render the spoken-label clips used by the image trials.

    python3 scripts/make_label_assets.py

Writes stimuli/Label_audio/label-<token>.mp3, one per object token: the
original "Look at the <token>!" recording from stimuli/Audio/, prepended
with enough silence that the NOUN begins exactly TARGET_NOUN_ONSET seconds
after the clip starts.

Why pad the file instead of scheduling the audio
------------------------------------------------
exp-lookit-images-audio starts its audio and shows its images in the same
synchronous block (`startTrial()` calls `playAudio()` then `showImages()`),
and the frame exposes `displayDelayMs` for IMAGES ONLY - there is no
audio-delay property anywhere in the component or its mixins. Baking the
delay into the asset is therefore the only way to place the label at a
known offset from image onset, and it has the side benefit of being exact
rather than timer-dependent.

Why the noun and not the clip start
-----------------------------------
The recordings are carrier phrases - "Look at the ball!" - where the noun
starts ~0.67s in. Looking-while-listening is time-locked to noun onset, so
that is what gets anchored to TARGET_NOUN_ONSET. The carrier therefore
begins ~0.67s BEFORE that.

Measuring noun onset
--------------------
stimuli/Audio/<token>.mp3 was built by concatenating
audio_builds/look_at_the.mp3 + audio_builds/<token>.mp3. This script
recovers the join point by cross-correlating the isolated word clip
against the full clip, then adds that word clip's own leading silence to
get the acoustic noun onset. Measured: the join sits at 0.622s for every
token and the word clips carry 45-55ms of leading silence, putting noun
onset at 0.667-0.677s - consistent with the carrier's own speech ending at
0.663s.

`car` is the exception: audio_builds/car.mp3 is not the isolated word, it
is a second copy of the full "Look at the car!" sentence, so there is
nothing to align. It falls back to the mean of the other five and prints a
warning. Drop a real isolated car recording into audio_builds/ and the
fallback disappears.

mp3 encoding prepends its own delay (~25ms of silence) to whatever it is
given, which would push every noun late by that amount. Rather than model
it, the script encodes, re-measures the noun onset in the ENCODED file,
and re-encodes once with the error subtracted out. The verification table
at the end reports the achieved onset for each clip; they should all read
3.000 +/- a few ms.
"""

import os
import subprocess
import sys

import numpy as np

SR = 44100

# Seconds from clip start (== trial image onset) to the onset of the noun.
# MUST match LABEL_NOUN_ONSET_SECONDS in src/config.js - that constant is
# what the analysis will time-lock to, and nothing enforces the match.
TARGET_NOUN_ONSET = 3.0

TOKENS = ["ball", "blocks", "car", "drawer", "fridge", "keys"]

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(REPO, "stimuli", "Audio")
BUILDS_DIR = os.path.join(AUDIO_DIR, "audio_builds")
OUT_DIR = os.path.join(REPO, "stimuli", "Label_audio")

# Fraction of a clip's peak envelope counted as speech rather than silence.
SILENCE_FRACTION = 0.02


def decode(path):
    """mp3 -> mono float64 at SR."""
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed on {path}: {result.stderr.decode()}")
    return np.frombuffer(result.stdout, dtype=np.float32).astype(np.float64)


def leading_silence(samples):
    """Seconds before the first frame whose RMS clears SILENCE_FRACTION of peak."""
    window = int(0.005 * SR)
    frames = len(samples) // window
    envelope = np.sqrt((samples[: frames * window].reshape(frames, window) ** 2).mean(axis=1))
    above = np.where(envelope > SILENCE_FRACTION * envelope.max())[0]
    return above[0] * window / SR


def align(needle, haystack, step=8):
    """Lag (seconds) and correlation of the best placement of needle in haystack."""
    n = len(needle)
    if n >= len(haystack):
        return None, -1.0
    centered = needle - needle.mean()
    norm = np.linalg.norm(centered)
    best_lag, best_corr = 0, -1.0
    for lag in range(0, len(haystack) - n + 1, step):
        segment = haystack[lag : lag + n]
        seg_centered = segment - segment.mean()
        seg_norm = np.linalg.norm(seg_centered)
        if seg_norm == 0:
            continue
        corr = float(centered @ seg_centered / (norm * seg_norm))
        if corr > best_corr:
            best_corr, best_lag = corr, lag
    return best_lag / SR, best_corr


def measure_noun_onset(token):
    """Acoustic noun onset (seconds) within stimuli/Audio/<token>.mp3, or None."""
    full = decode(os.path.join(AUDIO_DIR, f"{token}.mp3"))
    word_path = os.path.join(BUILDS_DIR, f"{token}.mp3")
    if not os.path.exists(word_path):
        return None, full
    word = decode(word_path)

    # A word clip nearly as long as the full clip is not an isolated word -
    # it is another copy of the whole sentence (the `car` case).
    if len(word) > 0.85 * len(full):
        return None, full

    lag, corr = align(word, full)
    if lag is None or corr < 0.9:
        return None, full
    return lag + leading_silence(word), full


def encode(source_path, pad_seconds, out_path):
    """Write source prepended with pad_seconds of silence, as mono mp3.

    Downmix to mono BEFORE adelay, not after. `adelay=N` delays only the
    first channel and leaves the rest where they are; on a stereo source a
    trailing `-ac 1` then folds the undelayed channel back in, so the file
    contains the label twice - once at 0s and once at the intended offset.
    Collapsing to mono first means there is only one channel to delay.
    (Mono also matches the MATLAB original, which did
    `instruction_wave(:, 1)` before playback.)
    """
    pad_ms = max(0, int(round(pad_seconds * 1000)))
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", source_path,
         "-af", f"aformat=channel_layouts=mono,adelay={pad_ms}",
         "-ac", "1", "-b:a", "128k", out_path],
        check=True,
    )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    onsets = {}
    for token in TOKENS:
        onset, _ = measure_noun_onset(token)
        onsets[token] = onset

    measured = [v for v in onsets.values() if v is not None]
    if not measured:
        sys.exit("Could not measure noun onset for any token - check stimuli/Audio/audio_builds/.")
    fallback = float(np.mean(measured))

    print(f"Target noun onset: {TARGET_NOUN_ONSET:.3f}s after image onset\n")
    print(f"{'token':8} {'noun onset':>11} {'pad':>8}   source")
    for token in TOKENS:
        onset = onsets[token]
        if onset is None:
            onset = fallback
            print(f"{token:8} {onset:11.3f} {TARGET_NOUN_ONSET - onset:8.3f}   "
                  f"FALLBACK (mean of {len(measured)}) - see WARNING below")
            onsets[token] = onset
        else:
            print(f"{token:8} {onset:11.3f} {TARGET_NOUN_ONSET - onset:8.3f}   measured")

    # Encode, measure the encoder's own added delay, re-encode corrected.
    print("\nEncoding...")
    for token in TOKENS:
        source = os.path.join(AUDIO_DIR, f"{token}.mp3")
        out = os.path.join(OUT_DIR, f"label-{token}.mp3")
        pad = TARGET_NOUN_ONSET - onsets[token]
        encode(source, pad, out)

        # Where did the noun actually land? Align the ORIGINAL clip inside
        # the padded one; its offset plus the original's own noun onset is
        # the achieved noun onset.
        original = decode(source)
        padded = decode(out)
        lag, corr = align(original, padded, step=4)
        if lag is not None and corr > 0.9:
            achieved = lag + onsets[token]
            error = achieved - TARGET_NOUN_ONSET
            # Only ever correct for encoder delay, which is tens of ms. A
            # larger "error" means the measurement itself is wrong, and
            # acting on it makes the file worse rather than better - an
            # earlier version of this script doubled every pad that way.
            if 0.002 < abs(error) < 0.100:
                encode(source, pad - error, out)
            elif abs(error) >= 0.100:
                print(f"  {token}: measured error {error*1000:.0f}ms is implausible; "
                      f"leaving the first encode alone and reporting it below.")

    print("\nVerification (achieved noun onset in the written file):")
    print(f"{'token':8} {'achieved':>9} {'error(ms)':>10} {'duration':>9}")
    worst = 0.0
    for token in TOKENS:
        source = os.path.join(AUDIO_DIR, f"{token}.mp3")
        out = os.path.join(OUT_DIR, f"label-{token}.mp3")
        original = decode(source)
        padded = decode(out)
        lag, corr = align(original, padded, step=4)
        achieved = lag + onsets[token]
        error_ms = (achieved - TARGET_NOUN_ONSET) * 1000
        worst = max(worst, abs(error_ms))
        print(f"{token:8} {achieved:9.3f} {error_ms:10.1f} {len(padded)/SR:9.3f}")

    print(f"\nWrote {len(TOKENS)} clips to {OUT_DIR} (worst error {worst:.1f}ms)")
    if any(onsets[t] == fallback and measure_noun_onset(t)[0] is None for t in TOKENS):
        print("\nWARNING: stimuli/Audio/audio_builds/car.mp3 is a duplicate of the full "
              "\"Look at the car!\" sentence, not the isolated word, so car's noun onset "
              "could not be measured and used the mean of the other five instead. Add a "
              "real isolated recording to remove the estimate.")


if __name__ == "__main__":
    main()
