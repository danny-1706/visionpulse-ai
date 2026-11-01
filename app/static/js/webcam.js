// Webcam Handler Module

let webcamStream = null;

async function openWebcamModal() {
    const modal = document.getElementById("webcam-modal");
    const video = document.getElementById("webcam-video");
    const loader = document.getElementById("webcam-loader");

    if (!modal || !video) return;

    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
    loader.classList.remove("hidden");

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Trình duyệt không hỗ trợ MediaDevices API hoặc kết nối chưa an toàn (cần HTTPS/localhost).");
        }

        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = webcamStream;
        video.onloadedmetadata = () => {
            video.play();
            loader.classList.add("hidden");
        };
    } catch (err) {
        loader.classList.add("hidden");
        closeWebcamModal();
        showToast("Không thể khởi động Webcam: " + err.message, "error");
    }
}

function closeWebcamModal() {
    const modal = document.getElementById("webcam-modal");
    const video = document.getElementById("webcam-video");

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }

    if (video) video.srcObject = null;

    if (modal) {
        modal.classList.add("opacity-0");
        setTimeout(() => modal.classList.add("hidden"), 300);
    }
}

function captureWebcamSnapshot() {
    const video = document.getElementById("webcam-video");
    const canvas = document.getElementById("webcam-canvas");

    if (!video || !canvas || !webcamStream) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        if (!blob) {
            showToast("Lỗi tạo ảnh từ camera", "error");
            return;
        }

        // Tạo đối tượng File từ Blob
        const capturedFile = new File([blob], `webcam_${Date.now()}.jpg`, { type: "image/jpeg" });
        
        // Truyền file vào luồng xử lý chính
        handleImageFile(capturedFile);

        closeWebcamModal();
        showToast("Đã chụp ảnh từ webcam thành công!", "success");
    }, "image/jpeg", 0.95);
}
