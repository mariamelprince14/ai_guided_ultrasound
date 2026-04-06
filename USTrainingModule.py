"""
USTrainingModule.py
====================
AI-Guided Ultrasound Training System for 3D Slicer
Graduation Project — Full Scripted Module

Dataset location (auto-detected):
  E:\downloads\usdemo\ct.volumes\3d test\
    test3\   test4\   test7\   test9\   test11\ ... test40\

Each case folder contains:
  <Series Name>.nii.gz                      ← CT volume  (required)
  <Series Name> segmentation.seg.nrrd       ← segmentation (optional)
  <Series Name> segmentation-label.nii.gz   ← label map   (optional)
  <Series Name> segmentation_ColorTable.csv ← color table  (optional)

Probe Design (CORRECT approach):
  - CT volume stays FIXED in patient/world space (no transform applied to it)
  - Yellow slice plane is driven by VirtualProbePose transform
  - Moving the probe changes which cross-section of the fixed CT is shown
  - This correctly mimics real ultrasound: patient lies still, probe moves

Quick start (paste into Slicer Python Interactor):
  exec(open(r'E:/downloads/usdemo/setup_scene.py').read())
  import sys; sys.path.insert(0, r'E:/downloads/usdemo')
  import USTrainingModule; USTrainingModule.quick_launch()
"""

import os
import glob
import vtk
import numpy as np
import slicer
from slicer.ScriptedLoadableModule import (
    ScriptedLoadableModule,
    ScriptedLoadableModuleWidget,
    ScriptedLoadableModuleLogic,
)
import qt

# ─────────────────────────────────────────────────────────────────────────────
# MODULE REGISTRATION  (required by Slicer's module system)
# ─────────────────────────────────────────────────────────────────────────────

class USTrainingModule(ScriptedLoadableModule):
    """Module metadata shown in Slicer's Module finder."""
    def __init__(self, parent):
        super().__init__(parent)
        parent.title = "US Training"
        parent.categories = ["Training"]
        parent.dependencies = []
        parent.contributors = ["Graduation Project Team"]
        parent.helpText = (
            "AI-Guided Ultrasound Training: load one of 40 CT cases, "
            "drive the Yellow slice with VirtualProbePose, capture frames."
        )
        parent.acknowledgementText = "Graduation project — 3D Slicer + AI ultrasound guidance."


# ─────────────────────────────────────────────────────────────────────────────
# REAL DATASET PATHS  (auto-detected from your extracted zip)
# ─────────────────────────────────────────────────────────────────────────────

# Root of the extracted zip
_ZIP_EXTRACT_ROOT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),   # E:\downloads\usdemo
    "ct.volumes",
    "3d test"
)

# Default capture folder lives next to the module
_DEFAULT_CAPTURE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "captures"
)


# ─────────────────────────────────────────────────────────────────────────────
# CASE MANAGER
# ─────────────────────────────────────────────────────────────────────────────

class CaseManager:
    """
    Scans a dataset root folder and builds a registry of cases.

    Real layout (your extracted data):
        ct.volumes/3d test/
            test3/
                <Series> .nii.gz                     ← CT volume (required)
                <Series> segmentation.seg.nrrd        ← segmentation (opt)
                <Series> segmentation-label.nii.gz    ← labelmap (opt)
                <Series> segmentation_ColorTable.csv  ← color table (opt)
            test4/  test7/  ...  test40/

    The CaseManager also handles the situation where the root folder itself
    contains a single intermediate sub-folder (e.g. 'ct.volumes/' → '3d test/').
    In that case it automatically descends into that sub-folder.
    """

    # Patterns that match your REAL filenames:
    #   "7 Unnamed Series_1.nii.gz"                 ← CT volume
    #   "7 Unnamed Series_1 segmentation.seg.nrrd"  ← segmentation
    #   "7 Unnamed Series_1 segmentation-label.nii.gz"
    #   "7 Unnamed Series_1 segmentation_ColorTable.csv"
    #
    # IMPORTANT: exclude *-label.nii.gz from the volume match by checking
    # that the match does NOT end with '-label.nii.gz'.
    # We handle this in _first_volume() below.
    SEG_PATTERNS        = ["* segmentation.seg.nrrd", "*.seg.nrrd"]
    LABELMAP_PATTERNS   = ["* segmentation-label.nii.gz", "*-label.nii.gz"]
    COLORTABLE_PATTERNS = ["* segmentation_ColorTable.csv", "*_ColorTable.csv"]

    def __init__(self, dataset_root: str = None):
        # Default to the extracted zip location if no root given
        self.dataset_root = dataset_root or _ZIP_EXTRACT_ROOT
        self.cases = {}          # {case_name: file_dict}

    # ── public ──────────────────────────────────────────────────────────────

    def discover_cases(self) -> dict:
        """
        Walk dataset_root, find sub-folders that contain at least a CT volume.
        Auto-descends one level if root has only a single sub-folder
        (handles the 'ct.volumes/3d test/' intermediate folder pattern).
        Returns dict {case_name: file_dict}.
        """
        self.cases.clear()

        root = self._resolve_root(self.dataset_root)
        if root is None:
            return self.cases

        sub_dirs = sorted(
            d for d in os.listdir(root)
            if os.path.isdir(os.path.join(root, d))
        )

        if not sub_dirs:
            print(f"[CaseManager] No sub-folders found in: {root}")
            return self.cases

        for case_name in sub_dirs:
            case_dir  = os.path.join(root, case_name)
            file_dict = self._scan_case_dir(case_dir)

            if file_dict["volume"] is None:
                print(f"[CaseManager] SKIP {case_name}: no CT volume found")
                continue

            self.cases[case_name] = file_dict
            vol_name = os.path.basename(file_dict['volume'])
            has_seg  = '✔' if file_dict['seg']        else '—'
            has_lm   = '✔' if file_dict['labelmap']   else '—'
            has_ct   = '✔' if file_dict['colortable'] else '—'
            print(f"[CaseManager] {case_name:10s}  CT={vol_name}  "
                  f"seg={has_seg}  lm={has_lm}  color={has_ct}")

        print(f"\n[CaseManager] ── Total cases ready: {len(self.cases)} ──")
        return self.cases

    def case_names(self) -> list:
        return list(self.cases.keys())

    def get_case_files(self, case_name: str) -> dict:
        return self.cases.get(case_name, {})

    # ── private ─────────────────────────────────────────────────────────────

    def _resolve_root(self, path: str) -> str:
        """
        Given a root path, return the actual folder that contains the case
        sub-folders.  If path doesn't exist, try _ZIP_EXTRACT_ROOT.
        """
        if not os.path.isdir(path):
            print(f"[CaseManager] Path not found: {path}")
            # Fall back to the known extracted location
            if os.path.isdir(_ZIP_EXTRACT_ROOT):
                print(f"[CaseManager] Falling back to: {_ZIP_EXTRACT_ROOT}")
                return _ZIP_EXTRACT_ROOT
            try:
                slicer.util.errorDisplay(
                    f"Dataset root not found:\n{path}\n"
                    f"and fallback also missing:\n{_ZIP_EXTRACT_ROOT}"
                )
            except Exception:
                pass
            return None

        # If the folder contains only ONE sub-directory (intermediate wrapper),
        # descend into it automatically.
        entries = [d for d in os.listdir(path)
                   if os.path.isdir(os.path.join(path, d))]
        files   = [f for f in os.listdir(path)
                   if os.path.isfile(os.path.join(path, f))]
        if len(entries) == 1 and len(files) == 0:
            resolved = os.path.join(path, entries[0])
            print(f"[CaseManager] Single sub-folder detected — "
                  f"auto-descending into: {resolved}")
            return resolved

        return path

    def _first_match(self, directory: str, patterns: list):
        """Return the first file matching any pattern (in order), or None."""
        for pattern in patterns:
            matches = sorted(glob.glob(os.path.join(directory, pattern)))
            if matches:
                return matches[0]
        return None

    def _first_volume(self, directory: str):
        """
        Find the CT volume: any .nii.gz that is NOT a label map.
        Label maps end with '-label.nii.gz', so we skip those.
        """
        all_nii = sorted(glob.glob(os.path.join(directory, "*.nii.gz")))
        for f in all_nii:
            if not f.endswith("-label.nii.gz"):
                return f
        return None

    def _scan_case_dir(self, case_dir: str) -> dict:
        return {
            "volume":     self._first_volume(case_dir),
            "seg":        self._first_match(case_dir, self.SEG_PATTERNS),
            "labelmap":   self._first_match(case_dir, self.LABELMAP_PATTERNS),
            "colortable": self._first_match(case_dir, self.COLORTABLE_PATTERNS),
            "dir":        case_dir,
        }


# ─────────────────────────────────────────────────────────────────────────────
# CASE LOADER
# ─────────────────────────────────────────────────────────────────────────────

class CaseLoader:
    """
    Loads and unloads a single CT case (volume + segmentation + optional files).

    Design rule: CT volume is ALWAYS kept in world/patient space.
    No transform is ever applied to the CT node itself.
    """

    def __init__(self):
        self.active_case_name   = None
        self.ct_node            = None   # vtkMRMLScalarVolumeNode
        self.seg_node           = None   # vtkMRMLSegmentationNode
        self.labelmap_node      = None   # vtkMRMLLabelMapVolumeNode
        self._loaded_node_ids   = []     # all IDs we own (for clean unload)

    # ── public ──────────────────────────────────────────────────────────────

    def load_case(self, case_name: str, file_dict: dict) -> bool:
        """
        1. Unload any previously loaded case.
        2. Load CT volume (required).
        3. Load segmentation if available.
        4. Load labelmap if available.
        5. Apply color table if available.
        Returns True on success.
        """
        self.unload_case()   # clean slate

        # --- CT volume ---------------------------------------------------
        volume_path = file_dict.get("volume")
        if not volume_path or not os.path.isfile(volume_path):
            slicer.util.errorDisplay(f"CT volume file not found:\n{volume_path}")
            return False

        try:
            self.ct_node = slicer.util.loadVolume(volume_path)
            self.ct_node.SetName(f"{case_name}_CT")
            self._loaded_node_ids.append(self.ct_node.GetID())
            print(f"[CaseLoader] Loaded CT: {self.ct_node.GetName()}")
        except Exception as e:
            slicer.util.errorDisplay(f"Failed to load CT volume:\n{e}")
            return False

        # --- Segmentation ------------------------------------------------
        seg_path = file_dict.get("seg")
        if seg_path and os.path.isfile(seg_path):
            try:
                self.seg_node = slicer.util.loadSegmentation(seg_path)
                self.seg_node.SetName(f"{case_name}_Seg")
                self._loaded_node_ids.append(self.seg_node.GetID())
                print(f"[CaseLoader] Loaded segmentation: {self.seg_node.GetName()}")

                # Link segmentation to CT so it uses the same coordinate frame
                self.seg_node.SetReferenceImageGeometryParameterFromVolumeNode(
                    self.ct_node
                )
            except Exception as e:
                print(f"[CaseLoader] WARNING: Could not load segmentation: {e}")
                self.seg_node = None
        else:
            print(f"[CaseLoader] No segmentation found for {case_name}.")

        # --- Label map (optional) ----------------------------------------
        labelmap_path = file_dict.get("labelmap")
        if labelmap_path and os.path.isfile(labelmap_path):
            try:
                self.labelmap_node = slicer.util.loadLabelVolume(labelmap_path)
                self.labelmap_node.SetName(f"{case_name}_Label")
                self._loaded_node_ids.append(self.labelmap_node.GetID())
                print(f"[CaseLoader] Loaded labelmap: {self.labelmap_node.GetName()}")
            except Exception as e:
                print(f"[CaseLoader] WARNING: Could not load labelmap: {e}")
                self.labelmap_node = None
        else:
            print(f"[CaseLoader] No labelmap found for {case_name} (optional — skipped).")

        # --- Color table (optional) --------------------------------------
        colortable_path = file_dict.get("colortable")
        if colortable_path and os.path.isfile(colortable_path) and self.seg_node:
            self._apply_color_table(colortable_path)

        self.active_case_name = case_name
        print(f"[CaseLoader] Case '{case_name}' loaded successfully.")
        return True

    def unload_case(self):
        """Remove every node we loaded from the scene."""
        if not self._loaded_node_ids:
            return

        scene = slicer.mrmlScene
        for node_id in self._loaded_node_ids:
            node = scene.GetNodeByID(node_id)
            if node:
                scene.RemoveNode(node)
                print(f"[CaseLoader] Removed node: {node_id}")

        self._loaded_node_ids.clear()
        self.ct_node          = None
        self.seg_node         = None
        self.labelmap_node    = None
        self.active_case_name = None
        print("[CaseLoader] Previous case unloaded.")

    # ── private ─────────────────────────────────────────────────────────────

    def _apply_color_table(self, csv_path: str):
        """
        Read a CSV color table and apply it to segmentation segments.
        Expected CSV format:  index, name, R, G, B, A
        """
        try:
            import csv
            seg = self.seg_node.GetSegmentation()
            with open(csv_path, newline="") as f:
                reader = csv.reader(f)
                for row in reader:
                    if not row or row[0].startswith("#"):
                        continue
                    if len(row) < 5:
                        continue
                    # row: [index, name, R, G, B] or [index, name, R, G, B, A]
                    idx_field = row[0].strip()
                    name = row[1].strip()
                    r, g, b = (int(row[i].strip()) / 255.0 for i in (2, 3, 4))
                    # Find segment by name
                    segment_id = seg.GetSegmentIdBySegmentName(name)
                    if segment_id:
                        segment = seg.GetSegment(segment_id)
                        segment.SetColor(r, g, b)
            print(f"[CaseLoader] Color table applied from {csv_path}")
        except Exception as e:
            print(f"[CaseLoader] WARNING: Could not apply color table: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# PROBE CONTROLLER
# ─────────────────────────────────────────────────────────────────────────────

class ProbeController:
    """
    Connects VirtualProbePose transform to the Yellow slice reslice driver.

    CORRECT approach (NOT attaching CT to probe):
      - The Yellow slice's "reslice driver" is set to VirtualProbePose.
      - The slice plane origin + normal are recomputed from the transform matrix.
      - CT volume stays in world space — only the slice plane moves.

    This exactly simulates an ultrasound probe scanning through a fixed patient.
    """

    PROBE_TRANSFORM_NAME = "VirtualProbePose"
    SLICE_NAME           = "Yellow"

    def __init__(self):
        self._probe_node        = None
        self._observer_tag      = None   # ModifiedEvent observer
        self._ct_node           = None   # reference to active CT (for display)
        self._seg_node          = None   # reference to active segmentation

    # ── public ──────────────────────────────────────────────────────────────

    def setup_probe(self, ct_node, seg_node=None, labelmap_node=None):
        """
        Call this after a new case is loaded.
        Sets up the Yellow slice to show ct_node driven by VirtualProbePose.
        """
        self.cleanup()   # remove old observer first

        self._ct_node  = ct_node
        self._seg_node = seg_node

        # Get/verify probe transform
        try:
            self._probe_node = slicer.util.getNode(self.PROBE_TRANSFORM_NAME)
        except slicer.util.MRMLNodeNotFoundException:
            slicer.util.errorDisplay(
                f"Transform node '{self.PROBE_TRANSFORM_NAME}' not found.\n"
                "Please create or load it before using the probe."
            )
            return False

        # --- Configure Yellow slice composite node -----------------------
        slice_widget  = slicer.app.layoutManager().sliceWidget(self.SLICE_NAME)
        slice_logic   = slice_widget.sliceLogic()
        comp_node     = slice_logic.GetSliceCompositeNode()

        # Background = CT
        comp_node.SetBackgroundVolumeID(ct_node.GetID())

        # Foreground = off  (pass empty string, NOT Python None — Slicer C++ binding)
        comp_node.SetForegroundVolumeID("")

        # Label = labelmap if provided
        if labelmap_node:
            comp_node.SetLabelVolumeID(labelmap_node.GetID())
            comp_node.SetLabelOpacity(0.5)
        else:
            comp_node.SetLabelVolumeID(None)

        # --- Show segmentation in Yellow (2D overlay) --------------------
        if seg_node:
            self._show_segmentation_in_2d(seg_node, show=True)

        # --- Use reslice driver (SlicerIGT / built-in approach) ----------
        self._setup_reslice_driver(slice_widget)

        # --- Register transform observer ---------------------------------
        self._observer_tag = self._probe_node.AddObserver(
            vtk.vtkCommand.ModifiedEvent,
            self.on_probe_transform_modified
        )

        # Initial update so the slice jumps to probe position right away
        self.on_probe_transform_modified(None, None)

        print(f"[ProbeController] Probe setup complete for case.")
        return True

    def cleanup(self):
        """Remove transform observer — call before loading a new case."""
        if self._probe_node and self._observer_tag is not None:
            self._probe_node.RemoveObserver(self._observer_tag)
            self._observer_tag = None
            print("[ProbeController] Observer removed.")

    def on_probe_transform_modified(self, caller, event):
        """
        Called every time VirtualProbePose changes.
        Updates Yellow slice origin + normal to match the probe's matrix.
        """
        if not self._probe_node:
            return

        # Get 4x4 world-space transform
        mat = vtk.vtkMatrix4x4()
        self._probe_node.GetMatrixTransformToWorld(mat)

        # Column 3 → translation = new slice origin
        origin_x = mat.GetElement(0, 3)
        origin_y = mat.GetElement(1, 3)
        origin_z = mat.GetElement(2, 3)

        # Column 2 → Z-axis of probe = normal of the imaging plane
        normal_x = mat.GetElement(0, 2)
        normal_y = mat.GetElement(1, 2)
        normal_z = mat.GetElement(2, 2)

        # Column 0 → X-axis of probe = horizontal axis of image plane
        horiz_x = mat.GetElement(0, 0)
        horiz_y = mat.GetElement(1, 0)
        horiz_z = mat.GetElement(2, 0)

        slice_widget = slicer.app.layoutManager().sliceWidget(self.SLICE_NAME)
        slice_node   = slice_widget.mrmlSliceNode()

        # SliceToRAS is a 4x4 matrix stored in vtkMatrix4x4 row-major order.
        # GetElement(row, col) / SetElement(row, col, val)
        #
        # Column layout of SliceToRAS:
        #   col 0 → slice X-axis (horizontal direction in image plane)
        #   col 1 → slice Y-axis (vertical direction in image plane)
        #   col 2 → slice normal (perpendicular = beam direction)
        #   col 3 → slice origin (RAS position of plane centre)
        #
        # So: SetElement(row, col, val)
        #   col 0: rows 0-2 = horiz vector
        #   col 1: rows 0-2 = vert vector  (= normal × horiz)
        #   col 2: rows 0-2 = normal vector
        #   col 3: rows 0-2 = origin

        # Recompute vertical axis as cross product: vert = normal × horiz
        vert_x = normal_y * horiz_z - normal_z * horiz_y
        vert_y = normal_z * horiz_x - normal_x * horiz_z
        vert_z = normal_x * horiz_y - normal_y * horiz_x

        m = slice_node.GetSliceToRAS()

        # Col 0 — horizontal (X) axis of probe
        m.SetElement(0, 0, horiz_x)
        m.SetElement(1, 0, horiz_y)
        m.SetElement(2, 0, horiz_z)
        m.SetElement(3, 0, 0.0)

        # Col 1 — vertical (Y) axis (cross product)
        m.SetElement(0, 1, vert_x)
        m.SetElement(1, 1, vert_y)
        m.SetElement(2, 1, vert_z)
        m.SetElement(3, 1, 0.0)

        # Col 2 — slice normal (Z, beam direction)
        m.SetElement(0, 2, normal_x)
        m.SetElement(1, 2, normal_y)
        m.SetElement(2, 2, normal_z)
        m.SetElement(3, 2, 0.0)

        # Col 3 — slice origin in RAS
        m.SetElement(0, 3, origin_x)
        m.SetElement(1, 3, origin_y)
        m.SetElement(2, 3, origin_z)
        m.SetElement(3, 3, 1.0)

        slice_node.UpdateMatrices()

    def set_segmentation_visible(self, visible: bool):
        """Toggle segmentation overlay in Yellow slice."""
        if self._seg_node:
            self._show_segmentation_in_2d(self._seg_node, visible)

    # ── private ─────────────────────────────────────────────────────────────

    def _setup_reslice_driver(self, slice_widget):
        """
        Attempt to use the SlicerIGT resliceDriverLogic for clean driving.
        Falls back to the manual observer-based approach if not available.
        """
        try:
            reslice_logic = slicer.modules.volumereslicedriver.logic()
            slice_node = slice_widget.mrmlSliceNode()
            reslice_logic.SetDriverForSlice(
                self._probe_node.GetID(), slice_node
            )
            reslice_logic.SetModeForSlice(
                reslice_logic.MODE_TRANSVERSE, slice_node
            )
            print("[ProbeController] Using SlicerIGT VolumeResliceDriver.")
        except AttributeError:
            # SlicerIGT not installed — manual approach via observer is fine
            print(
                "[ProbeController] SlicerIGT not available; "
                "using manual slice-origin observer (works correctly)."
            )

    def _show_segmentation_in_2d(self, seg_node, show: bool):
        """
        Make segmentation visible/invisible as 2D overlay on all slice views.
        """
        display_node = seg_node.GetDisplayNode()
        if display_node is None:
            seg_node.CreateDefaultDisplayNodes()
            display_node = seg_node.GetDisplayNode()
        if display_node:
            display_node.SetVisibility2D(show)
            display_node.SetVisibility(show)


# ─────────────────────────────────────────────────────────────────────────────
# VOLUME RENDERING HELPER
# ─────────────────────────────────────────────────────────────────────────────

class VolumeRenderingHelper:
    """
    Toggle GPU volume rendering for a scalar volume node.
    """

    def __init__(self):
        self._display_node = None

    def enable(self, volume_node):
        """Turn on volume rendering for volume_node."""
        vol_rendering_logic = slicer.modules.volumerendering.logic()
        display_node = vol_rendering_logic.GetFirstVolumeRenderingDisplayNode(volume_node)
        if display_node is None:
            display_node = vol_rendering_logic.CreateDefaultVolumeRenderingDisplayNode()
            slicer.mrmlScene.AddNode(display_node)
            display_node.UnRegister(vol_rendering_logic)
            vol_rendering_logic.UpdateDisplayNodeFromVolumeNode(display_node, volume_node)
            volume_node.AddAndObserveDisplayNodeID(display_node.GetID())
        display_node.SetVisibility(True)
        self._display_node = display_node
        print(f"[VolumeRendering] Enabled for {volume_node.GetName()}")

    def disable(self):
        if self._display_node:
            self._display_node.SetVisibility(False)
            self._display_node = None

    @staticmethod
    def center_3d_view():
        """Reset the 3D camera to show the whole scene."""
        layout_manager = slicer.app.layoutManager()
        for i in range(layout_manager.threeDViewCount):
            three_d_widget = layout_manager.threeDWidget(i)
            three_d_widget.threeDView().resetFocalPoint()


# ─────────────────────────────────────────────────────────────────────────────
# CAPTURE MANAGER
# ─────────────────────────────────────────────────────────────────────────────

class CaptureManager:
    """
    Saves the current Yellow slice image + probe pose matrix to disk.
    Always captures from whatever case is currently active.
    """

    def __init__(self, output_dir: str):
        self.output_dir   = output_dir
        self.slice_name   = "Yellow"
        self.probe_name   = "VirtualProbePose"
        os.makedirs(self.output_dir, exist_ok=True)

    def capture_ct_slice_and_pose(self) -> tuple:
        """
        Returns (png_path, txt_path) or (None, None) on failure.
        """
        # --- probe node -----------------------------------------------
        try:
            probe_node = slicer.util.getNode(self.probe_name)
        except slicer.util.MRMLNodeNotFoundException:
            slicer.util.errorDisplay(
                f"Probe transform '{self.probe_name}' not found in the scene."
            )
            return None, None

        # --- next frame index -----------------------------------------
        existing_pngs = glob.glob(os.path.join(self.output_dir, "frame_*.png"))
        idx = len(existing_pngs)

        # --- grab slice render ----------------------------------------
        slice_widget = slicer.app.layoutManager().sliceWidget(self.slice_name)
        render_window = slice_widget.sliceView().renderWindow()

        w2i = vtk.vtkWindowToImageFilter()
        w2i.SetInput(render_window)
        w2i.SetScale(1)
        w2i.ReadFrontBufferOff()
        w2i.Update()

        png_path = os.path.join(self.output_dir, f"frame_{idx:04d}.png")
        writer = vtk.vtkPNGWriter()
        writer.SetFileName(png_path)
        writer.SetInputData(w2i.GetOutput())
        writer.Write()

        # --- save probe matrix ----------------------------------------
        mat = vtk.vtkMatrix4x4()
        probe_node.GetMatrixTransformToWorld(mat)
        rows = []
        for r in range(4):
            rows.append(" ".join(f"{mat.GetElement(r, c):.6f}" for c in range(4)))
        matrix_text = "\n".join(rows)

        txt_path = os.path.join(self.output_dir, f"frame_{idx:04d}.txt")
        with open(txt_path, "w") as f:
            f.write(matrix_text)

        print(f"[Capture] Image  → {png_path}")
        print(f"[Capture] Matrix → {txt_path}")
        return png_path, txt_path

    def set_output_dir(self, new_dir: str):
        self.output_dir = new_dir
        os.makedirs(self.output_dir, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# LOGIC  (Slicer module wiring)
# ─────────────────────────────────────────────────────────────────────────────

class USTrainingModuleLogic(ScriptedLoadableModuleLogic):
    """
    Thin glue between the UI widget and the domain classes above.
    """

    def __init__(self):
        super().__init__()
        self.case_manager    = None
        self.case_loader     = CaseLoader()
        self.probe_ctrl      = ProbeController()
        self.vol_rendering   = VolumeRenderingHelper()
        self.capture_mgr     = None   # created when dataset_root is set

    def initialize(self, dataset_root: str, capture_dir: str):
        self.case_manager = CaseManager(dataset_root)
        self.case_manager.discover_cases()
        self.capture_mgr  = CaptureManager(capture_dir)

    def load_case(self, case_name: str,
                  show_volume_rendering=False,
                  show_segmentation=True) -> bool:
        if not self.case_manager:
            slicer.util.errorDisplay("Please set the dataset root first.")
            return False

        file_dict = self.case_manager.get_case_files(case_name)
        if not file_dict:
            slicer.util.errorDisplay(f"Case '{case_name}' not registered.")
            return False

        # Unload old, load new
        self.probe_ctrl.cleanup()
        ok = self.case_loader.load_case(case_name, file_dict)
        if not ok:
            return False

        ct  = self.case_loader.ct_node
        seg = self.case_loader.seg_node
        lm  = self.case_loader.labelmap_node

        # Setup probe-driven Yellow slice
        self.probe_ctrl.setup_probe(ct, seg, lm)

        # Segmentation display in 3D and 2D
        if seg:
            self.probe_ctrl.set_segmentation_visible(show_segmentation)
            self._setup_seg_3d(seg, show_segmentation)

        # Volume rendering
        if show_volume_rendering:
            self.vol_rendering.enable(ct)
        else:
            self.vol_rendering.disable()

        # Fit all 2D slices to show the volume
        slicer.util.resetSliceViews()

        # Center 3D
        VolumeRenderingHelper.center_3d_view()

        return True

    def unload_case(self):
        self.probe_ctrl.cleanup()
        self.vol_rendering.disable()
        self.case_loader.unload_case()

    def capture_frame(self):
        if self.capture_mgr:
            return self.capture_mgr.capture_ct_slice_and_pose()
        return None, None

    def center_views(self):
        slicer.util.resetSliceViews()
        VolumeRenderingHelper.center_3d_view()

    # ── private ─────────────────────────────────────────────────────────────

    def _setup_seg_3d(self, seg_node, visible: bool):
        display_node = seg_node.GetDisplayNode()
        if display_node is None:
            seg_node.CreateDefaultDisplayNodes()
            display_node = seg_node.GetDisplayNode()
        if display_node:
            display_node.SetVisibility3D(visible)


# ─────────────────────────────────────────────────────────────────────────────
# WIDGET  (the UI panel shown in Slicer)
# ─────────────────────────────────────────────────────────────────────────────

class USTrainingModuleWidget(ScriptedLoadableModuleWidget):
    """
    Qt-based UI: dataset root picker, case dropdown, action buttons, status bar.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.logic = USTrainingModuleLogic()

    def setup(self):
        super().setup()

        # ── Dataset root row ────────────────────────────────────────────
        root_group = qt.QGroupBox("Dataset")
        root_layout = qt.QHBoxLayout(root_group)

        self.datasetPathEdit = qt.QLineEdit()
        self.datasetPathEdit.setPlaceholderText("/path/to/dataset")
        root_layout.addWidget(self.datasetPathEdit)

        browse_btn = qt.QPushButton("Browse…")
        browse_btn.clicked.connect(self._on_browse_dataset)
        root_layout.addWidget(browse_btn)

        self.captureDirEdit = qt.QLineEdit()
        self.captureDirEdit.setPlaceholderText("/path/to/captures")
        root_layout.addWidget(self.captureDirEdit)

        browse_cap_btn = qt.QPushButton("Cap Dir…")
        browse_cap_btn.clicked.connect(self._on_browse_capture)
        root_layout.addWidget(browse_cap_btn)

        scan_btn = qt.QPushButton("Scan Dataset")
        scan_btn.clicked.connect(self._on_scan_dataset)
        root_layout.addWidget(scan_btn)

        self.layout.addWidget(root_group)

        # ── Case selector ───────────────────────────────────────────────
        case_group = qt.QGroupBox("Case Selection")
        case_layout = qt.QVBoxLayout(case_group)

        self.caseComboBox = qt.QComboBox()
        self.caseComboBox.setMinimumWidth(200)
        case_layout.addWidget(self.caseComboBox)

        # Options row
        opts_row = qt.QHBoxLayout()
        self.showVolRendCheckBox = qt.QCheckBox("Show 3D Volume Rendering")
        self.showSegCheckBox     = qt.QCheckBox("Show Segmentation")
        self.showSegCheckBox.setChecked(True)
        opts_row.addWidget(self.showVolRendCheckBox)
        opts_row.addWidget(self.showSegCheckBox)
        case_layout.addLayout(opts_row)

        # Buttons row
        btn_row = qt.QHBoxLayout()
        load_btn   = qt.QPushButton("Load Selected Case")
        unload_btn = qt.QPushButton("Unload Current Case")
        center_btn = qt.QPushButton("Center Views")
        cap_btn    = qt.QPushButton("Capture Frame")

        load_btn.clicked.connect(self._on_load_case)
        unload_btn.clicked.connect(self._on_unload_case)
        center_btn.clicked.connect(self._on_center_views)
        cap_btn.clicked.connect(self._on_capture_frame)

        for b in (load_btn, unload_btn, center_btn, cap_btn):
            btn_row.addWidget(b)
        case_layout.addLayout(btn_row)

        # Status label
        self.statusLabel = qt.QLabel("Status: no case loaded")
        self.statusLabel.setStyleSheet("color: gray; font-style: italic;")
        case_layout.addWidget(self.statusLabel)

        self.layout.addWidget(case_group)

        # Spacer
        self.layout.addStretch()

    # ── button handlers ─────────────────────────────────────────────────────

    def _on_browse_dataset(self):
        path = qt.QFileDialog.getExistingDirectory(
            None, "Select Dataset Root Folder"
        )
        if path:
            self.datasetPathEdit.setText(path)

    def _on_browse_capture(self):
        path = qt.QFileDialog.getExistingDirectory(
            None, "Select Capture Output Folder"
        )
        if path:
            self.captureDirEdit.setText(path)

    def _on_scan_dataset(self):
        dataset_root = self.datasetPathEdit.text.strip()
        capture_dir  = self.captureDirEdit.text.strip() or os.path.join(
            dataset_root, "captures"
        )
        if not dataset_root:
            slicer.util.errorDisplay("Please select a dataset root folder.")
            return

        self.logic.initialize(dataset_root, capture_dir)

        self.caseComboBox.clear()
        for name in self.logic.case_manager.case_names():
            self.caseComboBox.addItem(name)

        count = self.caseComboBox.count
        self.statusLabel.setText(f"Status: {count} cases found. Select one and click Load.")

    def _on_load_case(self):
        case_name = self.caseComboBox.currentText
        if not case_name:
            slicer.util.errorDisplay("No case selected.")
            return

        self.statusLabel.setText(f"Status: loading {case_name}…")
        slicer.app.processEvents()

        ok = self.logic.load_case(
            case_name,
            show_volume_rendering=self.showVolRendCheckBox.isChecked(),
            show_segmentation=self.showSegCheckBox.isChecked(),
        )
        if ok:
            self.statusLabel.setText(f"Status: ✔ Active case — {case_name}")
        else:
            self.statusLabel.setText(f"Status: ✘ Failed to load {case_name}")

    def _on_unload_case(self):
        self.logic.unload_case()
        self.statusLabel.setText("Status: case unloaded.")

    def _on_center_views(self):
        self.logic.center_views()

    def _on_capture_frame(self):
        png, txt = self.logic.capture_frame()
        if png:
            self.statusLabel.setText(f"Status: captured → {os.path.basename(png)}")
        else:
            self.statusLabel.setText("Status: capture failed (no active case?)")


# ─────────────────────────────────────────────────────────────────────────────
# STANDALONE INTERACTOR ENTRY POINTS
# ─────────────────────────────────────────────────────────────────────────────

def quick_launch():
    """
    ONE-LINE launch using the real local dataset.
    Paste this into the Slicer Python Interactor after running setup_scene.py:

        import USTrainingModule
        USTrainingModule.quick_launch()
    """
    return launch_standalone(
        dataset_root = _ZIP_EXTRACT_ROOT,
        capture_dir  = _DEFAULT_CAPTURE_DIR,
    )


def launch_standalone(dataset_root: str = None, capture_dir: str = None):
    """
    Launch the training UI.  Both arguments are optional — omit them to
    use the local extracted dataset automatically.

        import USTrainingModule
        USTrainingModule.launch_standalone()   # uses local data

        # OR with custom paths:
        USTrainingModule.launch_standalone(
            r"D:/my_dataset",
            r"D:/captures"
        )
    """
    dataset_root = dataset_root or _ZIP_EXTRACT_ROOT
    capture_dir  = capture_dir  or _DEFAULT_CAPTURE_DIR

    logic = USTrainingModuleLogic()
    logic.initialize(dataset_root, capture_dir)

    case_names = logic.case_manager.case_names()

    if not case_names:
        try:
            slicer.util.errorDisplay(
                f"No valid cases found in:\n{dataset_root}\n\n"
                "Make sure the folder contains sub-folders with .nii.gz files."
            )
        except Exception:
            print(f"[USTraining] ERROR: No cases found in {dataset_root}")
        return None

    # ── Build the Qt dialog ──────────────────────────────────────────────────
    dialog = qt.QDialog(slicer.util.mainWindow())
    dialog.setWindowTitle(
        f"US Training — {len(case_names)} cases  "
        f"[{os.path.basename(dataset_root)}]"
    )
    dialog.setMinimumWidth(560)
    main_layout = qt.QVBoxLayout(dialog)
    main_layout.setSpacing(8)
    main_layout.setContentsMargins(12, 12, 12, 12)

    # ── Title label ──────────────────────────────────────────────────────────
    title = qt.QLabel("AI-Guided Ultrasound Training")
    title.setStyleSheet(
        "font-size: 15px; font-weight: bold; color: #2d86c2; "
        "padding-bottom: 4px;"
    )
    main_layout.addWidget(title)

    subtitle = qt.QLabel(f"Dataset: {dataset_root}")
    subtitle.setStyleSheet("color: gray; font-size: 10px;")
    main_layout.addWidget(subtitle)

    # ── Case selection ───────────────────────────────────────────────────────
    case_group = qt.QGroupBox(f"Select Case  ({len(case_names)} available)")
    cg_layout  = qt.QVBoxLayout(case_group)

    combo = qt.QComboBox()
    combo.setMinimumHeight(28)
    for name in case_names:
        combo.addItem(name)
    cg_layout.addWidget(combo)

    # Options row
    opt_row = qt.QHBoxLayout()
    show_seg = qt.QCheckBox("Show Segmentation")
    show_seg.setChecked(True)
    show_vr  = qt.QCheckBox("Show 3D Volume Rendering")
    opt_row.addWidget(show_seg)
    opt_row.addWidget(show_vr)
    opt_row.addStretch()
    cg_layout.addLayout(opt_row)

    # Buttons
    btn_row = qt.QHBoxLayout()
    load_btn    = qt.QPushButton("▶  Load Case")
    unload_btn  = qt.QPushButton("✖  Unload")
    center_btn  = qt.QPushButton("⊞  Center Views")
    capture_btn = qt.QPushButton("📷  Capture Frame")

    load_btn.setMinimumHeight(30)
    load_btn.setStyleSheet(
        "background-color: #2d86c2; color: white; "
        "font-weight: bold; border-radius: 4px;"
    )
    capture_btn.setMinimumHeight(30)
    capture_btn.setStyleSheet(
        "background-color: #27ae60; color: white; "
        "font-weight: bold; border-radius: 4px;"
    )

    for b in (load_btn, unload_btn, center_btn, capture_btn):
        btn_row.addWidget(b)
    cg_layout.addLayout(btn_row)

    main_layout.addWidget(case_group)

    # ── Status bar ───────────────────────────────────────────────────────────
    status = qt.QLabel("Ready — select a case and click Load.")
    status.setStyleSheet(
        "color: #555; font-style: italic; "
        "padding: 4px; background: #f5f5f5; border-radius: 3px;"
    )
    status.setWordWrap(True)
    main_layout.addWidget(status)

    # ── Capture info label ───────────────────────────────────────────────────
    cap_info = qt.QLabel(f"Capture dir: {capture_dir}")
    cap_info.setStyleSheet("color: gray; font-size: 9px;")
    main_layout.addWidget(cap_info)

    # ── Button handlers ──────────────────────────────────────────────────────
    def on_load():
        name = combo.currentText
        status.setText(f"Loading {name} …  (please wait)")
        slicer.app.processEvents()
        ok = logic.load_case(name, show_vr.isChecked(), show_seg.isChecked())
        if ok:
            status.setText(f"✔  Active case: {name}")
            status.setStyleSheet(
                "color: #1a7a3a; font-weight: bold; "
                "padding: 4px; background: #e8f8ee; border-radius: 3px;"
            )
        else:
            status.setText(f"✘  Failed to load: {name}")
            status.setStyleSheet(
                "color: #c0392b; font-weight: bold; "
                "padding: 4px; background: #fdecea; border-radius: 3px;"
            )

    def on_unload():
        logic.unload_case()
        status.setText("Case unloaded.")
        status.setStyleSheet(
            "color: #555; font-style: italic; "
            "padding: 4px; background: #f5f5f5; border-radius: 3px;"
        )

    def on_center():
        logic.center_views()
        status.setText("Views centred.")

    def on_capture():
        png, txt = logic.capture_frame()
        if png:
            idx = os.path.basename(png)
            status.setText(f"📷 Saved: {idx}")
            status.setStyleSheet(
                "color: #1a5276; font-weight: bold; "
                "padding: 4px; background: #eaf4fb; border-radius: 3px;"
            )
        else:
            status.setText("Capture failed — is a case loaded?")

    load_btn.clicked.connect(on_load)
    unload_btn.clicked.connect(on_unload)
    center_btn.clicked.connect(on_center)
    capture_btn.clicked.connect(on_capture)

    dialog.show()
    print(f"[USTraining] UI launched with {len(case_names)} cases.")
    print(f"[USTraining] Dataset : {dataset_root}")
    print(f"[USTraining] Captures: {capture_dir}")
    return logic
