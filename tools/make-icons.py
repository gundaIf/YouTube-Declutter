"""Draws the YouTube Declutter mark as a linocut print: a play screen cut from a black ink
block, pressed onto cream paper. Writes icons/mark.svg and the toolbar PNGs.

    python3 tools/make-icons.py

Needs Pillow for the PNGs. Seeded, so every run draws the same print.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

INK = (24, 22, 19)
INK_OFF = (150, 144, 132)
PAPER = (234, 226, 206)
PLATE = (242, 236, 220)
ICONS = Path(__file__).resolve().parent.parent / "icons"


# Cutting

def rounded_rect(x0, y0, x1, y1, r, steps=8):
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(steps + 1):
            a = math.radians(a0 + 90 * i / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def resample(loop, step):
    out, carry = [], 0.0
    for a, b in zip(loop, loop[1:] + loop[:1]):
        length = math.dist(a, b)
        d = carry
        while d < length:
            out.append((a[0] + (b[0] - a[0]) * d / length, a[1] + (b[1] - a[1]) * d / length))
            d += step
        carry = d - length
    return out


def rough(loop, wobble, step, rng, chips=True):
    """Re-traces a closed loop with a hand-cut edge: slow wobble, fine jitter, the odd chip."""
    pts = resample(loop, step)
    n, period = len(pts), 7
    knots = [rng.uniform(-1, 1) for _ in range((n + period - 1) // period)]
    out, chip, depth = [], 0, 0.0
    for i, p in enumerate(pts):
        a, b = pts[i - 1], pts[(i + 1) % n]
        length = max(math.dist(a, b), 1e-4)
        nx, ny = (b[1] - a[1]) / length, (a[0] - b[0]) / length
        k = i / period
        k0, t = int(k), k - int(k)
        e = t * t * (3 - 2 * t)
        slow = knots[k0 % len(knots)] * (1 - e) + knots[(k0 + 1) % len(knots)] * e
        if chips and chip == 0 and rng.random() < 0.03:
            chip, depth = rng.randint(2, 4), rng.uniform(1, 2)
        d = wobble * (slow + rng.uniform(-0.35, 0.35))
        if chip:
            d += wobble * depth
            chip -= 1
        out.append((p[0] + nx * d, p[1] + ny * d))
    return out


def inside(poly, x, y):
    hit = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


# Composition

def print_mark(size, seed=7, plate=True, grain=True, off=False):
    """Returns the shapes of one pull, on a 128 grid: plate edge, ink block, carved cuts, flecks."""
    rng = random.Random(seed)
    s = 128
    shapes = {"plate": None, "block": None, "cuts": [], "flecks": []}
    if plate:
        shapes["plate"] = rough(rounded_rect(9, 9, s - 9, s - 9, 3), 0.7, 1.4, rng, chips=False)
        block = rounded_rect(20, 30, 108, 98, 15)
        play = [(53, 47), (53, 81), (84, 64)]
    else:  # small sizes: the block fills the square and the cut is bolder
        block = rounded_rect(6, 20, 122, 108, 22)
        play = [(44, 34), (44, 94), (98, 64)]
    wob = 1.0 if plate else (1.6 if grain else 0.6)
    shapes["block"] = rough(block, wob, 2.2, rng)
    shapes["cuts"].append(rough(play, wob * 0.8, 2, rng))
    if grain:
        cut_rng = random.Random(seed + 1)
        for _ in range(4):  # gouge slivers
            cx, cy = cut_rng.uniform(30, 98), cut_rng.choice((cut_rng.uniform(38, 46), cut_rng.uniform(84, 90)))
            ang, ln = cut_rng.uniform(0, math.pi), cut_rng.uniform(3, 6)
            dx, dy = math.cos(ang), math.sin(ang)
            w = ln * 0.3
            shapes["cuts"].append([(cx - dx * ln, cy - dy * ln), (cx - dy * w, cy + dx * w),
                                   (cx + dx * ln * 0.8, cy + dy * ln * 0.8), (cx + dy * w * 0.5, cy - dx * w * 0.5)])
        xs = [p[0] for p in shapes["block"]]
        ys = [p[1] for p in shapes["block"]]
        tries = 0
        while len(shapes["flecks"]) < 480 and tries < 9000:
            tries += 1
            x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
            if inside(shapes["block"], x, y) and not inside(shapes["cuts"][0], x, y):
                r = rng.random() ** 5 * 0.75 + 0.15
                shapes["flecks"].append((x, y, r))
        for p in shapes["block"][::2]:  # worn edge
            if rng.random() < 0.5:
                shapes["flecks"].append((p[0] + rng.uniform(-1, 1), p[1] + rng.uniform(-1, 1), rng.uniform(0.25, 0.7)))
    shapes["ink"] = INK_OFF if off else INK
    return shapes


# Output

def hexc(c):
    return "#%02x%02x%02x" % c


def path(poly):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in poly) + " Z"


def write_svg(shapes, dest):
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="YouTube Declutter">',
           f'  <rect width="128" height="128" fill="{hexc(PAPER)}"/>']
    if shapes["plate"]:
        out.append(f'  <path d="{path(shapes["plate"])}" fill="{hexc(PLATE)}" stroke="#000" stroke-opacity=".14" stroke-width=".6"/>')
    out.append(f'  <path d="{path(shapes["block"])}" fill="{hexc(shapes["ink"])}"/>')
    out.append(f'  <g fill="{hexc(PLATE)}">')
    out += [f'    <path d="{path(c)}"/>' for c in shapes["cuts"]]
    out += [f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" opacity=".85"/>' for x, y, r in shapes["flecks"]]
    out += ["  </g>", "</svg>", ""]
    dest.write_text("\n".join(out))


def write_png(shapes, size, dest):
    k = size * 8 / 128  # draw at 8x, then scale down for smooth edges
    big = size * 8
    img = Image.new("RGB", (big, big), PAPER)
    draw = ImageDraw.Draw(img)
    sc = lambda poly: [(x * k, y * k) for x, y in poly]
    if shapes["plate"]:
        draw.polygon(sc([(x, y + 0.5) for x, y in shapes["plate"]]), fill=(208, 199, 178))
        draw.polygon(sc(shapes["plate"]), fill=PLATE)
    draw.polygon(sc(shapes["block"]), fill=shapes["ink"])
    for c in shapes["cuts"]:
        draw.polygon(sc(c), fill=PLATE)
    for x, y, r in shapes["flecks"]:
        draw.ellipse((x * k - r * k, y * k - r * k, x * k + r * k, y * k + r * k), fill=PLATE)
    img.resize((size, size), Image.LANCZOS).save(dest, optimize=True)


def main():
    write_svg(print_mark(128), ICONS / "mark.svg")
    write_png(print_mark(128), 128, ICONS / "icon128.png")
    write_png(print_mark(128, off=True), 128, ICONS / "icon128-off.png")
    write_png(print_mark(48, plate=False), 48, ICONS / "icon48.png")
    write_png(print_mark(16, plate=False, grain=False), 16, ICONS / "icon16.png")
    print("icons ready")


if __name__ == "__main__":
    main()
