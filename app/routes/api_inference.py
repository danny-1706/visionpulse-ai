import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.history import InferenceHistory, DetectionItem
from app.schemas.inference import InferenceResponse, DetectionItemSchema, QueueStatusResponse
from app.services.image_service import ImageService
from app.services.yolo_service import YOLOService
from app.services.queue_service import queue_manager

router = APIRouter(prefix="/api/inference", tags=["Inference"])

@router.get("/queue-status", response_model=QueueStatusResponse)
def get_queue_status():
    """Lấy trạng thái hàng đợi và tải hệ thống thời gian thực"""
    return queue_manager.get_status()

@router.post("", response_model=InferenceResponse)
async def perform_inference(
    file: UploadFile = File(...),
    task_type: str = Form("detection"),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    imgsz: int = Form(640),
    db: Session = Depends(get_db)
):
    # Kiểm tra loại tác vụ hợp lệ
    task_type = task_type.lower().strip()
    if task_type not in ["detection", "segmentation", "pose"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tác vụ '{task_type}' không được hỗ trợ. Chọn: detection, segmentation, pose."
        )

    # Đọc file ảnh
    try:
        contents = await file.read()
        if not contents or len(contents) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File ảnh tải lên không có dữ liệu."
            )
        img_bgr = ImageService.read_image_bytes(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi khi đọc file ảnh: {str(e)}"
        )

    # Chạy suy luận qua Hàng Đợi (QueueManager) kết hợp ThreadPool
    # Đảm bảo Event Loop không bị nghẽn và tải đồng thời 10-20 requests được điều tiết nhịp nhàng
    try:
        (annotated_bgr, detections_data, inference_time_ms), queue_wait_ms = await queue_manager.run_in_queue(
            YOLOService.run_inference,
            image_bgr=img_bgr,
            task_type=task_type,
            conf=confidence,
            iou=iou,
            imgsz=imgsz
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình suy luận AI: {str(e)}"
        )

    # Lưu ảnh gốc và ảnh kết quả
    try:
        orig_filename = ImageService.save_image_array(img_bgr, prefix=f"orig_{task_type}")
        res_filename = ImageService.save_image_array(annotated_bgr, prefix=f"res_{task_type}")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lưu trữ ảnh kết quả: {str(e)}"
        )

    # Lưu dữ liệu vào Cơ sở dữ liệu SQLite
    history_entry = InferenceHistory(
        task_type=task_type,
        original_image_path=orig_filename,
        result_image_path=res_filename,
        confidence_threshold=confidence,
        iou_threshold=iou,
        inference_time_ms=inference_time_ms,
        total_objects=len(detections_data)
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)

    # Lưu từng detection item
    for item in detections_data:
        detection_entry = DetectionItem(
            history_id=history_entry.id,
            class_name=item["class_name"],
            confidence=item["confidence"],
            bounding_box=json.dumps(item["bounding_box"]),
            extra_data=json.dumps(item["extra_data"]) if item["extra_data"] else None
        )
        db.add(detection_entry)
    
    db.commit()

    return InferenceResponse(
        history_id=history_entry.id,
        task_type=history_entry.task_type,
        original_image_url=ImageService.get_url(orig_filename),
        result_image_url=ImageService.get_url(res_filename),
        confidence_threshold=history_entry.confidence_threshold,
        iou_threshold=history_entry.iou_threshold,
        inference_time_ms=history_entry.inference_time_ms,
        queue_wait_ms=queue_wait_ms,
        total_objects=history_entry.total_objects,
        created_at=history_entry.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        detections=[
            DetectionItemSchema(
                class_name=d["class_name"],
                confidence=d["confidence"],
                bounding_box=d["bounding_box"],
                extra_data=d["extra_data"]
            )
            for d in detections_data
        ]
    )
