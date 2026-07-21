from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/m5/v2/exploration/events/source"
RUNTIME = ROOT / "assets/m5/v2/exploration/events/runtime"


def center_crop_16_9(image: Image.Image) -> Image.Image:
    target_h = round(image.width * 9 / 16)
    top = (image.height - target_h) // 2
    return image.crop((0, top, image.width, top + target_h)).resize((768, 432), Image.Resampling.LANCZOS).convert("RGB")


def rms(a: Image.Image, b: Image.Image) -> float:
    stat = ImageStat.Stat(ImageChops.difference(a, b))
    return sum(value * value for value in stat.rms) ** 0.5


source_files = sorted(SOURCE.glob("*.png"))
runtime_files = sorted(RUNTIME.glob("*.png"))
source_names = [item.name for item in source_files]
runtime_names = [item.name for item in runtime_files]
if len(source_files) != 12 or len(runtime_files) != 12:
    raise SystemExit(f"FAIL: expected 12 source and 12 runtime images, got {len(source_files)} and {len(runtime_files)}")
if source_names != runtime_names:
    raise SystemExit("FAIL: source/runtime basenames differ")

expected = {item.name: center_crop_16_9(Image.open(item)) for item in source_files}
for runtime_path in runtime_files:
    with Image.open(runtime_path) as image:
        if image.size != (768, 432):
            raise SystemExit(f"FAIL: {runtime_path.name} size is {image.size}, expected 768x432")
        runtime = image.convert("RGB")
    own_score = rms(runtime, expected[runtime_path.name])
    wrong_scores = [rms(runtime, candidate) for name, candidate in expected.items() if name != runtime_path.name]
    best_wrong = min(wrong_scores)
    # Runtime 由 System.Drawing bicubic 產生，Pillow LANCZOS 重建會有少量濾鏡差異。
    if own_score > 20.0:
        raise SystemExit(f"FAIL: {runtime_path.name} differs from its own centered source crop (RMS {own_score:.2f})")
    if own_score >= best_wrong:
        raise SystemExit(f"FAIL: {runtime_path.name} is closer to another source ({best_wrong:.2f}) than its own ({own_score:.2f})")
    print(f"OK {runtime_path.name}: own={own_score:.2f}, nearest-wrong={best_wrong:.2f}")

print("Exploration event image validation passed: all 12 runtime images match their own single-image sources.")
