import uuid
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import io
from app.config import UPLOAD_DIR

class ImageService:
    @staticmethod
    def read_image_bytes(file_bytes: bytes) -> np.ndarray:
        """Chuyển đổi mảng bytes sang ảnh OpenCV định dạng BGR"""
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Không thể giải mã dữ liệu ảnh. Vui lòng cung cấp file ảnh hợp lệ.")
        return img

    @staticmethod
    def save_image_array(img_bgr: np.ndarray, prefix: str = "img") -> str:
        """Lưu mảng ảnh OpenCV vào thư mục uploads và trả về tên file"""
        filename = f"{prefix}_{uuid.uuid4().hex[:12]}.jpg"
        file_path = UPLOAD_DIR / filename
        # Lưu định dạng JPEG với chất lượng cao 92%
        cv2.imwrite(str(file_path), img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        return filename

    @staticmethod
    def get_url(filename: str) -> str:
        """Trả về URL tĩnh để client truy cập"""
        return f"/static/uploads/{filename}"

    @staticmethod
    def delete_file(filename: str) -> bool:
        """Xoá file ảnh khỏi hệ thống đĩa nếu tồn tại"""
        file_path = UPLOAD_DIR / filename
        if file_path.exists():
            file_path.unlink()
            return True
        return False
