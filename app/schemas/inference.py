from typing import List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

class DetectionItemSchema(BaseModel):
    id: Optional[int] = None
    class_name: str
    confidence: float
    bounding_box: Optional[List[float]] = None
    extra_data: Optional[Any] = None

    class Config:
        from_attributes = True


class InferenceResponse(BaseModel):
    history_id: int
    task_type: str
    original_image_url: str
    result_image_url: str
    confidence_threshold: float
    iou_threshold: float
    inference_time_ms: float
    queue_wait_ms: Optional[float] = 0.0
    total_objects: int
    created_at: str
    detections: List[DetectionItemSchema]


class HistoryItemResponse(BaseModel):
    id: int
    task_type: str
    original_image_url: str
    result_image_url: str
    confidence_threshold: float
    iou_threshold: float
    inference_time_ms: float
    total_objects: int
    created_at: str
    detections: List[DetectionItemSchema]

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_inferences: int
    total_detections: int
    task_breakdown: dict
    class_distribution: dict
    average_inference_time_ms: float


class QueueStatusResponse(BaseModel):
    max_concurrent_slots: int
    active_tasks: int
    waiting_tasks: int
    total_processed: int
    average_queue_wait_ms: float
    status: str
