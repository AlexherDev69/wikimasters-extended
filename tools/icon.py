"""The mark of the extension: a serif W on its dark tile, with the plus that
says Extended in the accent colour.

Drawn here once and imported by the two scripts that need it, the icon set of
the manifest and the promotional banners of the store page, so the mark can
never end up meaning two different things from one picture to the next.
"""

from PIL import Image, ImageDraw, ImageFont

# Cambria is a Windows face and shipped with Office elsewhere. A different
# serif changes the letter, so the mark is regenerated with the one it was
# drawn with, or every size of it is regenerated at once.
FONT = "C:/Windows/Fonts/cambriab.ttf"

SURFACE = (9, 12, 17)
BORDER = (255, 255, 255, 40)
LETTER = (255, 255, 255, 235)
ACCENT = (108, 183, 224)

OPAQUE = 255
TRANSPARENT = (0, 0, 0, 0)

# Everything below is a fraction of the side of the tile, so one set of
# numbers draws the mark at any size asked for.
RADIUS = 0.235
BORDER_WIDTH = 0.016
LETTER_WIDTH = 0.60
LETTER_CENTER = (0.435, 0.545)
PLUS_CENTER = (0.775, 0.245)
PLUS_ARM = 0.135
PLUS_THICKNESS = 0.085

# The tile is drawn this many times too big and scaled down, which is what
# gives the rounded corners and the letter their clean edges.
SUPERSAMPLE = 8

MIN_PLUS_ARM = 2
MIN_PLUS_THICKNESS = 1
# Below four pixels a rounded bar has no room for its ends and reads as a dot.
ROUNDED_PLUS_THICKNESS = 4


def fitted_font(target_width: float) -> ImageFont.FreeTypeFont:
    """The size at which the W is exactly the asked width."""
    size = int(target_width)
    while True:
        font = ImageFont.truetype(FONT, size)
        left, _, right, _ = font.getbbox("W")
        if right - left >= target_width or size > target_width * 4:
            return ImageFont.truetype(FONT, max(size - 1, 1))
        size += 1


def draw_tile(size: int) -> Image.Image:
    """The rounded tile and its letter, supersampled and scaled back down."""
    side = size * SUPERSAMPLE
    image = Image.new("RGBA", (side, side), TRANSPARENT)
    draw = ImageDraw.Draw(image)

    box = [0, 0, side - 1, side - 1]
    radius = side * RADIUS
    draw.rounded_rectangle(box, radius=radius, fill=SURFACE + (OPAQUE,))
    draw.rounded_rectangle(
        box, radius=radius, outline=BORDER, width=max(int(side * BORDER_WIDTH), 1)
    )

    font = fitted_font(side * LETTER_WIDTH)
    left, top, right, bottom = font.getbbox("W")
    draw.text(
        (side * LETTER_CENTER[0] - (left + right) / 2, side * LETTER_CENTER[1] - (top + bottom) / 2),
        "W",
        font=font,
        fill=LETTER,
    )
    return image.resize((size, size), Image.LANCZOS)


def draw_plus(tile: Image.Image, size: int) -> None:
    """The plus of Extended, on the finished tile and on whole pixels.

    A supersampled one turns into a blue smudge at 16 px, where its bars are
    barely a pixel wide and the resampling spreads them over their neighbours.
    """
    draw = ImageDraw.Draw(tile)
    centre_x, centre_y = round(size * PLUS_CENTER[0]), round(size * PLUS_CENTER[1])
    arm = max(round(size * PLUS_ARM), MIN_PLUS_ARM)
    thickness = max(round(size * PLUS_THICKNESS), MIN_PLUS_THICKNESS)
    back, front = (thickness - 1) // 2, thickness // 2

    for bar in (
        [centre_x - arm, centre_y - back, centre_x + arm, centre_y + front],
        [centre_x - back, centre_y - arm, centre_x + front, centre_y + arm],
    ):
        if thickness >= ROUNDED_PLUS_THICKNESS:
            draw.rounded_rectangle(bar, radius=thickness / 2, fill=ACCENT + (OPAQUE,))
        else:
            draw.rectangle(bar, fill=ACCENT + (OPAQUE,))


def draw_icon(size: int) -> Image.Image:
    """The whole mark, at the asked side in pixels."""
    tile = draw_tile(size)
    draw_plus(tile, size)
    return tile
