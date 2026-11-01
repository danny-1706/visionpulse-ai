import time
import json
import torch
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Tuple
from ultralytics import YOLO
from app.config import MODEL_PATHS, MODEL_NAMES

# Cấu hình tối ưu hoá PyTorch trên CPU:
# Giới hạn số threads per inference để tránh CPU thrashing khi chạy song song 3-4 workers
torch.set_num_threads(2)

class YOLOService:
    _models: Dict[str, YOLO] = {}

    @classmethod
    def get_model(cls, task_type: str) -> YOLO:
        """Cache và tải mô hình YOLOv8 tương ứng với task_type"""
        if task_type not in MODEL_NAMES:
            raise ValueError(f"Tác vụ không hợp lệ: '{task_type}'. Hỗ trợ: detection, segmentation, pose")

        if task_type not in cls._models:
            model_target = str(MODEL_PATHS[task_type])
            if not Path(model_target).exists():
                model_target = MODEL_NAMES[task_type]
            
            print(f"[YOLOService] Đang tải mô hình: {task_type} ({model_target})...")
            model = YOLO(model_target)
            cls._models[task_type] = model
            print(f"[YOLOService] Tải mô hình {task_type} thành công.")

        return cls._models[task_type]

    @classmethod
    def warmup_models(cls):
        """Khởi động trước tất cả mô hình khi server start, loại bỏ độ trễ cold start cho người dùng đầu tiên"""
        print("[YOLOService] Đang khởi động làm nóng (warm-up) các mô hình AI...")
        dummy_img = np.zeros((320, 320, 3), dtype=np.uint8)
        for task in ["detection", "segmentation", "pose"]:
            try:
                model = cls.get_model(task)
                with torch.inference_mode():
                    model.predict(source=dummy_img, imgsz=320, verbose=False, device="cpu")
                print(f"[YOLOService] Warm-up hoàn tất cho {task}.")
            except Exception as e:
                print(f"[YOLOService] Cảnh báo warm-up {task}: {e}")

    @classmethod
    def run_inference(
        cls,
        image_bgr: np.ndarray,
        task_type: str = "detection",
        conf: float = 0.25,
        iou: float = 0.45,
        imgsz: int = 640
    ) -> Tuple[np.ndarray, List[Dict[str, Any]], float]:
        """
        Thực thi suy luận AI trên ảnh OpenCV BGR với PyTorch Inference Mode.
        Trả về: (annotated_image_bgr, detections_list, inference_time_ms)
        """
        model = cls.get_model(task_type)

        start_time = time.perf_counter()
        
        # Tối ưu hóa bộ nhớ và tốc độ với inference_mode
        with torch.inference_mode():
            results = model.predict(
                source=image_bgr,
                conf=conf,
                iou=iou,
                imgsz=imgsz,
                verbose=False,
                device="cpu"
            )
            
        end_time = time.perf_counter()
        inference_time_ms = round((end_time - start_time) * 1000, 2)

        result = results[0]
        annotated_bgr = result.plot()

        detections = []
        names = model.names

        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                class_name = names.get(cls_id, f"Class {cls_id}")
                confidence = float(boxes.conf[i].item())
                xyxy = boxes.xyxy[i].tolist()

                extra_info = {}
                if task_type == "segmentation" and result.masks is not None:
                    try:
                        mask_xy = result.masks.xy[i]
                        simplified_poly = mask_xy[::3].tolist() if len(mask_xy) > 0 else []
                        extra_info["mask_polygon_sample"] = simplified_poly
                    except Exception:
                        pass

                if task_type == "pose" and result.keypoints is not None:
                    try:
                        kpts = result.keypoints.xy[i].tolist()
                        extra_info["keypoints"] = kpts
                    except Exception:
                        pass

                detections.append({
                    "class_name": class_name,
                    "confidence": round(confidence, 4),
                    "bounding_box": [round(coord, 1) for coord in xyxy],
                    "extra_data": extra_info if extra_info else None
                })

        return annotated_bgr, detections, inference_time_ms
