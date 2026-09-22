"""Turns raw captures into the four screenshots of the store page, in docs/store.

The store accepts 1280x800 or 640x400, PNG without an alpha channel. A capture
is cropped on the feature it is there to show, then fitted inside that frame on
the dark ground of the site rather than stretched.

    python tools/make-screenshots.py <directory holding the raw captures>

The raw captures are NOT versioned: they show a real collection and real
player names, like everything under tests/fixtures/raw. Every box below was
measured on the captures of 2026-09-21, in their own pixels, so a new set of
captures needs its boxes measured again rather than reused.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "store"

STORE_SIZE = (1280, 800)
# The ground the site paints its pages on, so the bands left by a capture that
# does not share the frame's ratio do not read as a white border.
BACKGROUND = (10, 10, 10)

# Side of one square of the mosaic, in pixels of the capture. Ten is coarse
# enough that no letter survives it at any zoom.
PIXEL_BLOCK = 10

Box = tuple[int, int, int, int]

SHOTS: list[tuple[str, str, Box | None, list[Box]]] = [
    # The pull tally, under the packs left to open. The whole pack is kept:
    # cutting it to enlarge the panel made the frame look broken.
    ("37.png", "1-statistiques-de-tirage.png", (522, 140, 1642, 840), []),
    # The detail modal: the Letterboxd link under the one of the site, and the
    # two marks in the bottom right corner of the card it shows.
    ("38.webp", "2-liens-wikipedia-letterboxd.png", (166, 90, 1126, 690), []),
    # The compact view, whole page: what it changes is how much fits on screen,
    # so the page is shown entire rather than cropped.
    ("39.webp", "3-vue-compacte.png", None, []),
    # The cards drawn in place of the truncated chips of the trade offers. The
    # names of the other players are pixelated: they are their data, not ours,
    # and a store page is not where they belong. The mosaic stops before the
    # status of the offer, which stays readable.
    (
        "40.png",
        "4-cartes-des-echanges.png",
        (280, 170, 1240, 770),
        [
            (331, 203, 399, 225),
            (308, 237, 367, 257),
            (331, 443, 399, 465),
            (308, 477, 367, 497),
            (331, 680, 399, 702),
            (308, 714, 367, 734),
        ],
    ),
]


def pixelate(image: Image.Image, regions: list[Box]) -> Image.Image:
    """Hides the name of another player, which has no business on a store page."""
    for box in regions:
        width, height = box[2] - box[0], box[3] - box[1]
        mosaic = image.crop(box).resize(
            (max(width // PIXEL_BLOCK, 1), max(height // PIXEL_BLOCK, 1)), Image.BILINEAR
        )
        image.paste(mosaic.resize((width, height), Image.NEAREST), box)
    return image


def to_store(image: Image.Image, box: Box | None) -> Image.Image:
    """Crops, then fits whole inside the frame the store asks for."""
    if box is not None:
        image = image.crop(box)
    ratio = min(STORE_SIZE[0] / image.width, STORE_SIZE[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.LANCZOS)
    canvas = Image.new("RGB", STORE_SIZE, BACKGROUND)
    canvas.paste(resized, ((STORE_SIZE[0] - resized.width) // 2, (STORE_SIZE[1] - resized.height) // 2))
    return canvas


def main(source: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, target, box, regions in SHOTS:
        # "RGB" and not "RGBA": the store refuses an alpha channel.
        image = Image.open(source / name).convert("RGB")
        if regions:
            image = pixelate(image, regions)
        path = OUT / target
        to_store(image, box).save(path)
        print("wrote", path.relative_to(ROOT), STORE_SIZE)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
