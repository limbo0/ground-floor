const OPTIONS = [
    { label: "To think", icon: "◑" },
    { label: "Curiosity", icon: "🔍" },
    { label: "Inspiration", icon: "💡" },
    { label: "Avoiding work", icon: "🕐" },
    { label: "Validation", icon: "♡" },
    { label: "Loneliness", icon: "👤" },
    { label: "Habit", icon: "↻" },
    { label: "Calm", icon: "🌿" }
];

function saveEntry(reason, callback) {
    chrome.storage.local.get(["gf_entries"], (result) => {
        const entries = result.gf_entries || [];
        entries.push({
            reason,
            timestamp: new Date().toISOString(),
            hour: new Date().getHours(),
            day: new Date().getDay()
        });
        chrome.storage.local.set({ gf_entries: entries }, callback);
    });
}

function closeOverlay(overlay) {
    overlay.classList.add("gfo-exit");
    setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = "";
    }, 200);
}

function createModal() {
    if (document.getElementById("gfo-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "gfo-overlay";

    const modal = document.createElement("div");
    modal.id = "gfo-modal";

    const optionsHTML = OPTIONS.map(opt =>
        `<button type="button" class="gfo-option">
      <span class="gfo-icon">${opt.icon}</span>
      <span class="gfo-label">${opt.label}</span>
    </button>`
    ).join("");

    modal.innerHTML = `
    <button id="gfo-close" aria-label="Close">&#x2715;</button>
    <div id="gfo-wave">
      <svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" width="40" height="27">
        <path d="M4 22 Q10 10 16 22 Q22 34 28 22 Q34 10 40 22 Q44 28 48 22"
              fill="none" stroke="#555" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M0 16 Q6 4 12 16 Q18 28 24 16 Q30 4 36 16 Q42 28 48 16"
              fill="none" stroke="#888" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>
      </svg>
    </div>
    <div id="gfo-brand">GROUND FLOOR</div>
    <div id="gfo-title">Why are you opening<br>Substack right now?</div>
    <div id="gfo-options">${optionsHTML}</div>
    <div id="gfo-footer">One tap. No judgment.</div>
    <div id="gfo-patterns-link">
      <button id="gfo-open-dashboard">View your patterns →</button>
    </div>
  `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    // Option buttons
    modal.querySelectorAll(".gfo-option").forEach(button => {
        button.addEventListener("click", () => {
            const reason = button.querySelector(".gfo-label").innerText.trim();
            saveEntry(reason, () => closeOverlay(overlay));
        });
    });

    // Close button
    document.getElementById("gfo-close").addEventListener("click", () => {
        closeOverlay(overlay);
    });

    // View patterns button
    document.getElementById("gfo-open-dashboard").addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openDashboard" });
    });

    // Click outside
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeOverlay(overlay);
    });
}

if (!sessionStorage.getItem("gf_shown")) {
    sessionStorage.setItem("gf_shown", "1");

    if (document.readyState === "complete") {
        // load already fired — run directly
        setTimeout(createModal, 1000);
    } else {
        // load hasn't fired yet — wait for it
        window.addEventListener("load", () => setTimeout(createModal, 1000));
    }
}


