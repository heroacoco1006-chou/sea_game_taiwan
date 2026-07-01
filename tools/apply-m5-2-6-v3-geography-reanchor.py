from __future__ import annotations

"""Apply the reviewed V3 geography candidate to runtime JSON data.

The script refuses to run unless the dated pre-change backup exists.
"""

import base64
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / "backups" / "2026-07-01_v3-before-geography-reanchor"
CANDIDATE = ROOT / "assets" / "m5" / "v3-geography-preview" / "v3_geography_reanchor_candidate.json"
MASK = ROOT / "assets" / "m5" / "v3-geography-preview" / "v3_geography_collision_mask.png"
PORTS = ROOT / "src" / "data" / "ports.json"
EXPLORATION = ROOT / "src" / "data" / "exploration_points.json"
DISCOVERIES = ROOT / "src" / "data" / "discoveries.json"
COLLISION = ROOT / "src" / "data" / "map_collision_v3.json"
REANCHOR = ROOT / "src" / "data" / "map_reanchor_v3.json"

REQUIRED_BACKUPS = (
    "src/data/ports.json",
    "src/data/exploration_points.json",
    "src/data/discoveries.json",
    "src/data/map_collision_v3.json",
    "src/state.ts",
    "src/scenes/WorldMapScene.ts",
    "SHA256SUMS.txt",
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def require_backup() -> None:
    missing = [relative for relative in REQUIRED_BACKUPS if not (BACKUP / relative).is_file()]
    if missing:
        raise RuntimeError(f"Pre-change backup is incomplete: {', '.join(missing)}")


def apply_ports(candidate: dict) -> tuple[dict, list[dict]]:
    data = read_json(PORTS)
    proposals = candidate["ports"]
    old_to_new: list[dict] = []
    seen: set[str] = set()
    for port in data["ports"]:
        proposal = proposals.get(port["id"])
        if proposal is None:
            raise RuntimeError(f'Missing candidate port: {port["id"]}')
        old_to_new.append(
            {
                "id": port["id"],
                "name": port["name"],
                "oldX": port["x"],
                "oldY": port["y"],
                "newX": proposal["x"],
                "newY": proposal["y"],
            }
        )
        port["x"] = proposal["x"]
        port["y"] = proposal["y"]
        seen.add(port["id"])
    if seen != set(proposals):
        raise RuntimeError("Candidate contains unknown or duplicate port ids")
    return data, old_to_new


def apply_exploration(candidate: dict) -> dict:
    data = read_json(EXPLORATION)
    proposals = candidate["exploration"]
    seen: set[str] = set()
    for point in data["points"]:
        proposal = proposals.get(point["id"])
        if proposal is None:
            raise RuntimeError(f'Missing candidate exploration point: {point["id"]}')
        point["x"] = proposal["displayX"]
        point["y"] = proposal["displayY"]
        point["approachX"] = proposal["approachX"]
        point["approachY"] = proposal["approachY"]
        seen.add(point["id"])
    if seen != set(proposals):
        raise RuntimeError("Candidate contains unknown exploration ids")
    return data


def apply_scenery(candidate: dict) -> dict:
    data = read_json(DISCOVERIES)
    proposals = candidate["scenery"]
    seen: set[str] = set()
    for entry in data["discoveries"]:
        proposal = proposals.get(entry["id"])
        if proposal is None:
            continue
        entry["x"] = proposal["displayX"]
        entry["y"] = proposal["displayY"]
        entry["approachX"] = proposal["approachX"]
        entry["approachY"] = proposal["approachY"]
        seen.add(entry["id"])
    if seen != set(proposals):
        raise RuntimeError("Candidate contains unknown scenery ids")
    return data


def collision_json(candidate: dict) -> dict:
    mask = np.asarray(Image.open(MASK).convert("L"), dtype=np.uint8) >= 128
    if mask.shape != (720, 960):
        raise RuntimeError(f"Unexpected collision mask shape: {mask.shape}")
    packed = np.packbits(mask.reshape(-1), bitorder="little")
    return {
        "worldWidth": candidate["worldWidth"],
        "worldHeight": candidate["worldHeight"],
        "gridWidth": 960,
        "gridHeight": 720,
        "bitOrder": "little",
        "landBitsBase64": base64.b64encode(packed.tobytes()).decode("ascii"),
    }


def main() -> None:
    require_backup()
    candidate = read_json(CANDIDATE)
    if candidate.get("status") != "review-only" or not all(candidate.get("channels", {}).values()):
        raise RuntimeError("Candidate is missing review status or channel validation")
    if len(candidate["ports"]) != 22 or len(candidate["exploration"]) != 12 or len(candidate["scenery"]) != 15:
        raise RuntimeError("Candidate point counts do not match the approved scope")

    ports, port_migration = apply_ports(candidate)
    write_json(PORTS, ports)
    write_json(EXPLORATION, apply_exploration(candidate))
    write_json(DISCOVERIES, apply_scenery(candidate))
    write_json(COLLISION, collision_json(candidate))
    write_json(
        REANCHOR,
        {
            "saveVersion": 17,
            "backup": "backups/2026-07-01_v3-before-geography-reanchor",
            "channels": candidate["channels"],
            "ports": port_migration,
        },
    )
    print("applied=ports,exploration,scenery,collision,reanchor")
    print("backup_verified=yes")


if __name__ == "__main__":
    main()
