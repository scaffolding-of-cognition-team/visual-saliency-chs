#!/usr/bin/env python3
"""Pre-renders the attention-getter assets for the Lookit study.

WHY THIS EXISTS
---------------
The MATLAB attention getter (Experiment_Simsom_LWL.m) is a real-time
animation: a shape the size of a trial image sits at one of the two
stimulus positions, plays a sound, animates twice, slides to screen
centre on a sigmoid, plays the sound again, and animates twice more.

None of that is expressible in Lookit's exp-lookit-calibration frame,
which hardcodes its image to `width: 12%` / `max-height: 300px`, offers
only 'spin'/'bounce', and hard-cuts between three fixed positions with no
CSS transition. So we pre-render the animation to video and play it with
exp-lookit-video, which accepts full-viewport video plus a separate audio
track.

Factorial, matching MATLAB's shapes x sounds x motions x sides:
  5 shapes x 3 motions x 2 sides = 30 silent videos
  5 sounds                       =  5 audio tracks (sound at t=0 and
                                     t=3.5s, matching event_sequence)
  -> 150 distinct attention getters from 35 files.

Audio is kept OUT of the video precisely so the sound stays an
independent factor; baking it in would need 150 videos.

Run:  python3 scripts/make_ag_assets.py
Needs: PIL, numpy, ffmpeg on PATH. Output: stimuli/AG_videos/.
"""

import math
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
AG_SRC = ROOT / "stimuli" / "AG_stimuli"
OUT = ROOT / "stimuli" / "AG_videos"

# ---------------------------------------------------------------------------
# Parameters.AG.* from the MATLAB config, verbatim.
# ---------------------------------------------------------------------------
SHAPES = ["orb", "ring", "star", "flower", "heart"]
SOUNDS = ["giggle", "bell", "powerup", "squeak", "xylophone"]
MOTIONS = ["orbit", "rotate", "scale"]

EVENT_SEQUENCE = [1, 2, 2, 3, 1, 2, 2]  # 1 = sound, 2 = action, 3 = move to centre
EPOCH_TIME = 1.0        # Parameters.AG.epoch_time
ROTATIONS = 1           # Parameters.AG.rotations
ORBIT_RADIUS_DEG = 5    # Parameters.AG.orbit_radius (visual degrees)
SCALING_FACTOR = 2      # Parameters.AG.scaling_factor
EPOCH_SLOPE = 12        # Parameters.AG.epoch_slope
POST_WAIT = 0.25        # Parameters.AG.Post_wait

# MATLAB's event 1 is `play(sound); pause(0.5)` - the shape is simply left
# as last drawn for that half second, so it reads as a static hold.
SOUND_HOLD = 0.5

# ---------------------------------------------------------------------------
# Geometry. MATLAB draws the AG at Image_ppd (the *trial image* size) and at
# centerX +/- eccentricity_ppd (the *trial image* centres), so the attention
# getter is exactly as large as a stimulus and lands exactly where one will.
# We therefore derive everything from the trial-image layout.
#
# MUST STAY IN SYNC WITH src/config.js:
#   TRIAL_IMAGE_WIDTH_PERCENT        = 38
#   TRIAL_IMAGE_MARGIN_PERCENT       = (7 / 445) * 100
# The values are printed at run time so drift is visible.
# ---------------------------------------------------------------------------
IMAGE_WIDTH_PCT = 38.0
MARGIN_PCT = (7.0 / 445.0) * 100.0

# Centres of the two stimulus slots, as a percentage of screen width.
LEFT_CENTRE_PCT = MARGIN_PCT + IMAGE_WIDTH_PCT / 2.0
RIGHT_CENTRE_PCT = 100.0 - LEFT_CENTRE_PCT
SCREEN_CENTRE_PCT = 50.0

# MATLAB's ImageSize is 50 visual degrees and maps onto IMAGE_WIDTH_PCT, so
# one visual degree is IMAGE_WIDTH_PCT / 50 percent of screen width. That
# converts orbit_radius (5 deg) into our units without needing a viewing
# distance we don't have for an at-home study.
IMAGE_SIZE_DEG = 50.0
DEG_TO_PCT = IMAGE_WIDTH_PCT / IMAGE_SIZE_DEG
ORBIT_RADIUS_PCT = ORBIT_RADIUS_DEG * DEG_TO_PCT

WIDTH, HEIGHT = 1280, 720
FPS = 60
BG = (50, 50, 50)  # BACKGROUND_COLOR in src/config.js: Window.gray = 50


def sigmoid(t):
    """MATLAB: 1 / (1 + exp(-slope * (t - epoch_time/2)))."""
    return 1.0 / (1.0 + math.exp(-EPOCH_SLOPE * (t - EPOCH_TIME / 2.0)))


def build_timeline():
    """Expand EVENT_SEQUENCE into (kind, duration) segments, plus Post_wait.

    Mirrors MATLAB's `for event = AG_event_sequence` loop: each action and
    each move runs for epoch_time, each sound is a SOUND_HOLD pause.
    """
    segments = []
    for event in EVENT_SEQUENCE:
        if event == 1:
            segments.append(("sound", SOUND_HOLD))
        elif event == 2:
            segments.append(("action", EPOCH_TIME))
        elif event == 3:
            segments.append(("move", EPOCH_TIME))
        else:
            raise ValueError(f"unknown event {event}")
    segments.append(("blank", POST_WAIT))
    return segments


def pct_to_px_x(pct):
    return pct / 100.0 * WIDTH


def render_frame(sprite, motion, start_centre_pct, segments, frame_index, base_px):
    """Draw one frame. Returns an RGB image.

    `start_centre_pct` is the side the AG begins on; after the 'move'
    segment the shape stays at screen centre, exactly as MATLAB's RectAG
    retains its updated position for the events that follow.
    """
    t = frame_index / FPS

    # Locate the current segment and local time within it, and track the
    # centre the way MATLAB does (updated by the move, read by later events).
    centre_pct = start_centre_pct
    elapsed = 0.0
    kind, local, duration = None, 0.0, 0.0
    for seg_kind, seg_dur in segments:
        if t < elapsed + seg_dur - 1e-9:
            kind, local, duration = seg_kind, t - elapsed, seg_dur
            break
        if seg_kind == "move":
            centre_pct = SCREEN_CENTRE_PCT
        elapsed += seg_dur
    if kind is None:  # past the end
        kind, local, duration = "blank", 0.0, 0.0

    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    if kind == "blank":
        return canvas

    centre_x = pct_to_px_x(centre_pct)
    centre_y = HEIGHT / 2.0
    tau = local / duration * EPOCH_TIME if duration else 0.0
    img = sprite
    size = base_px

    if kind == "move":
        # MATLAB: current_eccentricity = E - E * sigmoid(t), sliding the
        # shape from the stimulus position to screen centre.
        ecc_pct = abs(start_centre_pct - SCREEN_CENTRE_PCT)
        current_ecc = ecc_pct - ecc_pct * sigmoid(tau)
        sign = -1.0 if start_centre_pct < SCREEN_CENTRE_PCT else 1.0
        centre_x = pct_to_px_x(SCREEN_CENTRE_PCT + sign * current_ecc)

    elif kind == "action":
        if motion == "rotate":
            # MATLAB: angle = (rotations * 360) * sigmoid(t), drawn about the
            # shape's own centre. PTB rotates clockwise for positive angles;
            # PIL rotates counter-clockwise, hence the negation.
            angle = ROTATIONS * 360.0 * sigmoid(tau)
            img = sprite.rotate(-angle, resample=Image.BICUBIC, expand=True)

        elif motion == "scale":
            # MATLAB: s = sin(2*pi*t/epoch_time), then
            #   s < 0 -> 1 - |s| / K      (shrink toward 1/K)
            #   s >= 0 -> s * (K - 1) + 1 (grow toward K)
            raw = math.sin(tau / EPOCH_TIME * math.pi * 2.0)
            if raw < 0:
                scale = 1.0 - (abs(raw) / SCALING_FACTOR)
            else:
                scale = raw * (SCALING_FACTOR - 1.0) + 1.0
            size = max(1, int(round(base_px * scale)))

        elif motion == "orbit":
            # MATLAB: orbit about a point orbit_radius to the LEFT of the
            # resting position, so angle 0 is the resting position. Screen y
            # grows downward in both PTB and PIL, so sin is used directly.
            angle = ROTATIONS * 360.0 * sigmoid(tau)
            r = pct_to_px_x(ORBIT_RADIUS_PCT)
            orbit_centre_x = centre_x - r
            centre_x = orbit_centre_x + r * math.cos(math.radians(angle))
            centre_y = centre_y + r * math.sin(math.radians(angle))

    if size != sprite.width:
        img = sprite.resize((size, size), Image.LANCZOS)

    canvas.paste(img, (int(round(centre_x - img.width / 2.0)),
                       int(round(centre_y - img.height / 2.0))), img)
    return canvas


def make_video(shape, motion, side, segments, total_frames):
    base_px = int(round(IMAGE_WIDTH_PCT / 100.0 * WIDTH))
    sprite = Image.open(AG_SRC / f"{shape}.png").convert("RGBA")
    sprite = sprite.resize((base_px, base_px), Image.LANCZOS)
    start = LEFT_CENTRE_PCT if side == "left" else RIGHT_CENTRE_PCT

    out_path = OUT / f"ag-{shape}-{motion}-{side}.mp4"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        # DELIBERATELY UNTAGGED. An earlier version set -color_range tv
        # plus the bt709 triple here, on the theory that a player guessing
        # the range was rendering the rgb(50,50,50) background lighter and
        # making the letterbox strips visible. That was wrong: Chrome
        # decodes these clips to exactly 50,50,50 either way (measured via
        # canvas readback, GPU and software).
        #
        # Tagging made it WORSE, because an explicitly tagged clip gets
        # colour-managed through the display profile while the CSS
        # rgb(50,50,50) around it does not - so on a wide-gamut screen the
        # attention getter ended up a visibly different shade from the
        # rest of the study. Leaving the clips untagged keeps them on the
        # same footing as the CSS.
        str(out_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(total_frames):
        frame = render_frame(sprite, motion, start, segments, i, base_px)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for {out_path.name}")
    return out_path


def source_peak(path):
    """Absolute peak of a source clip, as decoded.

    Measured with ffmpeg's astats rather than numpy, which this script
    does not otherwise need. aformat=flt matters: astats on an integer
    format cannot report above 0 dBFS, and the whole point here is to
    catch the sources that are ALREADY over it.
    """
    result = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(path),
         "-af", "aformat=sample_fmts=flt,astats=measure_perchannel=none",
         "-f", "null", "-"],
        capture_output=True,
    )
    for line in result.stderr.decode(errors="replace").splitlines():
        if "Peak level dB:" in line:
            return 10 ** (float(line.split("Peak level dB:")[1].strip()) / 20)
    raise RuntimeError(f"Could not read peak level for {path}")


def make_audio(sound, total_seconds):
    """Sound at t=0 and again at the second 'sound' event, padded to length.

    MATLAB stops the speaker when the move begins, but every AG sound in
    this set is <=1.2s, so nothing is ever actually truncated - the two
    plays just land at their event onsets.

    Two corrections are applied to the source before it is placed, both
    found by measuring the built tracks (2026-09-23):

    areverse/silenceremove - TRIM LEADING SILENCE. `adelay` places the
    file, not the sound inside it, so any leading silence in the source
    pushes that play late by exactly that much. giggle.mp3 carries 230ms
    of it where the other four start at 0.000s, which put both its plays
    230ms behind every other sound in the set - audible as "the giggle
    starts late" and, worse, silently inconsistent across the AG factor.
    Trimming at the source fixes both plays at once.

    volume - STOP THE SOURCES CLIPPING. amix runs with normalize=0 (see
    below), so a source above full scale stays above full scale. squeak.mp3
    peaks at 3.41 and bell.mp3 at 1.31 in the originals; both were being
    written out distorted. A measured static gain is used rather than
    alimiter: a limiter is dynamic, so it changes the shape of the
    transient it catches (and, tried first, still left squeak decoding at
    1.43 because lossy encode overshoots). Scaling by a constant keeps the
    waveform intact and is predictable. Only the two hot files are
    touched; the other three peak at 0.51-0.77 and get gain 1.0.
    """
    offsets = []
    elapsed = 0.0
    for kind, dur in build_timeline():
        if kind == "sound":
            offsets.append(elapsed)
        elapsed += dur

    src = AG_SRC / f"{sound}.mp3"
    out_path = OUT / f"ag-sound-{sound}.mp3"
    inputs, filters, labels = [], [], []
    # start_periods=1 trims only the ONE silent run at the head, so any
    # internal pause in a sound is preserved. Headroom is 0.8 rather than
    # ~1.0 because lossy encoding overshoots on sharp transients, and the
    # decoded file is what the browser plays.
    peak = source_peak(src)
    gain = min(1.0, 0.8 / peak) if peak > 0 else 1.0
    clean = (
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,"
        f"volume={gain:.6f}"
    )
    for idx, offset in enumerate(offsets):
        inputs += ["-i", str(src)]
        ms = int(round(offset * 1000))
        filters.append(f"[{idx}:a]{clean},adelay={ms}|{ms}[d{idx}]")
        labels.append(f"[d{idx}]")
    # normalize=0 keeps each play at its original level instead of dividing
    # by the number of mixed inputs.
    filters.append(
        f"{''.join(labels)}amix=inputs={len(offsets)}:duration=longest:normalize=0,"
        f"apad,atrim=0:{total_seconds}[out]"
    )
    cmd = (["ffmpeg", "-y", "-loglevel", "error"] + inputs
           + ["-filter_complex", ";".join(filters), "-map", "[out]",
              "-c:a", "libmp3lame", "-q:a", "4", str(out_path)])
    subprocess.run(cmd, check=True)
    return out_path, offsets


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")
    OUT.mkdir(parents=True, exist_ok=True)

    segments = build_timeline()
    total_seconds = sum(d for _, d in segments)
    total_frames = int(round(total_seconds * FPS))

    print(f"event_sequence {EVENT_SEQUENCE} -> "
          f"{' + '.join(f'{k}:{d}s' for k, d in segments)}")
    print(f"total {total_seconds}s @ {FPS}fps = {total_frames} frames, "
          f"{WIDTH}x{HEIGHT}")
    print(f"geometry: shape {IMAGE_WIDTH_PCT}% of width, centres at "
          f"{LEFT_CENTRE_PCT:.3f}% / {RIGHT_CENTRE_PCT:.3f}%, "
          f"orbit radius {ORBIT_RADIUS_PCT:.3f}% "
          f"({ORBIT_RADIUS_DEG} deg)")

    made = 0
    for shape in SHAPES:
        for motion in MOTIONS:
            for side in ("left", "right"):
                path = make_video(shape, motion, side, segments, total_frames)
                made += 1
                print(f"  [{made:2d}/30] {path.name} "
                      f"({path.stat().st_size / 1024:.0f} KB)")

    for sound in SOUNDS:
        path, offsets = make_audio(sound, total_seconds)
        print(f"  audio {path.name} plays at "
              f"{', '.join(f'{o}s' for o in offsets)} "
              f"({path.stat().st_size / 1024:.0f} KB)")

    print(f"\nWrote {made} videos + {len(SOUNDS)} audio tracks to "
          f"{OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
