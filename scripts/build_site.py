#!/usr/bin/env python3
"""Build the static site: copy the dashboard app into _site/.

Usage: python scripts/build_site.py
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "app"
OUT_DIR = ROOT / "_site"


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    shutil.copytree(APP_DIR, OUT_DIR)
    print(f"built {OUT_DIR}")


if __name__ == "__main__":
    main()
