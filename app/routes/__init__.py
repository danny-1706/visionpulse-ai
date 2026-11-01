from app.routes.web import router as web_router
from app.routes.api_inference import router as inference_router
from app.routes.api_history import router as history_router

__all__ = ["web_router", "inference_router", "history_router"]
