import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "app" / "static" / "uploads"
WEIGHTS_DIR = BASE_DIR / "weights"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

# Database Configuration
DATABASE_URL = f"sqlite:///{DATA_DIR / 'vision_platform.db'}"

# Model Configurations
MODEL_PATHS = {
    "detection": WEIGHTS_DIR / "yolov8n.pt",
    "segmentation": WEIGHTS_DIR / "yolov8n-seg.pt",
    "pose": WEIGHTS_DIR / "yolov8n-pose.pt",
}

# Model Remote / Name Fallbacks (Ultralytics auto-downloads if only filename is given)
MODEL_NAMES = {
    "detection": "yolov8n.pt",
    "segmentation": "yolov8n-seg.pt",
    "pose": "yolov8n-pose.pt",
}

# Server Config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 7860))  # 7860 for Hugging Face Spaces compatibility
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1")
