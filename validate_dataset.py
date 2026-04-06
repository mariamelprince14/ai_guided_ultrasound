"""
validate_dataset.py
====================
Pre-flight checker for the 40-case CT dataset.
Run this BEFORE training to surface any missing or corrupt files.

Prints a colour-coded table and saves a CSV report to the dataset root.

Usage (Slicer Python Interactor):
    exec(open(r"E:/downloads/usdemo/validate_dataset.py").read())

Usage (standalone Python, no Slicer needed):
    python validate_dataset.py C:/data/dataset
"""

import os
import sys
import glob
import csv
import datetime


# ─────────────────────────────────────────────────────────────────────────────
# ANSI colors (work in Slicer console & real terminals)
# ─────────────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

OK   = f"{GREEN}✔ OK{RESET}"
WARN = f"{YELLOW}⚠ MISSING{RESET}"
ERR  = f"{RED}✘ ERROR{RESET}"


# ─────────────────────────────────────────────────────────────────────────────
# FILE PATTERNS  (must match CaseManager in USTrainingModule.py)
# ─────────────────────────────────────────────────────────────────────────────

VOLUME_PATTERNS     = ["volume.nii.gz", "*.nii.gz"]
SEG_PATTERNS        = ["segmentation.seg.nrrd", "*.seg.nrrd"]
LABELMAP_PATTERNS   = ["segmentation-label.nii.gz", "*-label.nii.gz"]
COLORTABLE_PATTERNS = ["segmentation_ColorTable.csv", "*_ColorTable.csv"]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _first_match(directory: str, patterns: list):
    for p in patterns:
        matches = glob.glob(os.path.join(directory, p))
        if matches:
            return matches[0]
    return None


def _file_size_mb(path):
    try:
        return os.path.getsize(path) / (1024 * 1024)
    except Exception:
        return 0.0


def _check_nifti_readable(path: str) -> tuple:
    """
    Try to import nibabel and read header only (fast).
    Returns (ok: bool, message: str).
    Does NOT require Slicer.
    """
    try:
        import nibabel as nib
        img = nib.load(path)
        shape = img.shape
        return True, f"shape={shape}"
    except ImportError:
        # nibabel not available — skip deep check
        return True, "nibabel absent, skipped header check"
    except Exception as e:
        return False, str(e)


def _check_nrrd_readable(path: str) -> tuple:
    try:
        import nrrd
        header = nrrd.read_header(open(path, "rb"))
        return True, f"type={header.get('type','?')}"
    except ImportError:
        return True, "pynrrd absent, skipped"
    except Exception as e:
        return False, str(e)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN VALIDATOR
# ─────────────────────────────────────────────────────────────────────────────

def validate_dataset(dataset_root: str, deep_check: bool = False) -> list:
    """
    Scan dataset_root and validate every sub-folder.

    Args:
        dataset_root : path to parent folder containing Case_001 … Case_040
        deep_check   : if True, open each file and check its header (slow)

    Returns:
        list of result dicts (one per case)
    """
    if not os.path.isdir(dataset_root):
        print(f"{RED}ERROR: Dataset root not found: {dataset_root}{RESET}")
        return []

    sub_dirs = sorted(
        d for d in os.listdir(dataset_root)
        if os.path.isdir(os.path.join(dataset_root, d))
    )

    results = []
    errors_total   = 0
    warnings_total = 0

    # ── Header ──────────────────────────────────────────────────────────────
    print()
    print(f"{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}  DATASET VALIDATION REPORT — {dataset_root}{RESET}")
    print(f"  Run at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Sub-folders found: {len(sub_dirs)}")
    print(f"{'='*80}{RESET}")
    print()

    col_w = [20, 10, 12, 12, 14, 20]
    header_row = ["Case", "CT (req)", "Seg (opt)", "LM (opt)", "ColTab (opt)", "Notes"]
    _print_row(header_row, col_w, bold=True)
    _print_separator(col_w)

    for case_name in sub_dirs:
        case_dir  = os.path.join(dataset_root, case_name)
        row_data  = _validate_one_case(case_dir, case_name, deep_check)
        results.append(row_data)

        status_cols = [
            case_name,
            OK   if row_data["volume_ok"]     else ERR,
            OK   if row_data["seg_ok"]         else (WARN if not row_data["seg_path"]      else ERR),
            OK   if row_data["labelmap_ok"]    else (WARN if not row_data["labelmap_path"]  else ERR),
            OK   if row_data["colortable_ok"]  else (WARN if not row_data["ct_path"]        else ERR),
            row_data["notes"],
        ]
        _print_row(status_cols, col_w)

        if not row_data["volume_ok"]:
            errors_total += 1
        if not row_data["seg_ok"] and row_data["seg_path"]:
            errors_total += 1
        if not row_data["seg_path"]:
            warnings_total += 1

    # ── Summary ─────────────────────────────────────────────────────────────
    _print_separator(col_w)
    print()
    total  = len(results)
    ready  = sum(1 for r in results if r["volume_ok"])
    print(f"  Cases with CT volume      : {GREEN}{ready}/{total}{RESET}")
    print(f"  Cases with segmentation   : {sum(1 for r in results if r['seg_ok'])}/{total}")
    print(f"  Cases with labelmap       : {sum(1 for r in results if r['labelmap_ok'])}/{total}")
    print(f"  Cases with color table    : {sum(1 for r in results if r['colortable_ok'])}/{total}")
    print()

    if errors_total == 0 and warnings_total == 0:
        print(f"  {GREEN}{BOLD}ALL CASES READY — no errors, no missing optional files.{RESET}")
    elif errors_total == 0:
        print(f"  {YELLOW}Ready with {warnings_total} warning(s) — optional files missing (OK).{RESET}")
    else:
        print(f"  {RED}ERRORS: {errors_total} case(s) have problems that will prevent loading!{RESET}")

    # ── Save CSV report ─────────────────────────────────────────────────────
    csv_path = os.path.join(dataset_root, "validation_report.csv")
    _save_csv(results, csv_path)
    print(f"\n  Report saved → {csv_path}")
    print(f"{'='*80}\n")

    return results


def _validate_one_case(case_dir: str, case_name: str, deep_check: bool) -> dict:
    """Return a dict with validation results for one case folder."""
    vol_path  = _first_match(case_dir, VOLUME_PATTERNS)
    seg_path  = _first_match(case_dir, SEG_PATTERNS)
    lm_path   = _first_match(case_dir, LABELMAP_PATTERNS)
    ct_path   = _first_match(case_dir, COLORTABLE_PATTERNS)   # color table

    notes = []

    # CT volume
    vol_ok = vol_path is not None and os.path.isfile(vol_path)
    if vol_ok and deep_check:
        ok, msg = _check_nifti_readable(vol_path)
        if not ok:
            vol_ok = False
            notes.append(f"CT corrupt: {msg}")
        else:
            notes.append(msg)

    if not vol_ok:
        notes.append("CT MISSING — case will be skipped!")

    # Segmentation
    seg_ok = seg_path is not None and os.path.isfile(seg_path)
    if seg_ok and deep_check:
        ok, msg = _check_nrrd_readable(seg_path)
        if not ok:
            seg_ok = False
            notes.append(f"Seg corrupt: {msg}")

    if not seg_path:
        notes.append("No seg (optional)")

    # Label map
    lm_ok = lm_path is not None and os.path.isfile(lm_path)
    if not lm_path:
        notes.append("No labelmap (optional)")

    # Color table
    colortable_ok = ct_path is not None and os.path.isfile(ct_path)
    if not ct_path:
        notes.append("No colortable (optional)")

    # File size sanity check for CT
    if vol_ok and vol_path:
        size_mb = _file_size_mb(vol_path)
        if size_mb < 1.0:
            notes.append(f"CT very small ({size_mb:.1f} MB) — check file")

    return {
        "case_name":     case_name,
        "volume_path":   vol_path,
        "volume_ok":     vol_ok,
        "seg_path":      seg_path,
        "seg_ok":        seg_ok,
        "labelmap_path": lm_path,
        "labelmap_ok":   lm_ok,
        "ct_path":       ct_path,
        "colortable_ok": colortable_ok,
        "notes":         "; ".join(notes) if notes else "—",
    }


def _print_row(cols, widths, bold=False):
    """Print a fixed-width table row, stripping ANSI from width calc."""
    import re
    ansi_escape = re.compile(r'\x1b\[[0-9;]*m')
    parts = []
    for col, w in zip(cols, widths):
        visible = ansi_escape.sub("", col)
        padding = w - len(visible)
        parts.append(col + " " * max(0, padding))
    line = "  " + "  ".join(parts)
    if bold:
        print(f"{BOLD}{line}{RESET}")
    else:
        print(line)


def _print_separator(widths):
    total = sum(widths) + 2 * (len(widths) - 1) + 2
    print("  " + "─" * (total))


def _save_csv(results: list, path: str):
    fields = [
        "case_name", "volume_ok", "volume_path",
        "seg_ok", "seg_path",
        "labelmap_ok", "labelmap_path",
        "colortable_ok", "ct_path",
        "notes"
    ]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINTS
# ─────────────────────────────────────────────────────────────────────────────

def run_in_slicer(dataset_root: str, deep_check: bool = False):
    """Call from the Slicer Python Interactor."""
    return validate_dataset(dataset_root, deep_check)


if __name__ == "__main__":
    # Standalone Python usage:  python validate_dataset.py /path/to/dataset
    if len(sys.argv) < 2:
        print("Usage: python validate_dataset.py <dataset_root> [--deep]")
        sys.exit(1)
    root = sys.argv[1]
    deep = "--deep" in sys.argv
    validate_dataset(root, deep_check=deep)
else:
    # When exec()'d in Slicer, do nothing automatically —
    # user calls run_in_slicer() or validate_dataset() manually.
    pass
