FROM python:3.11-slim

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV và xử lý ảnh
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy dependencies và cài đặt
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn
COPY . /app/

# Tạo các thư mục runtime nếu chưa có
RUN mkdir -p /app/data /app/app/static/uploads /app/weights

# Cấp toàn quyền đọc/ghi cho ứng dụng (tương thích Hugging Face Spaces & non-root user)
RUN chmod -R 777 /app

# Thiết lập cổng mặc định của Hugging Face Spaces
ENV PORT=7860
ENV HOST=0.0.0.0

EXPOSE 7860

# Khởi chạy ứng dụng bằng Uvicorn
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
