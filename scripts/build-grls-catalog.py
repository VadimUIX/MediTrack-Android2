#!/usr/bin/env python3
"""Build the compact offline GRLS search catalog from the official XLSX export."""
from collections import OrderedDict
from datetime import date, datetime
import json
import os
import re
import sys
import zipfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "grls2026-11-05-1.zip"
OUTPUT = ROOT / "public" / "grls-catalog.json"
SHEETS = OrderedDict([
    ("Действует", "grls2026-11-05-1-Действующий.xlsx"),
    ("Выдано по правилам ЕАЭС", "grls2026-11-05-1-Выдано_по_правилам_ЕАЭС.xlsx"),
    ("Действует в иностранных упаковках", "grls2026-11-05-1-Действует_в_иностранных_упаковках.xlsx"),
    ("На подтверждении государственной регистрации", "grls2026-11-05-1-Действует_на_подтверждении_государственной_регистрации.xlsx"),
    ("Приостановлено применение", "grls2026-11-05-1-Приостановлено_применение.xlsx"),
])

def clean(value):
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%d.%m.%Y")
    text = str(value).replace("\x00", " ").replace("_x000D_", " ").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return "" if text in {"~", "-"} else text

if not ARCHIVE.exists():
    raise SystemExit(f"GRLS archive not found: {ARCHIVE}")

records = {}
with zipfile.ZipFile(ARCHIVE) as archive:
    names = set(archive.namelist())
    for status, filename in SHEETS.items():
        if filename not in names:
            raise SystemExit(f"Missing expected sheet: {filename}")
        with archive.open(filename) as source:
            workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
            sheet = workbook.active
            for row in sheet.iter_rows(min_row=7, values_only=True):
                if not row or not any(value is not None for value in row):
                    continue
                values = [clean(row[index]) if len(row) > index else "" for index in range(2, 17)]
                reg, _reg_date, expiry, _cancel, _holder, _country, trade, inn, forms, *_rest = values
                if not (trade or inn):
                    continue
                key = (reg, trade.casefold(), inn.casefold(), status)
                record = records.get(key)
                if record is None:
                    records[key] = {
                        "r": reg, "n": trade, "i": inn, "f": forms[:320],
                        "s": status, "e": expiry,
                    }
                elif forms and forms not in record["f"]:
                    record["f"] = (record["f"] + "; " + forms).strip("; ")[:320]
            workbook.close()

items = sorted(records.values(), key=lambda item: (item["n"].casefold(), item["i"].casefold(), item["s"], item["r"]))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8") as target:
    json.dump({
        "source": "Государственный реестр лекарственных средств",
        "asOf": "2026-11-05",
        "recordCount": len(items),
        "items": items,
    }, target, ensure_ascii=False, separators=(",", ":"))
print(f"GRLS catalog: {len(items):,} records, {OUTPUT.stat().st_size:,} bytes")
