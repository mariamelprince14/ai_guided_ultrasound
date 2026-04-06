"""
setup_scene.py
==============
One-time scene initialisation for the US Training system.
Run this ONCE from the Python Interactor before you start training.

What it does:
  1. Sets the Slicer layout to "Four-Up" (Red/Yellow/Green + 3D).
  2. Creates the VirtualProbePose linear transform node (if absent).
  3. Optionally creates a simple cone probe model and attaches it to the transform.
  4. Makes sure the Yellow slice is NOT linked to Red/Green so it can roam freely.
  5. Prints a readiness checklist.

Usage:
    # In the Slicer Python Interactor:
    exec(open(r"E:/downloads/usdemo/setup_scene.py").read())

    # OR from another script:
    import setup_scene          # if the folder is on sys.path
    setup_scene.run()
"""

import vtk
import slicer
import math


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

PROBE_TRANSFORM_NAME = "VirtualProbePose"
PROBE_MODEL_NAME     = "ProbeModel"
YELLOW_SLICE_NAME    = "Yellow"

# Layout: 4-up (three 2D + one 3D)
LAYOUT_FOUR_UP = slicer.vtkMRMLLayoutNode.SlicerLayoutFourUpView


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_transform(name: str):
    """Return existing transform node, or create a new identity one."""
    try:
        node = slicer.util.getNode(name)
        print(f"[setup_scene] Found existing transform: {name}")
        return node
    except slicer.util.MRMLNodeNotFoundException:
        node = slicer.mrmlScene.AddNewNodeByClass(
            "vtkMRMLLinearTransformNode", name
        )
        # Start at identity (probe in origin, looking down Z)
        ident = vtk.vtkMatrix4x4()
        ident.Identity()
        node.SetMatrixTransformToParent(ident)
        print(f"[setup_scene] Created new transform: {name}")
        return node


def _create_probe_model(transform_node):
    """
    Build a simple cone + cylinder to represent the probe in 3D.
    The cone tip points along +Z (the imaging beam direction).
    Attaches the model to VirtualProbePose so it moves with the probe.
    """
    # --- Check if model already exists ---------------------------------
    try:
        existing = slicer.util.getNode(PROBE_MODEL_NAME)
        existing.SetAndObserveTransformNodeID(transform_node.GetID())
        print(f"[setup_scene] Reused existing probe model: {PROBE_MODEL_NAME}")
        return existing
    except slicer.util.MRMLNodeNotFoundException:
        pass

    # --- Cone (probe tip / transducer face) ----------------------------
    cone = vtk.vtkConeSource()
    cone.SetHeight(20.0)     # 20 mm long
    cone.SetRadius(5.0)      # 5 mm radius
    cone.SetResolution(32)
    cone.SetDirection(0, 0, 1)   # tip points toward +Z
    cone.SetCenter(0, 0, 10)     # centre at z=10 so tip is at z=0
    cone.Update()

    # --- Cylinder (probe handle) ----------------------------------------
    cyl = vtk.vtkCylinderSource()
    cyl.SetHeight(60.0)      # 60 mm handle
    cyl.SetRadius(4.0)
    cyl.SetResolution(32)
    cyl.Update()

    # Rotate cylinder 90° so its axis aligns with Z
    cyl_tf = vtk.vtkTransform()
    cyl_tf.Translate(0, 0, -40)      # place handle behind tip
    cyl_tf.RotateX(90)
    cyl_tf_filter = vtk.vtkTransformPolyDataFilter()
    cyl_tf_filter.SetTransform(cyl_tf)
    cyl_tf_filter.SetInputConnection(cyl.GetOutputPort())
    cyl_tf_filter.Update()

    # Combine tip + handle
    appender = vtk.vtkAppendPolyData()
    appender.AddInputConnection(cone.GetOutputPort())
    appender.AddInputData(cyl_tf_filter.GetOutput())
    appender.Update()

    # Create model node
    model_node = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLModelNode", PROBE_MODEL_NAME)
    model_node.SetAndObserveMesh(appender.GetOutput())
    model_node.CreateDefaultDisplayNodes()

    display = model_node.GetDisplayNode()
    display.SetColor(0.2, 0.8, 0.2)    # green probe
    display.SetOpacity(0.85)
    display.SetRepresentation(2)       # surface

    # Attach probe model to VirtualProbePose so it moves with the transform
    model_node.SetAndObserveTransformNodeID(transform_node.GetID())

    print(f"[setup_scene] Created probe model: {PROBE_MODEL_NAME}")
    return model_node


def _set_layout(layout_id: int):
    """Switch Slicer's main layout."""
    layout_node = slicer.app.layoutManager().layoutNode()
    layout_node.SetViewArrangement(layout_id)
    slicer.app.processEvents()
    print(f"[setup_scene] Layout set to ID={layout_id} (Four-Up).")


def _unlink_yellow_slice():
    """
    Unlink Yellow slice from the Red/Green link group so it can be
    driven independently by the probe without dragging other slices.
    """
    slice_widget = slicer.app.layoutManager().sliceWidget(YELLOW_SLICE_NAME)
    if slice_widget is None:
        print(f"[setup_scene] WARNING: Yellow slice widget not found.")
        return

    composite = slice_widget.sliceLogic().GetSliceCompositeNode()
    # LinkedControl = 0 → unlinked
    composite.SetLinkedControl(0)
    print(f"[setup_scene] Yellow slice unlinked from Red/Green group.")


def _set_yellow_slice_orientation():
    """
    Set Yellow slice to Axial initially.
    Once the probe observer fires it will be overridden, but this avoids
    a blank slice before the first probe move.
    """
    slice_widget = slicer.app.layoutManager().sliceWidget(YELLOW_SLICE_NAME)
    slice_node   = slice_widget.mrmlSliceNode()
    slice_node.SetOrientationToAxial()
    print(f"[setup_scene] Yellow slice initialised to axial orientation.")


def _print_checklist(probe_node):
    """Print a readiness summary for the user."""
    print("\n" + "=" * 60)
    print("  SCENE SETUP COMPLETE")
    print("=" * 60)
    print(f"  ✔  Transform : {probe_node.GetName()} (ID: {probe_node.GetID()})")
    print(f"  ✔  Layout    : Four-Up (Red / Yellow / Green + 3D)")
    print(f"  ✔  Yellow    : unlinked, ready for probe driving")
    print(f"  ✔  Probe     : {PROBE_MODEL_NAME} attached to transform")
    print()
    print("  NEXT STEPS:")
    print("  1. Run the USTrainingModule (or launch_standalone()).")
    print("  2. Scan your dataset folder.")
    print("  3. Select a case and click 'Load Selected Case'.")
    print("  4. Move VirtualProbePose → Yellow slice updates in real time.")
    print("  5. Click 'Capture Frame' to save slice + pose.")
    print("=" * 60 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def run(create_probe_model: bool = True):
    """
    Call this once to prepare the Slicer scene for US training.

    Args:
        create_probe_model: If True, creates a visible cone/cylinder probe
                            model in the 3D view. Disable if you supply your
                            own .stl or .obj probe model.
    """
    # 1) Layout
    _set_layout(LAYOUT_FOUR_UP)

    # 2) Probe transform
    probe_node = _get_or_create_transform(PROBE_TRANSFORM_NAME)

    # 3) Probe model (optional visualisation)
    if create_probe_model:
        _create_probe_model(probe_node)

    # 4) Yellow slice settings
    _unlink_yellow_slice()
    _set_yellow_slice_orientation()

    # 5) Reset camera
    layout_manager = slicer.app.layoutManager()
    for i in range(layout_manager.threeDViewCount):
        layout_manager.threeDWidget(i).threeDView().resetFocalPoint()

    # 6) Summary
    _print_checklist(probe_node)

    return probe_node


# ─────────────────────────────────────────────────────────────────────────────
# Allow running directly via exec() in the Python Interactor
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()
else:
    # Also auto-run when exec()'d into an existing namespace
    run()
