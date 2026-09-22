"""Writes the two promotional banners of the store page, in docs/store.

They are composed of the mark and the palette of the extension, never of a
screenshot: a card of the game has no business on a picture whose only job is
to advertise.

    python tools/make-promo.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from icon import ACCENT, SURFACE, draw_icon

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "store"

SANS_BOLD = "C:/Windows/Fonts/Roboto-Bold.ttf"
SANS_MEDIUM = "C:/Windows/Fonts/Roboto-Medium.ttf"
SANS = "C:/Windows/Fonts/Roboto-Regular.ttf"

TEXT = (255, 255, 255)
TEXT_DIM = (170, 178, 188)

TITLE = "WikiMasters Extended"
SUBTITLE = "Un overlay en lecture seule pour wiki-masters.com"
LINES = [
    "Une image sur les cartes qui n'en ont aucune",
    "L'article de Wikipédia et le film sur Letterboxd, à un clic",
    "Vue compacte, statistiques de tirage, et quatre autres réglages",
]

# How much of the dark surface the halo lifts, out of 255.
HALO_STRENGTH = 70

SMALL_TILE_SIZE = (440, 280)
MARQUEE_SIZE = (1400, 560)


def background(size: tuple[int, int], halo_at: tuple[int, int], halo_radius: int) -> Image.Image:
    """The dark surface of the extension, lifted by one halo of the accent."""
    canvas = Image.new("RGB", size, SURFACE)
    halo = Image.new("L", size, 0)
    ImageDraw.Draw(halo).ellipse(
        [
            halo_at[0] - halo_radius,
            halo_at[1] - halo_radius,
            halo_at[0] + halo_radius,
            halo_at[1] + halo_radius,
        ],
        fill=HALO_STRENGTH,
    )
    halo = halo.filter(ImageFilter.GaussianBlur(halo_radius / 2))
    return Image.composite(Image.new("RGB", size, ACCENT), canvas, halo)


def centred(
    draw: ImageDraw.ImageDraw,
    top: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    width: int,
) -> None:
    left, _, right, _ = draw.textbbox((0, 0), text, font=font)
    draw.text(((width - (right - left)) / 2 - left, top), text, font=font, fill=fill)


def small_tile() -> Image.Image:
    """The thumbnail of the store grids, which also decides whether the
    extension is eligible to be featured at all."""
    image = background(SMALL_TILE_SIZE, (220, 92), 150)
    icon = draw_icon(96)
    image.paste(icon, (172, 40), icon)

    draw = ImageDraw.Draw(image)
    centred(draw, 162, TITLE, ImageFont.truetype(SANS_BOLD, 27), TEXT, SMALL_TILE_SIZE[0])
    centred(draw, 205, SUBTITLE, ImageFont.truetype(SANS, 14), TEXT_DIM, SMALL_TILE_SIZE[0])
    return image


def marquee() -> Image.Image:
    """The wide banner, shown only if the extension is actually featured."""
    # The halo sits at the centre of the banner, not behind the icon: off to
    # one side it drew a visible edge down the middle of the picture.
    image = background(MARQUEE_SIZE, (700, 280), 560)
    draw = ImageDraw.Draw(image)

    title_font = ImageFont.truetype(SANS_BOLD, 62)
    subtitle_font = ImageFont.truetype(SANS, 26)
    bullet_font = ImageFont.truetype(SANS_MEDIUM, 22)
    icon_size, gap, bullet_indent = 224, 62, 24

    widths = [draw.textlength(TITLE, font=title_font), draw.textlength(SUBTITLE, font=subtitle_font)]
    widths += [bullet_indent + draw.textlength(line, font=bullet_font) for line in LINES]
    text_width = max(widths)

    # Icon and text are centred as one block, so the banner is not left heavy.
    left = (MARQUEE_SIZE[0] - (icon_size + gap + text_width)) / 2
    text_left = left + icon_size + gap

    icon = draw_icon(icon_size)
    image.paste(icon, (round(left), 168), icon)
    draw.text((text_left, 168), TITLE, font=title_font, fill=TEXT)
    draw.text((text_left + 4, 252), SUBTITLE, font=subtitle_font, fill=TEXT_DIM)

    for index, line in enumerate(LINES):
        top = 318 + index * 38
        draw.rectangle([text_left + 4, top + 9, text_left + 12, top + 17], fill=ACCENT)
        draw.text((text_left + bullet_indent + 4, top), line, font=bullet_font, fill=TEXT_DIM)
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, image in (("5-promo-440x280.png", small_tile()), ("6-promo-1400x560.png", marquee())):
        path = OUT / name
        image.save(path)
        print("wrote", path.relative_to(ROOT), image.size, image.mode)


if __name__ == "__main__":
    main()
