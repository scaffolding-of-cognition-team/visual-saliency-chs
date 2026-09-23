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
The six recordings are concatenations of one shared carrier recording
("Look at the...") with a per-token noun, so the clips are sample-identical
up to the join and diverge after it. That is measurable from the clips
alone - no isolated word files needed:

  1. Cross-compare every pair of clips and take the earliest point at
     which any two differ. That is the join (the earliest-onset noun
     starts right there).
  2. Per clip, the acoustic noun onset is the first frame at or after the
     join whose energy clears the silence threshold - which absorbs each
     noun's own few tens of ms of leading silence.

Measured on the current (female-voice) set: shared carrier through
"Look" 0.065-0.365, "at" 0.495-0.670, "the" 0.785-1.005, join at 1.006s,
noun onsets 1.006-1.055s.

This replaces an earlier method that cross-correlated the isolated word
clips in stimuli/Audio/audio_builds/ against the full sentences. That
folder no longer exists, and the script no longer needs it. If a future
recording set is NOT built from a shared carrier, step 1 finds the clips
diverging almost immediately and the script stops with an explanation
rather than padding everything wrong.

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


def find_carrier_join(clips):
    """Seconds at which the shared carrier ends, from the clips alone.

    Every clip starts with the same carrier recording, so pairs are
    sample-identical until one of their nouns begins. The earliest such
    divergence across all pairs is the concatenation point.
    """
    peak = max(float(np.abs(c).max()) for c in clips.values())
    threshold = 0.01 * peak
    earliest = None
    names = sorted(clips)
    for i, a in enumerate(names):
        for b in names[i + 1 :]:
            shorter = min(len(clips[a]), len(clips[b]))
            differing = np.where(np.abs(clips[a][:shorter] - clips[b][:shorter]) > threshold)[0]
            if len(differing) == 0:
                continue
            seconds = differing[0] / SR
            if earliest is None or seconds < earliest:
                earliest = seconds
    return earliest


def noun_onset_after(samples, join_seconds):
    """First moment at or after the join carrying speech.

    The window is FORWARD-LOOKING and starts exactly at the join: energy
    at index i is the RMS of samples[i : i+window]. That matters. A
    centred or backward-looking window straddling the join mixes in the
    carrier's final syllable, and the scan then returns the join itself
    for every clip whose "the" has not yet decayed - reporting a noun
    onset tens of ms early and padding the file short by that much. (Seen:
    fridge and ball both came back at 1.003s against a 1.006s join, i.e.
    negative leading silence, which is impossible for a concatenation.)

    Everything at or after the join belongs to the noun file by
    construction, so a window anchored there reads only the noun.
    """
    window = int(0.005 * SR)
    squared = np.concatenate(([0.0], np.cumsum(samples ** 2)))
    # RMS over [i, i+window) for every i
    starts = np.arange(0, len(samples) - window)
    envelope = np.sqrt((squared[starts + window] - squared[starts]) / window)
    threshold = SILENCE_FRACTION * envelope.max()

    first = int(np.ceil(join_seconds * SR))
    for index in range(first, len(envelope)):
        if envelope[index] > threshold:
            return index / SR
    return None


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

    clips = {t: decode(os.path.join(AUDIO_DIR, f"{t}.mp3")) for t in TOKENS}

    join = find_carrier_join(clips)
    if join is None:
        sys.exit("All six recordings are identical - check stimuli/Audio/.")
    if join < 0.30:
        sys.exit(
            f"The recordings diverge at {join:.3f}s, too early to be a shared carrier phrase.\n"
            "This script assumes every clip is the same \"Look at the...\" recording joined to a\n"
            "per-token noun, which is what lets it locate the noun. If the clips are separate\n"
            "natural utterances, the noun onsets have to be measured by hand and hard-coded."
        )

    onsets = {t: noun_onset_after(clips[t], join) for t in TOKENS}
    missing = [t for t, v in onsets.items() if v is None]
    if missing:
        sys.exit(f"No speech found after the carrier in: {', '.join(missing)}")

    print(f"Target noun onset: {TARGET_NOUN_ONSET:.3f}s after image onset")
    print(f"Shared carrier ends (join): {join:.3f}s\n")
    print(f"{'token':8} {'noun onset':>11} {'pad':>8} {'lead silence':>13}")
    for token in TOKENS:
        print(f"{token:8} {onsets[token]:11.3f} {TARGET_NOUN_ONSET - onsets[token]:8.3f} "
              f"{(onsets[token] - join) * 1000:11.0f}ms")

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

if __name__ == "__main__":
    main()
