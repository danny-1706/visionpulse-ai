// Core Inference & Workspace Interaction with Queue & Performance Enhancements

let currentTask = "detection";
let currentConfidence = 0.25;
let currentIoU = 0.45;
let currentImgSize = 640; // Mặc định 640px, có thể chọn 480px để tăng tốc gấp đôi
let selectedFile = null;
let currentResultUrl = null;

document.addEventListener("DOMContentLoaded", () => {
    initDropzone();
    updateActiveTaskUI();
});

// Chuyển đổi tác vụ
function selectTask(task) {
    currentTask = task;
    updateActiveTaskUI();
    showToast(`Đã chuyển sang tác vụ: ${getTaskName(task)}`, "info");
}

function getTaskName(task) {
    if (task === "detection") return "Phát Hiện Đối Tượng (Detection)";
    if (task === "segmentation") return "Phân Vùng Ảnh (Segmentation)";
    if (task === "pose") return "Ước Lượng Tư Thế (Pose)";
    return task;
}

function updateActiveTaskUI() {
    ["detection", "segmentation", "pose"].forEach(t => {
        const btn = document.getElementById(`task-btn-${t}`);
        if (!btn) return;
        if (t === currentTask) {
            btn.className = "task-selector-btn active-task px-3 py-3 rounded-xl border border-blue-500/50 bg-blue-600/20 text-blue-300 text-center transition flex flex-col items-center justify-center space-y-1 shadow-md shadow-blue-500/10";
        } else {
            btn.className = "task-selector-btn px-3 py-3 rounded-xl border border-slate-700/60 bg-slate-900/40 text-center transition flex flex-col items-center justify-center space-y-1 hover:border-slate-600 text-slate-300";
        }
    });
}

// Chuyển đổi kích thước ảnh xử lý (Scaling mode)
function setImageSize(size) {
    currentImgSize = parseInt(size);
    const btn480 = document.getElementById("size-btn-480");
    const btn640 = document.getElementById("size-btn-640");

    if (currentImgSize === 480) {
        btn480.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white shadow transition";
        btn640.className = "px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-white transition";
        showToast("Đã kích hoạt chế độ Siêu Tốc 480p (Tối ưu khi đông truy cập)", "info");
    } else {
        btn640.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white shadow transition";
        btn480.className = "px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-white transition";
        showToast("Đã kích hoạt chế độ Tiêu Chuẩn 640p (Độ nét cao nhất)", "info");
    }
}

// Cập nhật giá trị Sliders
function updateConf(val) {
    currentConfidence = parseFloat(val);
    document.getElementById("conf-val").innerText = Number(val).toFixed(2);
}

function updateIoU(val) {
    currentIoU = parseFloat(val);
    document.getElementById("iou-val").innerText = Number(val).toFixed(2);
}

// Cấu hình Kéo & Thả (Drag & Drop)
function initDropzone() {
    const dropZone = document.getElementById("drop-zone");
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("dropzone-active");
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("dropzone-active");
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleImageFile(files[0]);
        }
    });
}

function triggerFileInput(event) {
    if (event.target.closest('#clear-btn')) return;
    if (!selectedFile) {
        document.getElementById('file-input').click();
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        handleImageFile(files[0]);
    }
}

function handleImageFile(file) {
    if (!file.type.startsWith("image/")) {
        showToast("Vui lòng chỉ chọn định dạng tệp hình ảnh (JPG, PNG, WEBP)", "error");
        return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const origPreview = document.getElementById("orig-preview");
        const placeholder = document.getElementById("drop-placeholder");
        const clearBtn = document.getElementById("clear-btn");
        const runBtn = document.getElementById("run-btn");
        const origInfo = document.getElementById("orig-info");
        const origSize = document.getElementById("orig-size");

        origPreview.src = e.target.result;
        origPreview.classList.remove("hidden");
        placeholder.classList.add("hidden");
        clearBtn.classList.remove("hidden");

        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            origSize.innerText = `${img.naturalWidth} x ${img.naturalHeight} px`;
            origInfo.classList.remove("hidden");
        };

        runBtn.removeAttribute("disabled");
        runBtn.classList.remove("opacity-50", "cursor-not-allowed");
    };
    reader.readAsDataURL(file);
}

function clearSelectedImage(event) {
    if (event) event.stopPropagation();

    selectedFile = null;
    currentResultUrl = null;

    document.getElementById("orig-preview").classList.add("hidden");
    document.getElementById("drop-placeholder").classList.remove("hidden");
    document.getElementById("clear-btn").classList.add("hidden");
    document.getElementById("orig-info").classList.add("hidden");
    document.getElementById("file-input").value = "";

    const runBtn = document.getElementById("run-btn");
    runBtn.setAttribute("disabled", "true");
    runBtn.classList.add("opacity-50", "cursor-not-allowed");

    document.getElementById("result-preview").classList.add("hidden");
    document.getElementById("result-placeholder").classList.remove("hidden");
    document.getElementById("result-badges").classList.add("hidden");
    document.getElementById("result-actions").classList.add("hidden");
    document.getElementById("inspection-section").classList.add("hidden");
}

// Bắt đầu thực thi suy luận AI
async function startInference() {
    if (!selectedFile) {
        showToast("Vui lòng tải hoặc chụp một bức ảnh trước", "error");
        return;
    }

    const runBtn = document.getElementById("run-btn");
    const runText = document.getElementById("run-text");
    const runIcon = document.getElementById("run-icon");
    const resultPlaceholder = document.getElementById("result-placeholder");
    const resultLoading = document.getElementById("result-loading");
    const resultPreview = document.getElementById("result-preview");
    const resultBadges = document.getElementById("result-badges");
    const resultActions = document.getElementById("result-actions");

    runBtn.setAttribute("disabled", "true");
    runBtn.classList.add("opacity-50", "cursor-not-allowed");
    runText.innerText = "Đang xử lý...";
    runIcon.setAttribute("data-lucide", "loader-2");
    runIcon.classList.add("animate-spin");

    resultPlaceholder.classList.add("hidden");
    resultPreview.classList.add("hidden");
    resultActions.classList.add("hidden");
    resultLoading.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("task_type", currentTask);
    formData.append("confidence", currentConfidence);
    formData.append("iou", currentIoU);
    formData.append("imgsz", currentImgSize);

    try {
        const response = await fetch("/api/inference", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Xử lý thất bại từ máy chủ.");
        }

        const data = await response.json();
        renderInferenceResult(data);
        showToast(`Hoàn tất phân tích trong ${data.inference_time_ms} ms!`, "success");
        if (typeof updateQueueStatus === "function") updateQueueStatus();
    } catch (err) {
        showToast("Lỗi phân tích: " + err.message, "error");
        resultPlaceholder.classList.remove("hidden");
    } finally {
        resultLoading.classList.add("hidden");
        runBtn.removeAttribute("disabled");
        runBtn.classList.remove("opacity-50", "cursor-not-allowed");
        runText.innerText = "Phân Tích Ngay";
        runIcon.setAttribute("data-lucide", "sparkles");
        runIcon.classList.remove("animate-spin");
        if (window.lucide) lucide.createIcons();
    }
}

// Hiển thị kết quả lên giao diện
function renderInferenceResult(data) {
    currentResultUrl = data.result_image_url;

    const resultPreview = document.getElementById("result-preview");
    const resultBadges = document.getElementById("result-badges");
    const resultActions = document.getElementById("result-actions");
    const badgeLatency = document.getElementById("badge-latency");
    const badgeQueue = document.getElementById("badge-queue");
    const badgeCount = document.getElementById("badge-count");

    resultPreview.src = data.result_image_url;
    resultPreview.classList.remove("hidden");
    resultBadges.classList.remove("hidden");
    resultActions.classList.remove("hidden");

    // Dynamic latency color highlight
    let latencyColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (data.inference_time_ms > 1500) {
        latencyColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    } else if (data.inference_time_ms > 600) {
        latencyColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
    badgeLatency.className = `text-xs font-bold px-2.5 py-0.5 rounded border flex items-center space-x-1 ${latencyColor}`;
    badgeLatency.innerHTML = `<i data-lucide="zap" class="w-3 h-3"></i><span>${data.inference_time_ms} ms</span>`;

    const waitMs = data.queue_wait_ms || 0;
    badgeQueue.innerHTML = `<i data-lucide="clock" class="w-3 h-3 text-indigo-400"></i><span>Chờ: ${waitMs} ms</span>`;

    badgeCount.innerText = `${data.total_objects} đối tượng`;

    renderInspectionTray(data.detections);

    if (window.lucide) lucide.createIcons();
}

function renderInspectionTray(detections) {
    const inspectionSection = document.getElementById("inspection-section");
    const grid = document.getElementById("detections-grid");
    const summaryBadge = document.getElementById("objects-summary-badge");

    if (!detections || detections.length === 0) {
        inspectionSection.classList.remove("hidden");
        summaryBadge.innerText = "0 vật thể phát hiện";
        grid.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-slate-500">Không tìm thấy vật thể nào vượt qua ngưỡng tin cậy ${currentConfidence}. Hãy thử hạ thanh trượt Confidence.</div>`;
        return;
    }

    inspectionSection.classList.remove("hidden");
    summaryBadge.innerText = `${detections.length} đối tượng nhận diện thành công`;

    grid.innerHTML = detections.map((item, idx) => {
        const confPercent = Math.round(item.confidence * 100);
        return `
            <div class="glass-card rounded-xl p-3 border border-slate-700/60 flex flex-col justify-between space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs text-slate-200 capitalize">#${idx + 1} ${item.class_name}</span>
                    <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">${confPercent}%</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" style="width: ${confPercent}%"></div>
                </div>
                <div class="text-[10px] text-slate-500 font-mono truncate">
                    BBox: [${item.bounding_box.map(n => Math.round(n)).join(', ')}]
                </div>
            </div>
        `;
    }).join("");
}

// Tải xuống ảnh kết quả
function downloadResultImage() {
    if (!currentResultUrl) return;
    const a = document.createElement("a");
    a.href = currentResultUrl;
    a.download = `visionpulse_${currentTask}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Đang tải ảnh kết quả về máy...", "success");
}

// Xem ảnh toàn màn hình
function openFullscreenResult() {
    if (!currentResultUrl) return;
    window.open(currentResultUrl, "_blank");
}
