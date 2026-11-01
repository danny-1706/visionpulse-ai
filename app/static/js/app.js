// Global Utilities, Dark/Light Mode, Queue Monitor & Modals

document.addEventListener("DOMContentLoaded", () => {
    // Khởi tạo icons của Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Khởi tạo Theme từ LocalStorage
    initTheme();

    // Khởi chạy monitor hàng đợi thời gian thực
    startQueueMonitor();
});

// Giám sát trạng thái hàng đợi và tải hệ thống
function startQueueMonitor() {
    updateQueueStatus();
    setInterval(updateQueueStatus, 3000); // Cập nhật mỗi 3 giây
}

async function updateQueueStatus() {
    const pill = document.getElementById("queue-status-pill");
    const indicator = document.getElementById("queue-indicator");
    const text = document.getElementById("queue-text");
    if (!pill || !text) return;

    try {
        const res = await fetch("/api/inference/queue-status");
        if (!res.ok) return;
        const data = await res.json();

        pill.classList.remove("hidden");
        if (data.waiting_tasks > 0) {
            indicator.className = "w-2 h-2 rounded-full bg-amber-400 animate-ping";
            text.innerText = `⏳ Hàng đợi: ${data.waiting_tasks} chờ (${data.active_tasks}/${data.max_concurrent_slots} bận)`;
            pill.className = "hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-card border border-amber-500/40 text-amber-300";
        } else {
            indicator.className = "w-2 h-2 rounded-full bg-emerald-500";
            text.innerText = `🟢 Sẵn sàng (${data.active_tasks}/${data.max_concurrent_slots} slot)`;
            pill.className = "hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-card border border-slate-700/60 text-slate-300";
        }
    } catch (e) {
        // im lặng nếu mất mạng tạm thời
    }
}

// Chuyển đổi Theme Sáng / Tối
function initTheme() {
    const savedTheme = localStorage.getItem("vp_theme") || "dark";
    applyTheme(savedTheme);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("vp_theme", nextTheme);
}

function applyTheme(theme) {
    const icon = document.getElementById("theme-icon");
    if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        if (icon) {
            icon.setAttribute("data-lucide", "sun");
            icon.classList.remove("text-slate-700");
            icon.classList.add("text-amber-400");
        }
    } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        if (icon) {
            icon.setAttribute("data-lucide", "moon");
            icon.classList.remove("text-amber-400");
            icon.classList.add("text-slate-700");
        }
    }
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Modal Hướng Dẫn Sử Dụng
function toggleGuideModal() {
    const modal = document.getElementById("guide-modal");
    if (!modal) return;
    if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0");
            modal.querySelector(".glass-panel").classList.remove("scale-95");
            modal.querySelector(".glass-panel").classList.add("scale-100");
        }, 10);
    } else {
        modal.classList.add("opacity-0");
        modal.querySelector(".glass-panel").classList.remove("scale-100");
        modal.querySelector(".glass-panel").classList.add("scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 300);
    }
}

// Thông báo Toast Notification
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold transform transition-all duration-300 opacity-0 translate-y-2`;

    let iconName = "info";
    if (type === "success") {
        toast.classList.add("bg-emerald-950/90", "border-emerald-600/50", "text-emerald-200");
        iconName = "check-circle-2";
    } else if (type === "error") {
        toast.classList.add("bg-rose-950/90", "border-rose-600/50", "text-rose-200");
        iconName = "alert-circle";
    } else {
        toast.classList.add("bg-slate-900/90", "border-blue-600/50", "text-blue-200");
    }

    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove("opacity-0", "translate-y-2");
    }, 10);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
