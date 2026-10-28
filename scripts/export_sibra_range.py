#!/usr/bin/env python3
"""Generate a bounded range of SIBRA day files from a local GTFS ZIP.

Usage:
  python3 scripts/export_sibra_range.py gtfs-sibra.zip 2026-10-28 2026-11-03
No network, no automatic commit, no invented real-time status.
"""
import datetime as dt
from pathlib import Path
import sys
from export_sibra_day import export


def generate(archive, first, last, destination):
    if last < first or (last - first).days > 31:
        raise ValueError("Date range must be between 1 and 32 days")
    if not archive.is_file():
        raise FileNotFoundError(f"Missing GTFS archive: {archive}")
    written = []
    skipped = []
    for offset in range((last - first).days + 1):
        day = first + dt.timedelta(days=offset)
        target = destination / f"sibra-{day.isoformat()}.json"
        try:
            export(archive, day, target)
            written.append(str(target))
        except ValueError as exc:
            skipped.append((day.isoformat(), str(exc)))
            if target.exists():
                target.unlink()
    print(f"Generated {len(written)} days; skipped {len(skipped)} days without valid service")
    for day, reason in skipped:
        print(f"SKIPPED {day}: {reason}")
    if not written:
        raise ValueError("No usable GTFS day files generated")
    return written


if __name__ == "__main__":
    if len(sys.argv) not in (4, 5):
        sys.exit("Usage: export_sibra_range.py gtfs.zip YYYY-MM-DD YYYY-MM-DD [output-dir]")
    generate(Path(sys.argv[1]), dt.date.fromisoformat(sys.argv[2]),
             dt.date.fromisoformat(sys.argv[3]),
             Path(sys.argv[4]) if len(sys.argv) == 5 else Path("data/sibra"))
