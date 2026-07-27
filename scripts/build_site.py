#!/usr/bin/env python3
"""Render docs/design.md into a static site under _site/.

Usage: python scripts/build_site.py
Requires: pip install markdown
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "design.md"
TEMPLATE = ROOT / "web" / "template.html"
STYLES = ROOT / "web" / "styles.css"
OUT_DIR = ROOT / "_site"


def split_front_matter(text: str) -> tuple[str, str]:
    """Drop the H1 title and the Status/Scope/Author metadata block, which the
    page hero replaces. Returns (last_updated, body)."""
    updated = "2026"
    m = re.search(r"^\*\*Last updated:\*\*\s*(.+)$", text, flags=re.M)
    if m:
        updated = m.group(1).strip()
    lines = text.splitlines()
    body_start = 0
    for i, line in enumerate(lines):
        if line.startswith("## "):
            body_start = i
            break
    return updated, "\n".join(lines[body_start:])


def wrap_tables(html: str) -> str:
    html = html.replace("<table>", '<div class="table-wrap"><table>')
    return html.replace("</table>", "</table></div>")


def link_headings(html: str) -> str:
    """Make h2/h3 heading text a self-link to its own anchor."""
    def repl(m: re.Match) -> str:
        tag, attrs, inner = m.group(1), m.group(2), m.group(3)
        idm = re.search(r'id="([^"]+)"', attrs)
        if not idm:
            return m.group(0)
        return (
            f'<{tag}{attrs}><a class="hlink" href="#{idm.group(1)}">'
            f"{inner}</a></{tag}>"
        )

    return re.sub(r"<(h[23])([^>]*)>(.*?)</\1>", repl, html, flags=re.S)


def build_toc(toc_tokens: list[dict]) -> str:
    items = []
    for tok in toc_tokens:
        if tok["level"] == 2:
            items.append(f'      <a href="#{tok["id"]}">{tok["name"]}</a>')
    return "\n".join(items)


def main() -> None:
    updated, body = split_front_matter(SOURCE.read_text(encoding="utf-8"))
    md = markdown.Markdown(
        extensions=["tables", "fenced_code", "toc", "sane_lists"],
        extension_configs={"toc": {"toc_depth": "2-3"}},
    )
    content = link_headings(wrap_tables(md.convert(body)))
    toc = build_toc(md.toc_tokens)

    page = (
        TEMPLATE.read_text(encoding="utf-8")
        .replace("$TOC$", toc)
        .replace("$CONTENT$", content)
        .replace("$UPDATED$", updated)
    )

    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "index.html").write_text(page, encoding="utf-8")
    shutil.copy(STYLES, OUT_DIR / "styles.css")
    print(f"built {OUT_DIR / 'index.html'} ({len(page):,} bytes)")


if __name__ == "__main__":
    main()
