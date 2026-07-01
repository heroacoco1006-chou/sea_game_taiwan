#!/usr/bin/env python3
"""Validate the formally integrated V3 geography and its rollback backup."""

from __future__ import annotations

import base64
import hashlib
import json
from collections import deque
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
BACKUP = ROOT / "backups" / "2026-07-01_v3-before-geography-reanchor"
SOURCE_W, SOURCE_H = 1448, 1086

CHANNEL_TESTS = {
    "台灣海峽南北航道": ((650, 285), (650, 555), (500, 250, 710, 575)),
    "台灣東側南北航道": ((805, 280), (805, 620), (760, 240, 920, 650)),
    "婆羅洲－爪哇東西航道": ((360, 970), (900, 970), (320, 900, 930, 1045)),
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def validate_backup() -> None:
    hashes = BACKUP / "SHA256SUMS.txt"
    if not hashes.exists():
        raise RuntimeError(f"Missing backup manifest: {hashes}")
    for line in hashes.read_text(encoding="utf-8-sig").splitlines():
        expected, relative = line.split(maxsplit=1)
        backup_file = BACKUP / relative.replace("\\", "/")
        actual = hashlib.sha256(backup_file.read_bytes()).hexdigest()
        if actual.lower() != expected.lower():
            raise RuntimeError(f"Backup hash mismatch: {backup_file}")


def decode_collision() -> tuple[dict, list[list[bool]]]:
    collision = load_json(DATA / "map_collision_v3.json")
    width = collision["gridWidth"]
    height = collision["gridHeight"]
    bits = base64.b64decode(collision["landBitsBase64"])
    if len(bits) * 8 < width * height:
        raise RuntimeError("Collision bitset is shorter than its declared grid")
    land = [
        [bool(bits[(y * width + x) >> 3] & (1 << ((y * width + x) & 7))) for x in range(width)]
        for y in range(height)
    ]
    return collision, land


def world_to_grid(collision: dict, x: int, y: int) -> tuple[int, int]:
    gx = min(collision["gridWidth"] - 1, max(0, int(x * collision["gridWidth"] / collision["worldWidth"])))
    gy = min(collision["gridHeight"] - 1, max(0, int(y * collision["gridHeight"] / collision["worldHeight"])))
    return gx, gy


def validate_water_points(collision: dict, land: list[list[bool]]) -> None:
    discoveries = load_json(DATA / "discoveries.json")["discoveries"]
    scenery = [record for record in discoveries if record.get("kind") == "scenery" and "x" in record and "y" in record]
    groups = (
        ("ports", load_json(DATA / "ports.json")["ports"]),
        ("exploration", load_json(DATA / "exploration_points.json")["points"]),
        ("scenery", scenery),
    )
    expected = {"ports": 22, "exploration": 12, "scenery": 15}
    for name, records in groups:
        if len(records) != expected[name]:
            raise RuntimeError(f"Unexpected {name} count: {len(records)}")
        for record in records:
            x = record.get("approachX", record["x"])
            y = record.get("approachY", record["y"])
            gx, gy = world_to_grid(collision, x, y)
            if land[gy][gx]:
                raise RuntimeError(f"{name} approach is on land: {record['id']} ({x}, {y})")


def validate_channels(land: list[list[bool]]) -> dict[str, bool]:
    height, width = len(land), len(land[0])

    def to_grid(point: tuple[int, int]) -> tuple[int, int]:
        return round(point[0] / SOURCE_W * width), round(point[1] / SOURCE_H * height)

    def nearest_water(point: tuple[int, int], box: tuple[int, int, int, int]) -> tuple[int, int]:
        px, py = point
        x0, y0, x1, y1 = box
        for radius in range(25):
            options = []
            for y in range(max(y0, py - radius), min(y1, py + radius) + 1):
                for x in range(max(x0, px - radius), min(x1, px + radius) + 1):
                    if not land[y][x]:
                        options.append(((x - px) ** 2 + (y - py) ** 2, x, y))
            if options:
                _, x, y = min(options)
                return x, y
        raise RuntimeError("No water endpoint found for channel")

    results = {}
    for name, (source_start, source_end, source_box) in CHANNEL_TESTS.items():
        x0, y0 = to_grid(source_box[:2])
        x1, y1 = to_grid(source_box[2:])
        box = (x0, y0, x1, y1)
        start = nearest_water(to_grid(source_start), box)
        end = nearest_water(to_grid(source_end), box)
        queue = deque([start])
        visited = {start}
        while queue:
            x, y = queue.popleft()
            if (x, y) == end:
                results[name] = True
                break
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if x0 <= nx <= x1 and y0 <= ny <= y1 and not land[ny][nx] and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    queue.append((nx, ny))
        else:
            results[name] = False
    if not all(results.values()):
        raise RuntimeError("Blocked channel: " + "、".join(name for name, ok in results.items() if not ok))
    return results


def validate_reanchor() -> None:
    reanchor = load_json(DATA / "map_reanchor_v3.json")
    ports = load_json(DATA / "ports.json")["ports"]
    current = {port["id"]: (port["x"], port["y"]) for port in ports}
    if reanchor["saveVersion"] != 17 or len(reanchor["ports"]) != 22:
        raise RuntimeError("Unexpected reanchor metadata")
    for port in reanchor["ports"]:
        if current.get(port["id"]) != (port["newX"], port["newY"]):
            raise RuntimeError(f"Reanchor mismatch: {port['id']}")


def main() -> None:
    validate_backup()
    collision, land = decode_collision()
    validate_water_points(collision, land)
    validate_reanchor()
    channels = validate_channels(land)
    print("backup_hashes=ok")
    print("formal_counts=ports:22,exploration:12,scenery:15")
    print("approach_points=all_water")
    for name, ok in channels.items():
        print(f"channel:{name}={'open' if ok else 'blocked'}")


if __name__ == "__main__":
    main()
