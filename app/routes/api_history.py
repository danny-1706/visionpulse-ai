import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.database import get_db
from app.models.history import InferenceHistory, DetectionItem
from app.schemas.inference import HistoryItemResponse, DetectionItemSchema, StatsResponse
from app.services.image_service import ImageService

router = APIRouter(prefix="/api/history", tags=["History"])

@router.get("", response_model=List[HistoryItemResponse])
def get_histories(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    task_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InferenceHistory).order_by(InferenceHistory.created_at.desc())
    if task_type:
        query = query.filter(InferenceHistory.task_type == task_type.lower())
    
    records = query.offset(offset).limit(limit).all()
    results = []
    for rec in records:
        det_items = []
        for item in rec.items:
            bbox = json.loads(item.bounding_box) if item.bounding_box else None
            extra = json.loads(item.extra_data) if item.extra_data else None
            det_items.append(DetectionItemSchema(
                id=item.id,
                class_name=item.class_name,
                confidence=item.confidence,
                bounding_box=bbox,
                extra_data=extra
            ))

        results.append(HistoryItemResponse(
            id=rec.id,
            task_type=rec.task_type,
            original_image_url=ImageService.get_url(rec.original_image_path),
            result_image_url=ImageService.get_url(rec.result_image_path),
            confidence_threshold=rec.confidence_threshold,
            iou_threshold=rec.iou_threshold,
            inference_time_ms=rec.inference_time_ms,
            total_objects=rec.total_objects,
            created_at=rec.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            detections=det_items
        ))
    return results


@router.get("/stats/summary", response_model=StatsResponse)
def get_history_stats(db: Session = Depends(get_db)):
    total_inferences = db.query(InferenceHistory).count()
    total_detections = db.query(DetectionItem).count()

    # Phân loại theo Task (Detection, Segmentation, Pose)
    task_counts = (
        db.query(InferenceHistory.task_type, func.count(InferenceHistory.id))
        .group_by(InferenceHistory.task_type)
        .all()
    )
    task_breakdown = {t: c for t, c in task_counts}

    # Phân phối đối tượng (Top 10 Classes)
    class_counts = (
        db.query(DetectionItem.class_name, func.count(DetectionItem.id))
        .group_by(DetectionItem.class_name)
        .order_by(func.count(DetectionItem.id).desc())
        .limit(10)
        .all()
    )
    class_distribution = {cls: count for cls, count in class_counts}

    # Thời gian xử lý trung bình
    avg_latency = db.query(func.avg(InferenceHistory.inference_time_ms)).scalar() or 0.0

    return StatsResponse(
        total_inferences=total_inferences,
        total_detections=total_detections,
        task_breakdown=task_breakdown,
        class_distribution=class_distribution,
        average_inference_time_ms=round(avg_latency, 2)
    )


@router.get("/{history_id}", response_model=HistoryItemResponse)
def get_history_detail(history_id: int, db: Session = Depends(get_db)):
    rec = db.query(InferenceHistory).filter(InferenceHistory.id == history_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bản ghi lịch sử với ID: {history_id}"
        )

    det_items = []
    for item in rec.items:
        bbox = json.loads(item.bounding_box) if item.bounding_box else None
        extra = json.loads(item.extra_data) if item.extra_data else None
        det_items.append(DetectionItemSchema(
            id=item.id,
            class_name=item.class_name,
            confidence=item.confidence,
            bounding_box=bbox,
            extra_data=extra
        ))

    return HistoryItemResponse(
        id=rec.id,
        task_type=rec.task_type,
        original_image_url=ImageService.get_url(rec.original_image_path),
        result_image_url=ImageService.get_url(rec.result_image_path),
        confidence_threshold=rec.confidence_threshold,
        iou_threshold=rec.iou_threshold,
        inference_time_ms=rec.inference_time_ms,
        total_objects=rec.total_objects,
        created_at=rec.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        detections=det_items
    )


@router.delete("/{history_id}", status_code=status.HTTP_200_OK)
def delete_history_item(history_id: int, db: Session = Depends(get_db)):
    rec = db.query(InferenceHistory).filter(InferenceHistory.id == history_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bản ghi lịch sử với ID: {history_id}"
        )

    # Xóa file trên đĩa
    ImageService.delete_file(rec.original_image_path)
    ImageService.delete_file(rec.result_image_path)

    # Xóa trong database
    db.delete(rec)
    db.commit()

    return {"message": f"Bản ghi {history_id} và các file liên quan đã được xóa thành công."}
