from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.database import Base

class InferenceHistory(Base):
    __tablename__ = "inference_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_type = Column(String(50), nullable=False, index=True)  # detection, segmentation, pose
    original_image_path = Column(String(255), nullable=False)
    result_image_path = Column(String(255), nullable=False)
    confidence_threshold = Column(Float, default=0.25)
    iou_threshold = Column(Float, default=0.45)
    inference_time_ms = Column(Float, default=0.0)
    total_objects = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Quan hệ tới các đối tượng nhận diện
    items = relationship("DetectionItem", back_populates="history", cascade="all, delete-orphan")


class DetectionItem(Base):
    __tablename__ = "detection_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("inference_history.id"), nullable=False, index=True)
    class_name = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    bounding_box = Column(Text, nullable=True)  # JSON string: [x1, y1, x2, y2]
    extra_data = Column(Text, nullable=True)    # JSON string: keypoints, masks, etc.

    history = relationship("InferenceHistory", back_populates="items")
