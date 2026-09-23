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
Two ways, and the script picks whichever applies. If NOUN_ONSETS below is
filled in, those hand-measured times win and no detection runs at all.
Otherwise the automatic shared-carrier method is used.

Automatic (shared-carrier sets only).
The six recordings are concatenations of one shared carrier recording
("Look at the...") with a per-token noun, so the clips are sample-identical
up to the join and diverge after it. That is measurable from the clips
alone - no isolated word files needed:

  1. Cross-compare every pair of clips and take the EARLIEST point at
     which any two differ. That is the join (the earliest-onset noun
     starts right there).
  2. Per clip, the acoustic noun onset is the first frame at or after the
     join whose energy clears the silence threshold - which absorbs each
     noun's own few tens of ms of leading silence.

The join is ONE number, not one per clip: there is a single carrier
recording and each noun is appended to it, so the concatenation point sits
at the same sample index in all six. What varies per clip is the NOUN
ONSET, which is step 2's job. Step 1 only has to hand step 2 a starting
line that is past the carrier.

Why the earliest, and why it needs guarding.
Pair (a, b) first differs at join + min(lead silence of a, lead silence of
b), so the minimum over all pairs is join + the smallest lead silence in
the set - the tightest bound available, and exact whenever any one noun
starts flush at the join. A median over pairs would instead land at join +
the median of those per-pair minima, biased LATE, and a join past some
clip's true noun onset makes step 2 misread that clip.

The minimum's weakness is that it trusts every clip. It takes one file
exported at a different level to break it: blocks.mp3 in the current set
peaks at 0.434 where the other five peak at 0.300, and the difference is
not a scalar gain (correcting for carrier gain still leaves it diverging
from all five at 0.198s), so its five pairs "diverge" almost immediately
while the other ten agree on 0.778s. Taking the minimum over all fifteen
read 0.193s, decided the set had no shared carrier, and refused to build -
six good recordings failed on the strength of one odd export.

So the median is used ONLY to find that clip, never as the answer: pairs
sitting far below the consensus identify the deviant file, it is dropped,
and the minimum is taken over the pairs that remain. One deviant clip
contributes 5 of 15 pairs and cannot move the median; two contribute 9 and
can, so the script stops rather than trusting the consensus in that case.

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

# Hand-measured noun onsets, in seconds from the start of the clip in
# stimuli/Audio/. Leave EMPTY to use the automatic shared-carrier
# detection below; fill it in when the recordings are six separate
# natural utterances, where nothing in the audio marks the noun boundary
# and detection is impossible. Every token in TOKENS must be present, or
# the script stops rather than silently mixing the two methods.
#
# Re-measure whenever stimuli/Audio/ is re-recorded - these numbers are
# properties of those specific files, and a stale entry pads the clip to
# the wrong offset with no visible symptom.
#
# Empty on purpose: the current set IS a shared-carrier set, so detection
# is exact and picks up the ~18ms of real spread between tokens that a
# single hand-measured value would flatten.
NOUN_ONSETS = {}

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
    sample-identical until one of their nouns begins. Returns the EARLIEST
    such divergence, plus the names of any clips that diverge from
    everything far too early to be explained by a noun - those are
    mis-exported rather than mis-recorded, and are excluded from the
    estimate. See the module docstring for why the minimum is the right
    statistic and why the median only screens for outliers.
    """
    peak = max(float(np.abs(c).max()) for c in clips.values())
    threshold = 0.01 * peak
    names = sorted(clips)
    divergences = {}
    for i, a in enumerate(names):
        for b in names[i + 1 :]:
            shorter = min(len(clips[a]), len(clips[b]))
            differing = np.where(np.abs(clips[a][:shorter] - clips[b][:shorter]) > threshold)[0]
            if len(differing) == 0:
                continue
            divergences[(a, b)] = differing[0] / SR

    if not divergences:
        return None, []

    # Screening pass only. A clip whose EVERY pair diverges well before
    # the consensus shares the carrier phrase but not the carrier samples.
    # Harmless for the energy-based onset scan, which runs per clip - but
    # it must not be allowed near the minimum below, which it would
    # dominate.
    consensus = float(np.median(list(divergences.values())))
    odd = []
    for name in names:
        own = [s for (a, b), s in divergences.items() if name in (a, b)]
        if own and max(own) < 0.5 * consensus:
            odd.append(name)

    usable = [s for (a, b), s in divergences.items() if a not in odd and b not in odd]
    if not usable:
        return None, odd
    return min(usable), odd


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

    if NOUN_ONSETS:
        absent = [t for t in TOKENS if t not in NOUN_ONSETS]
        if absent:
            sys.exit(
                f"NOUN_ONSETS is filled in but missing: {', '.join(absent)}.\n"
                "Measure every token or clear the dict entirely - a partial table would\n"
                "hand-place some clips and auto-detect others, which is never what you want."
            )
        # A measurement past the end of its clip means the number belongs
        # to a different recording set - catch it here, not in the
        # verification table.
        for token in TOKENS:
            if not 0.0 <= NOUN_ONSETS[token] < len(clips[token]) / SR:
                sys.exit(
                    f"NOUN_ONSETS[{token!r}] = {NOUN_ONSETS[token]}s falls outside the clip "
                    f"(0 - {len(clips[token]) / SR:.3f}s). Re-measure against the current "
                    "stimuli/Audio/."
                )
        onsets = {t: float(NOUN_ONSETS[t]) for t in TOKENS}
        source_note = "hand-measured (NOUN_ONSETS)"
    else:
        join, odd = find_carrier_join(clips)
        if join is None:
            sys.exit("All six recordings are identical - check stimuli/Audio/.")
        if len(odd) > 1:
            sys.exit(
                f"{len(odd)} clips ({', '.join(odd)}) diverge from every other clip long before "
                f"the consensus join of {join:.3f}s.\nWith more than one the median is no longer "
                "trustworthy, so the join cannot be located.\nRe-export them from the same master "
                "and settings as the rest of stimuli/Audio/."
            )
        if odd:
            print(
                f"NOTE: {odd[0]}.mp3 shares the carrier PHRASE but not the carrier SAMPLES - it is "
                f"encoded\n      differently from the other {len(TOKENS) - 1} (check its peak level). "
                "Its noun onset is still\n      measured correctly below; re-export it when convenient "
                "so the set is uniform.\n"
            )
        if join < 0.30:
            sys.exit(
                f"The recordings diverge at {join:.3f}s, too early to be a shared carrier phrase.\n"
                "This script assumes every clip is the same \"Look at the...\" recording joined to a\n"
                "per-token noun, which is what lets it locate the noun. If the clips are separate\n"
                "natural utterances, measure the noun onsets by hand and fill in NOUN_ONSETS."
            )

        onsets = {t: noun_onset_after(clips[t], join) for t in TOKENS}
        missing = [t for t, v in onsets.items() if v is None]
        if missing:
            sys.exit(f"No speech found after the carrier in: {', '.join(missing)}")
        source_note = f"auto-detected (shared carrier ends at {join:.3f}s)"

    print(f"Target noun onset: {TARGET_NOUN_ONSET:.3f}s after image onset")
    print(f"Noun onsets: {source_note}\n")
    print(f"{'token':8} {'noun onset':>11} {'pad':>8}")
    for token in TOKENS:
        print(f"{token:8} {onsets[token]:11.3f} {TARGET_NOUN_ONSET - onsets[token]:8.3f}")

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
