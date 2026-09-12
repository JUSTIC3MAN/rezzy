#!/usr/bin/env python3
"""Regenerate the iOS app icon and launch screen from the game's own artwork.

    python store-assets/make-icon.py

Writes:
    store-assets/app-store-icon-1024.png                    the App Store icon
    ios/App/App/Assets.xcassets/AppIcon.appiconset/...      what the app builds with
    ios/App/App/Assets.xcassets/Splash.imageset/...         the launch screen

Two rules Apple enforces and this script obeys: the icon carries no alpha
channel, and it has square corners. iOS applies its own rounded-rect mask, so
an icon that arrives pre-rounded gets rounded twice and comes out pinched.
"""

from pathlib import Path
from PIL import Image, ImageFilter
import math

HERE = Path(__file__).resolve().parent
IOS  = HERE.parent
WEB  = IOS.parent

SOURCE = WEB / 'Items' / 'FairyInBottle.png'

# Deep indigo, lifted slightly at the centre so the bottle sits in its own light.
# Anything fainter than this is halo, not artwork.
ALPHA_FLOOR = 64

CENTER = (44, 28, 82)
EDGE   = (16, 9, 34)


def ground(size, center=CENTER, edge=EDGE, falloff=1.15):
    """A radial gradient, built by hand — PIL has no gradient primitive."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    half = size / 2
    longest = math.hypot(half, half)
    for y in range(size):
        dy = y - half
        for x in range(size):
            t = min(1.0, (math.hypot(x - half, dy) / longest) ** falloff)
            px[x, y] = tuple(int(c + (e - c) * t) for c, e in zip(center, edge))
    return img


def glow(bottle, size, spread, strength):
    """A soft bloom behind the bottle, coloured by the bottle itself."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    layer.paste(bottle, (0, 0), bottle)
    layer = layer.filter(ImageFilter.GaussianBlur(spread))
    alpha = layer.getchannel('A').point(lambda a: int(a * strength))
    layer.putalpha(alpha)
    return layer


def compose(size, bottle_fraction, glow_spread, glow_strength):
    src = Image.open(SOURCE).convert('RGBA')

    # The sprite carries uneven transparent margin — more below the bottle than
    # above it — so pasting it as-is puts the artwork off-centre by a visible
    # margin at 1024px. Trim to what is actually drawn and centre that instead.
    #
    # A plain getbbox() finds nothing here: the sprite has a faint alpha halo
    # reaching every edge, so by that measure the art already fills the frame.
    # Threshold first, and the real silhouette appears.
    solid = src.getchannel('A').point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    box = solid.getbbox()
    if box:
        src = src.crop(box)

    # Fit the trimmed art inside a square of the requested fraction, keeping
    # its aspect ratio.
    edge = int(size * bottle_fraction)
    scale = edge / max(src.size)
    art = src.resize((max(1, round(src.width * scale)),
                      max(1, round(src.height * scale))), Image.LANCZOS)

    placed = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    placed.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)

    canvas = ground(size).convert('RGBA')
    canvas.alpha_composite(glow(placed, size, glow_spread, glow_strength))
    canvas.alpha_composite(placed)
    return canvas.convert('RGB')          # drop alpha — Apple rejects icons with it


def main():
    icon = compose(1024, 0.78, glow_spread=34, glow_strength=0.55)
    HERE.mkdir(exist_ok=True)
    icon.save(HERE / 'app-store-icon-1024.png')

    appicon = IOS / 'ios' / 'App' / 'App' / 'Assets.xcassets' / 'AppIcon.appiconset'
    if appicon.is_dir():
        icon.save(appicon / 'AppIcon-512@2x.png')

    # Launch screen. Darker and quieter than the icon: it is on screen for a
    # fraction of a second and the first game frame is nearly black.
    splash = compose(2732, 0.22, glow_spread=60, glow_strength=0.40)
    splashset = IOS / 'ios' / 'App' / 'App' / 'Assets.xcassets' / 'Splash.imageset'
    if splashset.is_dir():
        for name in ('splash-2732x2732.png',
                     'splash-2732x2732-1.png',
                     'splash-2732x2732-2.png'):
            splash.save(splashset / name)

    print('  ✓ icon 1024×1024, RGB, square corners')
    print('  ✓ launch screen 2732×2732')


if __name__ == '__main__':
    main()
