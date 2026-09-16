from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "town-hd2d" / "source"
RUNTIME = ROOT / "assets" / "town-hd2d" / "runtime"

ASSETS = {
    "p4-yuegang-stone-source.png": ("p4-yuegang-stone.png", "RGB"),
    "p4-yuegang-water-source.png": ("p4-yuegang-water.png", "RGB"),
    "p4-yuegang-tree-source.png": ("p4-yuegang-tree.png", "RGBA"),
}


def main() -> None:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for source_name, (runtime_name, mode) in ASSETS.items():
        source_path = SOURCE / source_name
        if not source_path.exists():
            raise SystemExit(f"missing source: {source_path}")
        with Image.open(source_path) as image:
            image = image.convert(mode)
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            canvas = Image.new(mode, (1024, 1024), (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0))
            canvas.paste(image, ((1024 - image.width) // 2, 1024 - image.height), image if mode == "RGBA" else None)
            image = canvas
            image.save(RUNTIME / runtime_name, optimize=True)
        print(f"built {runtime_name}: 1024x1024 {mode}")


if __name__ == "__main__":
    main()
