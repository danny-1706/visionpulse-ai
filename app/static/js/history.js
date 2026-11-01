// History & Analytics Dashboard Logic

let classChartInstance = null;
let taskChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    refreshHistoryData();
});

async function refreshHistoryData() {
    await Promise.all([
        loadStats(),
        loadHistoryList()
    ]);
}

// 1. Tải và Vẽ biểu đồ Thống kê
async function loadStats() {
    try {
        const res = await fetch("/api/history/stats/summary");
        if (!res.ok) throw new Error("Không thể lấy dữ liệu thống kê");
        const stats = await res.json();

        // Cập nhật KPI Cards
        document.getElementById("kpi-total-inferences").innerText = stats.total_inferences;
        document.getElementById("kpi-total-detections").innerText = stats.total_detections;
        document.getElementById("kpi-avg-latency").innerText = `${stats.average_inference_time_ms} ms`;

        const topClassEntry = Object.entries(stats.class_distribution)[0];
        document.getElementById("kpi-top-class").innerText = topClassEntry ? `${topClassEntry[0]} (${topClassEntry[1]})` : "Chưa có";

        // Vẽ biểu đồ Doughnut (Phân phối Class)
        renderClassDistributionChart(stats.class_distribution);

        // Vẽ biểu đồ Bar (Phân phối Tác vụ)
        renderTaskBreakdownChart(stats.task_breakdown);

    } catch (err) {
        console.error("Lỗi tải thống kê:", err);
    }
}

function renderClassDistributionChart(distribution) {
    const ctx = document.getElementById("classes-chart").getContext("2d");
    const noMsg = document.getElementById("no-classes-msg");
    const labels = Object.keys(distribution);
    const data = Object.values(distribution);

    if (labels.length === 0) {
        document.getElementById("classes-chart").classList.add("hidden");
        noMsg.classList.remove("hidden");
        return;
    } else {
        document.getElementById("classes-chart").classList.remove("hidden");
        noMsg.classList.add("hidden");
    }

    if (classChartInstance) classChartInstance.destroy();

    const colors = [
        '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
        '#06B6D4', '#EC4899', '#6366F1', '#14B8A6', '#84CC16'
    ];

    classChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#111827'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#94a3b8',
                        font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }
                    }
                }
            },
            cutout: '68%'
        }
    });
}

function renderTaskBreakdownChart(tasks) {
    const ctx = document.getElementById("tasks-chart").getContext("2d");
    const noMsg = document.getElementById("no-tasks-msg");

    const labelMap = {
        detection: "Phát Hiện (Detection)",
        segmentation: "Phân Vùng (Seg)",
        pose: "Tư Thế (Pose)"
    };

    const labels = Object.keys(tasks).map(t => labelMap[t] || t);
    const data = Object.values(tasks);

    if (labels.length === 0) {
        document.getElementById("tasks-chart").classList.add("hidden");
        noMsg.classList.remove("hidden");
        return;
    } else {
        document.getElementById("tasks-chart").classList.remove("hidden");
        noMsg.classList.add("hidden");
    }

    if (taskChartInstance) taskChartInstance.destroy();

    taskChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số phiên phân tích',
                data: data,
                backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8', stepSize: 1 },
                    grid: { color: 'rgba(51, 65, 85, 0.4)' }
                },
                x: {
                    ticks: { color: '#94a3b8', font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// 2. Tải và Render Danh Sách Lịch Sử
async function loadHistoryList() {
    const tbody = document.getElementById("history-table-body");
    try {
        const res = await fetch("/api/history?limit=50");
        if (!res.ok) throw new Error("Không thể tải bảng lịch sử");
        const items = await res.json();

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-slate-500">
                        Chưa có lượt phân tích nào được ghi nhận. Hãy thực hiện phân tích tại Dashboard!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => {
            const taskBadge = getTaskBadge(item.task_type);
            return `
                <tr class="hover:bg-slate-800/40 transition">
                    <td class="py-3 px-4 font-mono font-bold text-slate-400">#${item.id}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center space-x-2">
                            <img src="${item.original_image_url}" alt="Gốc" class="w-10 h-10 object-cover rounded-lg border border-slate-700">
                            <i data-lucide="arrow-right" class="w-3 h-3 text-slate-600"></i>
                            <img src="${item.result_image_url}" alt="Kết quả" class="w-10 h-10 object-cover rounded-lg border border-blue-500/30">
                        </div>
                    </td>
                    <td class="py-3 px-4">${taskBadge}</td>
                    <td class="py-3 px-4 font-bold text-slate-200">${item.total_objects} vật thể</td>
                    <td class="py-3 px-4 text-slate-400 font-mono">${item.confidence_threshold} / ${item.iou_threshold}</td>
                    <td class="py-3 px-4 text-amber-400 font-mono">${item.inference_time_ms} ms</td>
                    <td class="py-3 px-4 text-slate-400">${item.created_at}</td>
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end space-x-2">
                            <button onclick="viewHistoryDetail(${item.id})" title="Xem chi tiết" class="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition">
                                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteHistoryRecord(${item.id})" title="Xoá bản ghi" class="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 transition">
                                <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

function getTaskBadge(task) {
    if (task === "detection") {
        return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Detection</span>`;
    }
    if (task === "segmentation") {
        return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Segmentation</span>`;
    }
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">Pose</span>`;
}

// 3. Modal Xem Chi Tiết
async function viewHistoryDetail(id) {
    const modal = document.getElementById("detail-modal");
    try {
        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) throw new Error("Không thể tải chi tiết bản ghi");
        const data = await res.json();

        document.getElementById("modal-title").innerText = `Chi Tiết Bản Ghi Phân Tích #${data.id} (${data.task_type.toUpperCase()})`;
        document.getElementById("modal-subtitle").innerText = `Thời gian tạo: ${data.created_at} • Tốc độ: ${data.inference_time_ms} ms • Vật thể: ${data.total_objects}`;
        document.getElementById("modal-orig-img").src = data.original_image_url;
        document.getElementById("modal-res-img").src = data.result_image_url;

        const detList = document.getElementById("modal-detections-list");
        if (data.detections.length === 0) {
            detList.innerHTML = `<p class="col-span-full text-xs text-slate-500 py-2">Không phát hiện vật thể nào.</p>`;
        } else {
            detList.innerHTML = data.detections.map(d => `
                <div class="glass-card rounded-lg p-2 border border-slate-700/60 text-xs flex justify-between items-center">
                    <span class="font-bold text-slate-200 capitalize">${d.class_name}</span>
                    <span class="text-blue-400 font-mono text-[11px]">${Math.round(d.confidence * 100)}%</span>
                </div>
            `).join("");
        }

        modal.classList.remove("hidden");
        setTimeout(() => modal.classList.remove("opacity-0"), 10);
    } catch (err) {
        showToast("Lỗi mở chi tiết: " + err.message, "error");
    }
}

function closeDetailModal() {
    const modal = document.getElementById("detail-modal");
    if (modal) {
        modal.classList.add("opacity-0");
        setTimeout(() => modal.classList.add("hidden"), 300);
    }
}

// 4. Xóa Bản Ghi Lịch Sử
async function deleteHistoryRecord(id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa bản ghi #${id} và toàn bộ ảnh kết quả liên quan không?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Xóa không thành công");
        showToast(`Đã xóa bản ghi #${id} thành công!`, "success");
        refreshHistoryData();
    } catch (err) {
        showToast("Lỗi xóa bản ghi: " + err.message, "error");
    }
}
