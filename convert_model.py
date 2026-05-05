"""
YOLOv11 → OpenVINO IR → INT8 Quantization Script.

Based on: https://docs.openvino.ai/2024/notebooks/yolov11-optimization.html

Steps:
  1. Download YOLOv11n PyTorch model
  2. Export to OpenVINO IR (FP16 / dynamic shapes)
  3. Quantize to INT8 using NNCF post-training quantization
  4. Save quantized model for production use

Usage:
  python convert_model.py
"""
import sys
from pathlib import Path

# ── Configuration ──
MODEL_NAME = "yolo11n"
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

FP_MODEL_DIR = MODEL_DIR / f"{MODEL_NAME}_openvino_model"
INT8_MODEL_DIR = MODEL_DIR / f"{MODEL_NAME}_openvino_int8_model"
FP_MODEL_PATH = FP_MODEL_DIR / f"{MODEL_NAME}.xml"
INT8_MODEL_PATH = INT8_MODEL_DIR / f"{MODEL_NAME}.xml"


def step1_export_openvino():
    """Download YOLOv11n and export to OpenVINO IR format."""
    if FP_MODEL_PATH.exists():
        print(f"[✓] FP16 OpenVINO model already exists at {FP_MODEL_DIR}")
        return

    print(f"[1/3] Downloading {MODEL_NAME} and exporting to OpenVINO IR...")
    from ultralytics import YOLO

    model = YOLO(f"{MODEL_NAME}.pt")
    model.export(format="openvino", dynamic=True, half=True)

    # Ultralytics exports to cwd — move to our models/ dir
    src_dir = Path(f"{MODEL_NAME}_openvino_model")
    if src_dir.exists() and not FP_MODEL_DIR.exists():
        src_dir.rename(FP_MODEL_DIR)
    elif src_dir.exists():
        import shutil
        shutil.rmtree(FP_MODEL_DIR, ignore_errors=True)
        src_dir.rename(FP_MODEL_DIR)

    # Clean up the .pt file from cwd if it landed there
    pt_file = Path(f"{MODEL_NAME}.pt")
    if pt_file.exists():
        pt_file.rename(MODEL_DIR / pt_file.name)

    print(f"[✓] FP16 model saved to {FP_MODEL_DIR}")


def step2_quantize_int8():
    """Quantize the FP16 model to INT8 using NNCF."""
    if INT8_MODEL_PATH.exists():
        print(f"[✓] INT8 model already exists at {INT8_MODEL_DIR}")
        return

    print("[2/3] Quantizing model to INT8 with NNCF...")
    print("      This will download COCO val2017 (~1GB) for calibration.")
    print("      Be patient — this can take several minutes.\n")

    import openvino as ov
    import nncf
    import numpy as np
    from ultralytics import YOLO
    from ultralytics.utils import DEFAULT_CFG
    from ultralytics.cfg import get_cfg
    from ultralytics.data.converter import coco80_to_coco91_class
    from ultralytics.data.utils import check_det_dataset, DATASETS_DIR
    from zipfile import ZipFile

    # ── Load FP model ──
    core = ov.Core()
    ov_model = core.read_model(str(FP_MODEL_PATH))

    # ── Load YOLO for preprocessing pipeline ──
    det_model = YOLO(str(FP_MODEL_DIR), task="detect")
    label_map = det_model.model.names

    # ── Download COCO val2017 for calibration ──
    OUT_DIR = DATASETS_DIR

    DATA_URL = "http://images.cocodataset.org/zips/val2017.zip"
    LABELS_URL = "https://github.com/ultralytics/yolov5/releases/download/v1.0/coco2017labels-segments.zip"
    CFG_URL = "https://raw.githubusercontent.com/ultralytics/ultralytics/v8.1.0/ultralytics/cfg/datasets/coco.yaml"

    DATA_PATH = OUT_DIR / "val2017.zip"
    LABELS_PATH = OUT_DIR / "coco2017labels-segments.zip"
    CFG_PATH = OUT_DIR / "coco.yaml"

    for url, path in [(DATA_URL, DATA_PATH), (LABELS_URL, LABELS_PATH), (CFG_URL, CFG_PATH)]:
        if not path.exists():
            print(f"  Downloading {path.name}...")
            import urllib.request
            path.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(url, str(path))
            print(f"  Downloaded {path.name}")

    if not (OUT_DIR / "coco/labels").exists():
        print("  Extracting labels...")
        with ZipFile(str(LABELS_PATH), "r") as zf:
            zf.extractall(str(OUT_DIR))

    if not (OUT_DIR / "coco/images/val2017").exists():
        print("  Extracting val2017 images...")
        with ZipFile(str(DATA_PATH), "r") as zf:
            zf.extractall(str(OUT_DIR / "coco/images"))

    # ── Setup validator and dataloader ──
    args = get_cfg(cfg=DEFAULT_CFG)
    args.data = str(CFG_PATH)
    det_validator = det_model.task_map[det_model.task]["validator"](args=args)
    det_validator.data = check_det_dataset(args.data)
    det_validator.stride = 32
    det_data_loader = det_validator.get_dataloader(str(OUT_DIR / "coco"), 1)

    det_validator.is_coco = True
    det_validator.class_map = coco80_to_coco91_class()
    det_validator.names = label_map
    det_validator.metrics.names = det_validator.names
    det_validator.nc = 80

    # ── Calibration dataset ──
    def transform_fn(data_item):
        input_tensor = det_validator.preprocess(data_item)["img"].numpy()
        return input_tensor

    quantization_dataset = nncf.Dataset(det_data_loader, transform_fn)

    # ── Quantize ──
    # Ignore post-processing subgraph (keep in FP32 for accuracy)
    ignored_scope = nncf.IgnoredScope(
        subgraphs=[
            nncf.Subgraph(
                inputs=[
                    "__module.model.23/aten::cat/Concat",
                    "__module.model.23/aten::cat/Concat_1",
                    "__module.model.23/aten::cat/Concat_2",
                ],
                outputs=["__module.model.23/aten::cat/Concat_7"],
            )
        ]
    )

    quantized_model = nncf.quantize(
        ov_model,
        quantization_dataset,
        preset=nncf.QuantizationPreset.MIXED,
        ignored_scope=ignored_scope,
    )

    # ── Save INT8 model ──
    INT8_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    ov.save_model(quantized_model, str(INT8_MODEL_PATH))
    print(f"\n[✓] INT8 quantized model saved to {INT8_MODEL_DIR}")


def step3_verify():
    """Quick verification that both models load and run."""
    print("\n[3/3] Verifying models...")
    import openvino as ov

    core = ov.Core()

    # FP16
    if FP_MODEL_PATH.exists():
        m = core.compile_model(str(FP_MODEL_PATH), "CPU")
        print(f"  FP16 model: OK  (loaded successfully)")
    else:
        print("  FP16 model: NOT FOUND")

    # INT8
    if INT8_MODEL_PATH.exists():
        m = core.compile_model(str(INT8_MODEL_PATH), "CPU")
        print(f"  INT8 model: OK  (loaded successfully)")
    else:
        print("  INT8 model: NOT FOUND (run without --skip-int8 to quantize)")

    print("\n[✓] Done! Update YOLO_MODEL_PATH in app/config.py to use the model.")
    print(f"    FP16: models/{MODEL_NAME}_openvino_model")
    print(f"    INT8: models/{MODEL_NAME}_openvino_int8_model")


if __name__ == "__main__":
    print("=" * 60)
    print("  YOLOv11 → OpenVINO IR → INT8 Conversion Pipeline")
    print("=" * 60)
    print()

    step1_export_openvino()
    print()

    # Check if user wants to skip quantization (slow, needs COCO download)
    skip_quant = "--skip-int8" in sys.argv
    if skip_quant:
        print("[SKIP] INT8 quantization (--skip-int8 flag)")
    else:
        step2_quantize_int8()

    print()
    step3_verify()
