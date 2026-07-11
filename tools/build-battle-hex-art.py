from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "assets" / "m5" / "v2" / "battle-hex"
SRC, PROCESSED, OUT = PACK / "source", PACK / "processed", PACK / "runtime"
DIRECTIONS = ["east", "southeast", "southwest", "west", "northwest", "northeast"]
SHIPS = {
    "junk_small": ("小戎克船", 184), "junk_large": ("大戎克船", 214),
    "fuchuan": ("福船", 222), "shuinsen": ("朱印船", 204),
    "caravel": ("卡拉維爾帆船", 196), "fluyt": ("笛型船", 210),
    "carrack": ("克拉克帆船", 232), "galleon": ("蓋倫帆船", 238),
}
ISLANDS = ["palm_islet", "rocky_island", "twin_island", "crescent_reef", "bare_rocks", "mangrove_islet"]
EFFECTS = ["cannon_flash", "cannon_smoke", "water_splash", "deck_fire", "surrender_flag", "boarding_hooks"]
COMMANDS = ["turn_left", "turn_right", "cannon", "board", "repair", "wait", "end_turn", "retreat"]


def mkdirs() -> None:
    for p in [OUT / "ships/frames", OUT / "ships/sheets", OUT / "terrain", OUT / "islands",
              OUT / "effects", OUT / "ui/commands", OUT / "ui/overlays", OUT / "ui/markers", PACK / "review"]:
        p.mkdir(parents=True, exist_ok=True)


def cells(img: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    result = []
    for r in range(rows):
        for c in range(cols):
            result.append(img.crop((round(c * img.width / cols), round(r * img.height / rows),
                                    round((c + 1) * img.width / cols), round((r + 1) * img.height / rows))))
    return result


def trim(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    bbox = rgba.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        raise ValueError("transparent cell has no subject")
    return rgba.crop(bbox)


def centered(img: Image.Image, canvas: int, extent: int, scale_override: float | None = None) -> Image.Image:
    scale = scale_override if scale_override is not None else min(extent / img.width, extent / img.height)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    result.alpha_composite(img, ((canvas - img.width) // 2, (canvas - img.height) // 2))
    return result


def build_ships() -> list[dict]:
    entries = []
    for ship_id, (name, extent) in SHIPS.items():
        img = Image.open(PROCESSED / f"{ship_id}_six-directions-source-alpha.png")
        raw = [trim(x) for x in cells(img, 3, 2)]
        common_scale = extent / max(max(x.width, x.height) for x in raw)
        frames, paths = [], []
        for direction, item in zip(DIRECTIONS, raw):
            frame = centered(item, 256, extent, common_scale)
            path = OUT / "ships/frames" / f"{ship_id}_{direction}.png"
            frame.save(path, optimize=True)
            frames.append(frame); paths.append(path.relative_to(PACK).as_posix())
        sheet = Image.new("RGBA", (1536, 256), (0, 0, 0, 0))
        for i, frame in enumerate(frames): sheet.alpha_composite(frame, (i * 256, 0))
        sheet_path = OUT / "ships/sheets" / f"{ship_id}.png"; sheet.save(sheet_path, optimize=True)
        entries.append({"id": ship_id, "name": name, "frameSize": [256, 256], "directions": DIRECTIONS,
                        "frames": paths, "sheet": sheet_path.relative_to(PACK).as_posix()})
    return entries


def seamless(img: Image.Image) -> Image.Image:
    base = ImageOps.fit(img.convert("RGB"), (512, 512), method=Image.Resampling.LANCZOS)
    big = Image.new("RGB", (1024, 1024))
    big.paste(base, (0, 0)); big.paste(ImageOps.mirror(base), (512, 0))
    big.paste(ImageOps.flip(base), (0, 512)); big.paste(ImageOps.flip(ImageOps.mirror(base)), (512, 512))
    return big.crop((256, 256, 768, 768))


def build_terrain() -> list[dict]:
    source = Image.open(SRC / "environment/ocean-terrain-source.png")
    result = []
    for item_id, item in zip(["deep", "shallow", "reef"], cells(source, 3, 1)):
        path = OUT / "terrain" / f"{item_id}.png"; seamless(item).save(path, optimize=True)
        result.append({"id": item_id, "size": [512, 512], "path": path.relative_to(PACK).as_posix()})
    return result


def alpha_grid(source: Path, ids: list[str], folder: str, canvas: int, extent: int) -> list[dict]:
    result = []
    for item_id, item in zip(ids, cells(Image.open(source), 3, 2)):
        image = centered(trim(item), canvas, extent)
        path = OUT / folder / f"{item_id}.png"; image.save(path, optimize=True)
        result.append({"id": item_id, "size": [canvas, canvas], "path": path.relative_to(PACK).as_posix()})
    return result


def build_commands() -> list[dict]:
    result = []
    for item_id, item in zip(COMMANDS, cells(Image.open(SRC / "ui/command-icons-source.png"), 4, 2)):
        image = ImageOps.fit(item.convert("RGB"), (256, 256), method=Image.Resampling.LANCZOS)
        path = OUT / "ui/commands" / f"{item_id}.png"; image.save(path, optimize=True)
        result.append({"id": item_id, "size": [256, 256], "path": path.relative_to(PACK).as_posix()})
    return result


def aa_image(size: tuple[int, int], painter) -> Image.Image:
    scale = 4; image = Image.new("RGBA", (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    painter(ImageDraw.Draw(image), scale)
    return image.resize(size, Image.Resampling.LANCZOS)


def hex_pts(s: int) -> list[tuple[int, int]]:
    return [(48*s, 4*s), (144*s, 4*s), (188*s, 84*s), (144*s, 164*s), (48*s, 164*s), (4*s, 84*s)]


def build_overlays() -> list[dict]:
    styles = {
        "neutral": ((40, 88, 110, 20), (103, 155, 176, 180)), "move": ((33, 205, 174, 80), (80, 246, 215, 255)),
        "attack": ((193, 57, 45, 75), (255, 102, 78, 255)), "danger": ((225, 133, 34, 72), (255, 187, 67, 255)),
        "selected": ((221, 177, 70, 66), (255, 224, 128, 255)), "done": ((70, 78, 82, 92), (144, 152, 154, 220)),
    }
    result = []
    for item_id, (fill, stroke) in styles.items():
        def paint(d, s, fill=fill, stroke=stroke):
            pts = hex_pts(s); d.polygon(pts, fill=fill); d.line(pts + [pts[0]], fill=stroke, width=4*s, joint="curve")
        image = aa_image((192, 168), paint); path = OUT / "ui/overlays" / f"hex_{item_id}.png"
        image.save(path, optimize=True); result.append({"id": item_id, "size": [192, 168], "path": path.relative_to(PACK).as_posix()})
    return result


def build_markers() -> list[dict]:
    result = []
    for item_id, color in {"flagship_player": (35, 196, 174), "flagship_enemy": (205, 72, 54)}.items():
        def paint(d, s, color=color):
            d.rounded_rectangle((8*s, 8*s, 88*s, 88*s), radius=18*s, fill=(40,27,14,220), outline=(226,190,100,255), width=3*s)
            d.line((34*s, 72*s, 34*s, 22*s), fill=(241,222,170,255), width=4*s)
            d.polygon([(35*s,24*s),(74*s,34*s),(35*s,50*s)], fill=(*color,255), outline=(255,241,198,255))
            d.ellipse((42*s,57*s,58*s,73*s), fill=(238,194,72,255)); d.line((50*s,51*s,50*s,80*s), fill=(238,194,72,255), width=4*s)
        image = aa_image((96,96), paint); path = OUT / "ui/markers" / f"{item_id}.png"
        image.save(path, optimize=True); result.append({"id": item_id, "size":[96,96], "path":path.relative_to(PACK).as_posix()})
    specs = {"route_dot":"dot", "cannon_target":"target", "boarding_target":"hooks", "retreat_edge":"arrow"}
    for item_id, kind in specs.items():
        def paint(d, s, kind=kind):
            if kind == "dot": d.ellipse((28*s,28*s,68*s,68*s), fill=(47,217,192,255), outline="white", width=4*s)
            elif kind == "target":
                d.ellipse((16*s,16*s,80*s,80*s), outline=(226,78,57,255), width=6*s); d.ellipse((35*s,35*s,61*s,61*s), outline=(226,78,57,255), width=4*s)
                d.line((48*s,4*s,48*s,30*s), fill=(226,78,57,255), width=5*s); d.line((48*s,66*s,48*s,92*s), fill=(226,78,57,255), width=5*s)
            elif kind == "hooks":
                d.arc((12*s,8*s,56*s,54*s),180,355,fill=(235,187,72,255),width=7*s); d.arc((40*s,8*s,84*s,54*s),185,360,fill=(235,187,72,255),width=7*s)
                d.line((30*s,42*s,69*s,84*s),fill=(92,58,29,255),width=8*s); d.line((66*s,42*s,27*s,84*s),fill=(92,58,29,255),width=8*s)
            else: d.polygon([(10*s,34*s),(62*s,34*s),(62*s,17*s),(90*s,48*s),(62*s,79*s),(62*s,62*s),(10*s,62*s)], fill=(241,222,170,255), outline=(87,55,27,255))
        image = aa_image((96,96), paint); path = OUT / "ui/markers" / f"{item_id}.png"
        image.save(path, optimize=True); result.append({"id":item_id,"size":[96,96],"path":path.relative_to(PACK).as_posix()})
    def hull(d, s):
        d.rounded_rectangle((2*s,2*s,158*s,22*s),radius=6*s,fill=(38,24,13,230),outline=(229,194,102,255),width=2*s)
        d.rounded_rectangle((7*s,7*s,153*s,17*s),radius=3*s,fill=(20,13,8,190))
    image=aa_image((160,24),hull); path=OUT/"ui/markers/hull_bar_frame.png"; image.save(path,optimize=True)
    result.append({"id":"hull_bar_frame","size":[160,24],"path":path.relative_to(PACK).as_posix()})
    return result


def get_font(size: int):
    for path in [Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/msjh.ttc")]:
        if path.exists(): return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def text(d, xy, value, size=20): d.text(xy, value, font=get_font(size), fill=(255,244,214,255))
def thumb(path: Path, size: tuple[int,int]) -> Image.Image: return ImageOps.contain(Image.open(path).convert("RGBA"), size, Image.Resampling.LANCZOS)


def build_reviews() -> list[str]:
    review=[]
    sheet=Image.new("RGBA",(1120,1424),(27,55,71,255)); d=ImageDraw.Draw(sheet); text(d,(16,14),"BATTLE HEX SHIPS - 8 TYPES x 6 DIRECTIONS",30)
    for c,x in enumerate(DIRECTIONS): text(d,(150+c*160,42),x.upper(),13)
    for r,ship_id in enumerate(SHIPS):
        y=64+r*170; d.rectangle((0,y,1120,y+169),fill=(31,68,88,255) if r%2==0 else (38,77,96,255)); text(d,(12,y+72),ship_id,16)
        for c,direction in enumerate(DIRECTIONS): sheet.alpha_composite(thumb(OUT/f"ships/frames/{ship_id}_{direction}.png",(150,150)),(150+c*160,y+10))
    path=PACK/"review/battle-hex-ships-contact-sheet.png"; sheet.convert("RGB").save(path,quality=92); review.append(path.relative_to(PACK).as_posix())

    env=Image.new("RGBA",(1560,1110),(30,62,79,255)); d=ImageDraw.Draw(env); text(d,(20,14),"BATTLE HEX ENVIRONMENT",32)
    for i,item_id in enumerate(["deep","shallow","reef"]): env.alpha_composite(thumb(OUT/f"terrain/{item_id}.png",(480,360)),(20+i*510,70)); text(d,(20+i*510,440),item_id.upper(),22)
    for i,item_id in enumerate(ISLANDS): env.alpha_composite(thumb(OUT/f"islands/{item_id}.png",(230,230)),(20+i*255,520)); text(d,(20+i*255,760),item_id,14)
    for i,item_id in enumerate(["neutral","move","attack","danger","selected","done"]): env.alpha_composite(thumb(OUT/f"ui/overlays/hex_{item_id}.png",(180,160)),(35+i*250,850)); text(d,(35+i*250,1015),item_id,15)
    path=PACK/"review/battle-hex-environment-contact-sheet.png"; env.convert("RGB").save(path,quality=92); review.append(path.relative_to(PACK).as_posix())

    fx=Image.new("RGBA",(1280,1130),(45,37,24,255)); d=ImageDraw.Draw(fx); text(d,(20,14),"BATTLE HEX EFFECTS & COMMANDS",32)
    for i,item_id in enumerate(EFFECTS): fx.alpha_composite(thumb(OUT/f"effects/{item_id}.png",(190,190)),(20+i*210,70)); text(d,(20+i*210,265),item_id,14)
    for i,item_id in enumerate(COMMANDS):
        x=20+(i%4)*310; y=330+(i//4)*300; fx.alpha_composite(thumb(OUT/f"ui/commands/{item_id}.png",(220,220)),(x,y)); text(d,(x,y+230),item_id,18)
    for i,item_id in enumerate(["flagship_player","flagship_enemy","route_dot","cannon_target","boarding_target","retreat_edge"]): fx.alpha_composite(thumb(OUT/f"ui/markers/{item_id}.png",(110,110)),(30+i*205,930)); text(d,(30+i*205,1045),item_id,13)
    path=PACK/"review/battle-hex-effects-ui-contact-sheet.png"; fx.convert("RGB").save(path,quality=92); review.append(path.relative_to(PACK).as_posix())
    return review


def validate(data: dict) -> None:
    expected={"ships":8,"terrain":3,"islands":6,"effects":6,"commands":8,"overlays":6,"markers":7}
    for key,count in expected.items():
        if len(data[key]) != count: raise ValueError(f"{key}: expected {count}, got {len(data[key])}")
    if len(list((OUT/"ships/frames").glob("*.png"))) != 48: raise ValueError("ship frames != 48")
    for path in list((OUT/"ships/frames").glob("*.png"))+list((OUT/"islands").glob("*.png"))+list((OUT/"effects").glob("*.png")):
        with Image.open(path) as img:
            if img.mode != "RGBA" or img.getchannel("A").getextrema()[0] != 0: raise ValueError(f"alpha invalid: {path}")


def main() -> None:
    mkdirs()
    data={"version":1,"status":"review","style":"V2 refined hand-painted 2D historical sailing RPG",
          "generator":"OpenAI built-in image generation plus local Pillow post-processing",
          "sources":{"ships":[f"source/ships/{ship_id}_six-directions-source.png" for ship_id in SHIPS],
                     "terrain":"source/environment/ocean-terrain-source.png",
                     "islands":"source/environment/islands-source.png",
                     "effects":"source/effects/battle-effects-source.png",
                     "commands":"source/ui/command-icons-source.png"},
          "processed":[path.relative_to(PACK).as_posix() for path in sorted(PROCESSED.glob("*.png"))],
          "ships":build_ships(),"terrain":build_terrain(),
          "islands":alpha_grid(PROCESSED/"islands-alpha.png",ISLANDS,"islands",512,448),
          "effects":alpha_grid(PROCESSED/"battle-effects-alpha.png",EFFECTS,"effects",384,328),
          "commands":build_commands(),"overlays":build_overlays(),"markers":build_markers()}
    data["review"]=build_reviews(); validate(data)
    (PACK/"battle-hex-assets.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Built: 8 ships/48 frames, 3 terrain, 6 islands, 6 effects, 8 commands, 6 overlays, 7 markers")


if __name__ == "__main__": main()
