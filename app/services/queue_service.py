import asyncio
import time
from typing import Callable, Any
from concurrent.futures import ThreadPoolExecutor

class QueueManager:
    """
    Quản lý hàng đợi bất đồng bộ và kiểm soát mức độ đồng thời (Concurrency Control).
    Đảm bảo khi có 10-20 người dùng gửi ảnh cùng lúc:
    - Không làm nghẽn CPU hoặc cạn kiệt RAM (OOM)
    - Không chặn Event Loop của FastAPI (nhờ ThreadPoolExecutor)
    - Người dùng ở hàng đợi nhận được thông báo vị trí chính xác
    """
    def __init__(self, max_concurrent: int = 3, max_threads: int = 4):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.executor = ThreadPoolExecutor(max_workers=max_threads, thread_name_prefix="yolo_worker")
        
        # Thống kê thời gian thực
        self.active_tasks: int = 0
        self.waiting_tasks: int = 0
        self.total_processed: int = 0
        self.total_wait_time_ms: float = 0.0

    async def run_in_queue(self, sync_func: Callable, *args, **kwargs) -> Any:
        self.waiting_tasks += 1
        queue_start = time.perf_counter()
        
        try:
            async with self.semaphore:
                self.waiting_tasks -= 1
                self.active_tasks += 1
                wait_duration = (time.perf_counter() - queue_start) * 1000
                self.total_wait_time_ms += wait_duration
                
                try:
                    # Chạy hàm CPU-bound trong ThreadPool riêng biệt, giải phóng Event Loop
                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        self.executor,
                        lambda: sync_func(*args, **kwargs)
                    )
                    return result, round(wait_duration, 1)
                finally:
                    self.active_tasks -= 1
                    self.total_processed += 1
        except Exception:
            # Nếu xảy ra exception trước khi vào semaphore
            if self.waiting_tasks > 0 and self.active_tasks == 0:
                self.waiting_tasks -= 1
            raise

    def get_status(self) -> dict:
        avg_wait = (
            round(self.total_wait_time_ms / self.total_processed, 1)
            if self.total_processed > 0 else 0.0
        )
        return {
            "max_concurrent_slots": self.max_concurrent,
            "active_tasks": self.active_tasks,
            "waiting_tasks": self.waiting_tasks,
            "total_processed": self.total_processed,
            "average_queue_wait_ms": avg_wait,
            "status": "busy" if self.waiting_tasks > 0 else "ready"
        }

# Global singleton instance
queue_manager = QueueManager(max_concurrent=3, max_threads=4)
