"""Writes the icon set of the manifest, in public/icon.

WXT resolves its public directory against the PROJECT ROOT, never against
srcDir, and src/public is therefore never copied. It then finds every
<size>.png under icon/ or icons/ on its own and fills the icons field of the
manifest with them: nothing about these files is declared in wxt.config.ts.

    python tools/make-icons.py
"""

from pathlib import Path

from icon import draw_icon

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icon"

# The four sizes Chrome asks an extension for: the toolbar, its retina
# counterpart, the extensions page, and the store listing.
SIZES = [16, 32, 48, 128]

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT / f"{size}.png"
        draw_icon(size).save(path)
        print("wrote", path.relative_to(ROOT), path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
