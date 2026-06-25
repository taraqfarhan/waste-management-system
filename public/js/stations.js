/* ═══════════════════════════════════════════════════════
   stations.js — Rendering, modals, complaint form, history chart
   ═══════════════════════════════════════════════════════ */

let stationsData = [];
let historyCharts = {};

// ── Theme-aware chart colors ──────────────────────────
function isLightMode() {
  return document.body.classList.contains("light-mode");
}
function getChartBg() {
  return isLightMode() ? "rgba(255,255,255,0.97)" : "rgba(13,43,15,0.97)";
}
function getChartText() {
  return isLightMode() ? "#0d2b0f" : "#c8e6c9";
}
function getChartMuted() {
  return isLightMode() ? "rgba(30,80,34,0.60)" : "rgba(184,230,188,0.55)";
}
function getChartGrid() {
  return isLightMode() ? "rgba(45,122,53,0.10)" : "rgba(76,175,90,0.08)";
}

async function loadStations() {
  const res = await fetch("/api/auth/me");
  const { user } = await res.json();
  window._currentUser = user;

  const r = await fetch("/data/stations.json");
  if (!r.ok) throw new Error("Could not load stations.json");
  const { stations } = await r.json();
  return stations;
}

function renderCards(stations) {
  const grid = document.getElementById("stationsGrid");
  grid.innerHTML = "";
  stations.forEach((st, i) => {
    const card = document.createElement("div");
    card.className = "sts-card";
    card.setAttribute("aria-label", `Open details for ${st.name}`);
    card.onclick = () => openModal(i);
    card.innerHTML = `
      <div class="sts-card-img-wrap">
        <img class="sts-card-img" src="${st.image}" alt="${st.name}"
          onerror="this.parentElement.innerHTML='<div class=\\'sts-card-img-placeholder\\'>🏭</div>'">
      </div>
      <div class="sts-card-body">
        <div class="sts-card-name">${st.name}</div>
        <div class="sts-card-loc">📍 ${st.location}</div>
        <div class="sts-card-badge">Clearance: ${st.clearance_time}</div>
      </div>`;
    grid.appendChild(card);
  });
}

function renderModals(stations) {
  const container = document.getElementById("modalsContainer");
  container.innerHTML = "";

  stations.forEach((st, i) => {
    // ── Detail modal ──
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = `overlay-${i}`;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal(i);
    };

    const contactBtn = st.contact
      ? `<a class="contact-btn" href="tel:${st.contact}">📞 Contact &nbsp;<span class="contact-number">${st.contact}</span></a>`
      : `<button class="contact-btn" disabled style="opacity:.4;cursor:not-allowed">📞 No Contact Available</button>`;

    overlay.innerHTML = `
      <div class="popup" role="dialog" aria-modal="true">
        <button class="close-btn" onclick="closeModal(${i})">✕</button>
        <img class="popup-img" src="${st.image}" alt="${st.name}" onerror="this.style.display='none'">
        <div class="popup-body">
          <div class="popup-name">${st.name}</div>
          <div class="popup-meta">📍 ${st.location}</div>
          <div class="popup-meta">🏷 ${st.ward || ""}  &nbsp;|&nbsp;  ⚖️ ${st.capacity_tons || "–"} tons/day</div>
          <div class="popup-divider"></div>
          <div class="fill-wrap">
            <div class="fill-lbl"><span>Fill Level</span><span id="pct-${i}">–</span></div>
            <div class="fill-track"><div class="fill-fill" id="bar-${i}" style="width:0%"></div></div>
          </div>
          <div class="info-grid">
            <div class="info-row"><span class="info-label">Clearance Time</span><span class="info-val">${st.clearance_time}</span></div>
            <div class="info-row"><span class="info-label">Current Time</span><span class="info-val" id="ct-${i}">–</span></div>
            <div class="info-row"><span class="info-label">Next Clearance In</span><span class="info-val" id="nc-${i}">–</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="info-val" id="st-${i}">–</span></div>
          </div>
          <div class="action-btns">
            ${contactBtn}
            <button class="history-btn" onclick="openHistory(${i})">📊 View History</button>
            <button class="complaint-btn" onclick="openComplaint(${i})">⚠️ Submit Complaint</button>
          </div>
        </div>
      </div>`;
    container.appendChild(overlay);

    // ── History modal ──
    const hOverlay = document.createElement("div");
    hOverlay.className = "overlay";
    hOverlay.id = `history-overlay-${i}`;
    hOverlay.onclick = (e) => {
      if (e.target === hOverlay) closeHistory(i);
    };
    hOverlay.innerHTML = `
      <div class="popup history-popup" role="dialog" aria-modal="true">
        <button class="close-btn" onclick="closeHistory(${i})">✕</button>
        <div class="history-header">
          <div class="history-title">📊 Fill History</div>
          <div class="history-subtitle">${st.name}</div>
        </div>
        <div class="history-body">
          <div class="history-controls">
            <button class="range-btn active" data-days="7"  onclick="loadHistory(${i},'${st.id}',7,this)">7 days</button>
            <button class="range-btn"        data-days="14" onclick="loadHistory(${i},'${st.id}',14,this)">14 days</button>
            <button class="range-btn"        data-days="30" onclick="loadHistory(${i},'${st.id}',30,this)">30 days</button>
          </div>
          <div style="position:relative;height:220px"><canvas id="hchart-${i}"></canvas></div>
          <div id="hchart-empty-${i}" style="display:none;text-align:center;padding:40px;font-size:0.85rem" class="my-complaints-empty">No data available yet.</div>
        </div>
      </div>`;
    container.appendChild(hOverlay);

    // ── Complaint modal ──
    const cOverlay = document.createElement("div");
    cOverlay.className = "overlay";
    cOverlay.id = `complaint-overlay-${i}`;
    cOverlay.onclick = (e) => {
      if (e.target === cOverlay) closeComplaint(i);
    };
    cOverlay.innerHTML = `
      <div class="popup complaint-popup" role="dialog" aria-modal="true">
        <button class="close-btn" onclick="closeComplaint(${i})">✕</button>
        <div class="complaint-header">
          <div class="complaint-icon">⚠️</div>
          <div class="complaint-title">Submit a Complaint</div>
          <div class="complaint-subtitle">${st.name}</div>
        </div>
        <div class="complaint-body">
          <div class="complaint-field">
            <label class="field-label">Your Name <span class="required">*</span></label>
            <input class="field-input" id="c-name-${i}" type="text" placeholder="Enter your name" autocomplete="name">
          </div>
          <div class="complaint-field">
            <label class="field-label">Phone Number</label>
            <input class="field-input" id="c-phone-${i}" type="tel" placeholder="+880 ...">
          </div>
          <div class="complaint-field">
            <label class="field-label">Complaint Type <span class="required">*</span></label>
            <select class="field-input field-select" id="c-type-${i}">
              <option value="" disabled selected>Select a category</option>
              <option value="overflow">Bin Overflow / Not Cleared</option>
              <option value="odor">Bad Odor / Sanitation</option>
              <option value="damage">Damaged Infrastructure</option>
              <option value="illegal">Illegal Dumping</option>
              <option value="staff">Staff Conduct</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="complaint-field">
            <label class="field-label">Description <span class="required">*</span></label>
            <textarea class="field-input field-textarea" id="c-msg-${i}" placeholder="Describe the issue…" rows="4"></textarea>
          </div>
          <div id="c-error-${i}" class="complaint-error" style="display:none"></div>
          <div id="c-success-${i}" class="complaint-success" style="display:none">✅ Complaint submitted successfully!</div>
          <button class="submit-btn" id="c-submit-${i}" onclick="submitComplaint(${i},'${st.id}','${escAttr(st.name)}')">Submit Complaint</button>
        </div>
      </div>`;
    container.appendChild(cOverlay);
  });
}

// ── Escape for inline attrs ───────────────────────────
function escAttr(s) {
  return s.replace(/'/g, "\\'");
}

// ── Modal controls ────────────────────────────────────
function openModal(i) {
  document.getElementById(`overlay-${i}`).classList.add("open");
}
function closeModal(i) {
  document.getElementById(`overlay-${i}`).classList.remove("open");
}

async function openHistory(i) {
  closeModal(i);
  document.getElementById(`history-overlay-${i}`).classList.add("open");
  const st = stationsData[i];
  await loadHistory(
    i,
    st.id,
    7,
    document.querySelector(`#history-overlay-${i} .range-btn`),
  );
}
function closeHistory(i) {
  document.getElementById(`history-overlay-${i}`).classList.remove("open");
}

function openComplaint(i) {
  closeModal(i);
  // Pre-fill name if logged in
  if (window._currentUser) {
    const nameEl = document.getElementById(`c-name-${i}`);
    if (nameEl && !nameEl.value) nameEl.value = window._currentUser.name;
  }
  document.getElementById(`complaint-overlay-${i}`).classList.add("open");
}
function closeComplaint(i) {
  document.getElementById(`complaint-overlay-${i}`).classList.remove("open");
}

// ── History chart ─────────────────────────────────────
async function loadHistory(i, stationId, days, btn) {
  // Update active button
  document
    .querySelectorAll(`#history-overlay-${i} .range-btn`)
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const canvasEl = document.getElementById(`hchart-${i}`);
  const emptyEl = document.getElementById(`hchart-empty-${i}`);

  try {
    const r = await fetch(`/api/fill-history/${stationId}?days=${days}`);
    const data = await r.json();

    if (!data.length) {
      canvasEl.style.display = "none";
      emptyEl.style.display = "block";
      return;
    }
    canvasEl.style.display = "block";
    emptyEl.style.display = "none";

    const labels = data.map((d) => (d.hour ? d.hour.slice(5, 16) : d.day));
    const values = data.map((d) => d.avg_fill);

    if (historyCharts[i]) historyCharts[i].destroy();

    historyCharts[i] = new Chart(canvasEl, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Avg Fill %",
            data: values,
            borderColor: "#4caf5a",
            backgroundColor: "rgba(76,175,90,0.12)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: "#4caf5a",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: getChartBg(),
            titleColor: getChartText(),
            bodyColor: "#4caf5a",
            callbacks: { label: (ctx) => ` ${ctx.parsed.y}% fill` },
          },
        },
        scales: {
          x: {
            ticks: {
              color: getChartMuted(),
              maxTicksLimit: 8,
              font: { size: 10 },
            },
            grid: { color: getChartGrid() },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: getChartMuted(),
              font: { size: 10 },
              callback: (v) => v + "%",
            },
            grid: { color: getChartGrid() },
          },
        },
      },
    });
  } catch (e) {
    console.error("History load failed:", e);
  }
}

// ── Submit complaint ──────────────────────────────────
async function submitComplaint(i, stationId, stationName) {
  const name = document.getElementById(`c-name-${i}`).value.trim();
  const phone = document.getElementById(`c-phone-${i}`).value.trim();
  const type = document.getElementById(`c-type-${i}`).value;
  const msg = document.getElementById(`c-msg-${i}`).value.trim();
  const errEl = document.getElementById(`c-error-${i}`);
  const sucEl = document.getElementById(`c-success-${i}`);
  const btn = document.getElementById(`c-submit-${i}`);

  errEl.style.display = "none";
  sucEl.style.display = "none";

  if (!name) return showErr(errEl, "Please enter your name.");
  if (!type) return showErr(errEl, "Please select a complaint category.");
  if (msg.length < 10)
    return showErr(errEl, "Description must be at least 10 characters.");

  btn.disabled = true;
  btn.textContent = "Submitting…";

  try {
    const r = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        station_id: stationId,
        station_name: stationName,
        user_name: name,
        user_phone: phone,
        type,
        description: msg,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Failed");
    sucEl.style.display = "block";
    btn.textContent = "Submitted ✓";
    setTimeout(() => closeComplaint(i), 2500);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Submit Complaint";
    showErr(errEl, e.message);
  }
}

function showErr(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

// ── Live fill timers ──────────────────────────────────
function parseClearanceTime(ts) {
  const [time, period] = ts.trim().toLowerCase().split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d;
}
function fmtTime(d) {
  let h = d.getHours(),
    m = d.getMinutes(),
    s = d.getSeconds();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ap}`;
}
function msToHMS(ms) {
  if (ms < 0) ms = 0;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function tickAll(stations) {
  const now = new Date();
  stations.forEach((st, i) => {
    const ctEl = document.getElementById(`ct-${i}`);
    const ncEl = document.getElementById(`nc-${i}`);
    const stEl = document.getElementById(`st-${i}`);
    const barEl = document.getElementById(`bar-${i}`);
    const pctEl = document.getElementById(`pct-${i}`);
    if (!ctEl) return;
    ctEl.textContent = fmtTime(now);
    let clr = parseClearanceTime(st.clearance_time);
    if (clr < now) clr.setDate(clr.getDate() + 1);
    const diff = clr - now;
    ncEl.textContent = msToHMS(diff);
    const fp = Math.min(
      100,
      Math.max(0, Math.round(((86400000 - diff) / 86400000) * 100)),
    );
    pctEl.textContent = fp + "%";
    barEl.style.width = fp + "%";
    barEl.className =
      "fill-fill" + (fp > 75 ? " fill-high" : fp > 45 ? " fill-mid" : "");
    const label =
      fp > 75
        ? "High — Needs Clearance"
        : fp > 45
          ? "Moderate"
          : "Low — Recently Cleared";
    const cls = fp > 75 ? "s-hi" : fp > 45 ? "s-mi" : "s-lo";
    stEl.innerHTML = `<span class="status-badge ${cls}">${fp}% — ${label}</span>`;
  });
}

// ── Init ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    stationsData = await loadStations();
    renderCards(stationsData);
    renderModals(stationsData);
    tickAll(stationsData);
    setInterval(() => tickAll(stationsData), 1000);
  } catch (err) {
    console.error(err);
    document.getElementById("stationsGrid").innerHTML =
      '<p style="color:#ef5350;padding:20px">⚠ Could not load station data.</p>';
  }
});
