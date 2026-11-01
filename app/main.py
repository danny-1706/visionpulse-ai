import os
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import BASE_DIR, HOST, PORT, DEBUG, UPLOAD_DIR
from app.models.database import Base, engine
from app.routes.web import router as web_router
from app.routes.api_inference import router as inference_router
from app.routes.api_history import router as history_router
from app.services.yolo_service import YOLOService

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng SQLite và kích hoạt chế độ WAL tối ưu ghi/đọc đồng thời
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL;"))
        conn.execute(text("PRAGMA synchronous=NORMAL;"))
        conn.execute(text("PRAGMA cache_size=-64000;")) # 64MB cache
        conn.commit()
    print("✓ Cơ sở dữ liệu SQLite đã sẵn sàng (WAL mode enabled).")

    # Warm-up models để loại bỏ cold-start delay
    YOLOService.warmup_models()
    print("✓ Tất cả mô hình YOLOv8 đã sẵn sàng phục vụ lượng truy cập cao.")

    yield

app = FastAPI(
    title="VisionPulse AI - Nền tảng Thị giác Máy tính Đa năng",
    description="Hệ thống phân tích hình ảnh ứng dụng YOLOv8 (Object Detection, Segmentation, Pose Estimation) với FastAPI, Hàng đợi Async Concurrency và Modern UI Glassmorphism.",
    version="2.0.0",
    lifespan=lifespan
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount thư mục static (CSS, JS, Uploads)
static_dir = BASE_DIR / "app" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Đăng ký Routers
app.include_router(web_router)
app.include_router(inference_router)
app.include_router(history_router)

if __name__ == "__main__":
    print(f"🚀 Khởi chạy VisionPulse AI Server tại: http://{HOST}:{PORT}")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=DEBUG)
