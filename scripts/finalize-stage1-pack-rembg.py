from __future__ import annotations

import argparse
import io
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rembg import new_session, remove
from scipy.ndimage import binary_fill_holes


DEFAULT_SOURCE_DIR = Path("/Users/macbookair/Documents/Stage 1")
GRID_COLS = 3
GRID_ROWS = 2
ALPHA_THRESHOLD = 20


@dataclass(frozen=True)
class FileMapping:
    source: str
    target: str


FILE_MAP = [
    FileMapping("Stage1Dragon.png", "dragonstage1.png"),
    FileMapping("stage1wolf.png", "wolfstage1.png"),
    FileMapping("stage1kitsune.png", "kitsunestage1.png"),
    FileMapping("stage1owl.png", "owlstage1.png"),
    FileMapping("stage1lion.png", "lionstage1.png"),
    FileMapping("stage1phoenix.png", "phoenixstage1.png"),
    FileMapping("stage1pegasus.png", "pegasusstage1.png"),
    FileMapping("Stage1Griffin.png", "griffinstage1.png"),
    FileMapping("stage1sphinx.png", "sphinxstage1.png"),
    FileMapping("stage1leviathan.png", "leviathanstage1.png"),
    FileMapping("stage1mechanicaldragon.png", "mechanicaldragonstage1.png"),
    FileMapping("stage1tanuki.png", "tanukistage1.png"),
    FileMapping("Stage1Buttercat.png", "buttercatstage1.png"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=str(DEFAULT_SOURCE_DIR))
    parser.add_argument("--output")
    parser.add_argument("--backup")
    parser.add_argument("--qa")
    parser.add_argument("--replace-root", action="store_true")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def tile_box(width: int, height: int, col: int, row: int) -> tuple[int, int, int, int]:
    left = round(col * width / GRID_COLS)
    right = round((col + 1) * width / GRID_COLS)
    top = round(row * height / GRID_ROWS)
    bottom = round((row + 1) * height / GRID_ROWS)
    return left, top, right, bottom


def extract_tile_alpha(session, tile: Image.Image) -> np.ndarray:
    buffer = io.BytesIO()
    tile.save(buffer, format="PNG")
    removed = remove(buffer.getvalue(), session=session)
    mask_image = Image.open(io.BytesIO(removed)).convert("RGBA")
    alpha = np.array(mask_image.getchannel("A"))
    filled = binary_fill_holes(alpha > ALPHA_THRESHOLD)
    return (filled * 255).astype(np.uint8)


def render_sheet(session, source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGBA")
    width, height = source.size
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            left, top, right, bottom = tile_box(width, height, col, row)
            tile = source.crop((left, top, right, bottom))
            rgba = np.array(tile)
            rgba[..., 3] = extract_tile_alpha(session, tile)
            output.alpha_composite(Image.fromarray(rgba), (left, top))

    return output


def image_stats(image_path: Path) -> dict:
    image = Image.open(image_path).convert("RGBA")
    alpha = np.array(image.getchannel("A"))
    non_opaque = int(np.count_nonzero(alpha < 255))
    transparent = int(np.count_nonzero(alpha == 0))
    return {
        "width": image.width,
        "height": image.height,
        "hasAlpha": non_opaque > 0,
        "transparentPixels": transparent,
        "nonOpaquePixels": non_opaque,
    }


def checkerboard(size: tuple[int, int], square: int = 24) -> Image.Image:
    image = Image.new("RGBA", size, "#f3f4f6")
    draw = ImageDraw.Draw(image)
    width, height = size
    for y in range(0, height, square):
        for x in range(0, width, square):
            if ((x // square) + (y // square)) % 2 == 0:
                draw.rectangle((x, y, x + square - 1, y + square - 1), fill="#d1d5db")
    return image


def render_preview(files: list[Path], output_path: Path) -> None:
    thumb_size = (220, 220)
    label_height = 24
    gutter = 20
    panel_gap = 32
    cols = 3
    rows = (len(files) + cols - 1) // cols
    panel_width = cols * thumb_size[0] + (cols + 1) * gutter
    panel_height = rows * (thumb_size[1] + label_height) + (rows + 1) * gutter + 64
    canvas = Image.new("RGBA", (panel_width * 2 + panel_gap + 40, panel_height), "#020617")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    light_panel = (20, 64, 20 + panel_width, panel_height - 20)
    dark_panel = (20 + panel_width + panel_gap, 64, 20 + panel_width * 2 + panel_gap, panel_height - 20)
    draw.rounded_rectangle(light_panel, radius=18, fill="#ffffff")
    draw.rounded_rectangle(dark_panel, radius=18, fill="#020617")
    draw.text((20 + panel_width // 2 - 56, 18), "Light Background", fill="#e2e8f0", font=font)
    draw.text((20 + panel_width + panel_gap + panel_width // 2 - 52, 18), "Dark Background", fill="#e2e8f0", font=font)

    for index, file_path in enumerate(files):
        image = Image.open(file_path).convert("RGBA")
        thumb = image.copy()
        thumb.thumbnail(thumb_size)

        col = index % cols
        row = index // cols
        left = gutter + col * (thumb_size[0] + gutter)
        top = 76 + gutter + row * (thumb_size[1] + label_height + gutter)

        light_thumb = checkerboard(thumb_size)
        dark_thumb = Image.new("RGBA", thumb_size, "#020617")
        offset = ((thumb_size[0] - thumb.width) // 2, (thumb_size[1] - thumb.height) // 2)
        light_thumb.alpha_composite(thumb, offset)
        dark_thumb.alpha_composite(thumb, offset)

        canvas.alpha_composite(light_thumb, (20 + left, top))
        canvas.alpha_composite(dark_thumb, (20 + panel_width + panel_gap + left, top))
        draw.rounded_rectangle((20 + left, top + thumb_size[1] + 4, 20 + left + thumb_size[0], top + thumb_size[1] + 22), radius=8, fill="#1e293b")
        draw.rounded_rectangle((20 + panel_width + panel_gap + left, top + thumb_size[1] + 4, 20 + panel_width + panel_gap + left + thumb_size[0], top + thumb_size[1] + 22), radius=8, fill="#1e293b")
        label = file_path.name
        draw.text((26 + left, top + thumb_size[1] + 8), label, fill="#f8fafc", font=font)
        draw.text((26 + panel_width + panel_gap + left, top + thumb_size[1] + 8), label, fill="#f8fafc", font=font)

    canvas.save(output_path)


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source)
    output_dir = Path(args.output) if args.output else source_dir
    timestamp = datetime.now().isoformat().replace(":", "-").replace(".", "-")
    backup_dir = Path(args.backup) if args.backup else source_dir / f"_backup_{timestamp}"
    qa_dir = Path(args.qa) if args.qa else output_dir / "_qa"

    ensure_dir(output_dir)
    ensure_dir(backup_dir)
    ensure_dir(qa_dir)

    session = new_session("u2net")
    summary = []
    final_files: list[Path] = []

    for mapping in FILE_MAP:
        source_path = source_dir / mapping.source
        if not source_path.exists():
            raise FileNotFoundError(source_path)

        backup_path = backup_dir / mapping.source
        if not backup_path.exists():
            backup_path.write_bytes(source_path.read_bytes())

        output_path = output_dir / mapping.target
        result = render_sheet(session, source_path)
        result.save(output_path)

        if args.replace_root and source_dir == output_dir and source_path != output_path and source_path.exists():
            source_path.unlink()

        stats = image_stats(output_path)
        summary.append({
            "source": mapping.source,
            "target": mapping.target,
            **stats,
        })
        final_files.append(output_path)

    render_preview(final_files, qa_dir / "stage1_final_dark_light.png")
    (qa_dir / "stage1_final_summary.json").write_text(f"{json.dumps(summary, indent=2)}\n")

    print(json.dumps({
        "sourceDir": str(source_dir),
        "outputDir": str(output_dir),
        "backupDir": str(backup_dir),
        "qaDir": str(qa_dir),
        "replaceRoot": args.replace_root,
        "finalizedFiles": [path.name for path in final_files],
    }, indent=2))


if __name__ == "__main__":
    main()
