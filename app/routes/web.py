from pathlib import Path
from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.history import InferenceHistory
from app.config import BASE_DIR

router = APIRouter(include_in_schema=False)

templates_path = BASE_DIR / "app" / "templates"
templates = Jinja2Templates(directory=str(templates_path))

@router.get("/")
def index_page(request: Request):
    """Trang chủ: Dashboard phân tích AI tương tác (2 cột)"""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"active_page": "dashboard"}
    )

@router.get("/history")
def history_page(request: Request, db: Session = Depends(get_db)):
    """Trang lịch sử phân tích và biểu đồ thống kê"""
    histories = db.query(InferenceHistory).order_by(InferenceHistory.created_at.desc()).limit(30).all()
    return templates.TemplateResponse(
        request=request,
        name="history.html",
        context={
            "active_page": "history",
            "histories": histories
        }
    )
