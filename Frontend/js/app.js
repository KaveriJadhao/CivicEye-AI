// CivicEye Nagpur - Core Application Controller
let currentReports = [];
let currentFilter = {
  category: "All",
  status: "All",
  urgency: "All",
  ward: "All",
  search: "",
  sortBy: "newest",
};

let currentTab = "feed"; // 'feed', 'file-report', 'track-ticket', 'leaderboard', 'notices', 'admin'
let userKarma = parseInt(localStorage.getItem("civicKarma") || "140");
let userIdentifier = localStorage.getItem("civicUserToken") || "citizen_" + Math.random().toString(36).substring(2, 8);
localStorage.setItem("civicUserToken", userIdentifier);

let categoryChartInstance = null;
let currentActiveReport = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  updateKarmaDisplay();
  setupNavListeners();
  setupFilterListeners();
  setupReportWizardListeners();
  window.CivicMap.initMainMap();
  loadReports();
});

function updateKarmaDisplay() {
  const el = document.getElementById("userKarmaBadge");
  if (el) el.innerText = `${userKarma} Karma`;
}

function addKarma(amount) {
  userKarma += amount;
  localStorage.setItem("civicKarma", userKarma.toString());
  updateKarmaDisplay();
  if (window.confetti) {
    window.confetti({ particleCount: 45, spread: 65, origin: { y: 0.8 } });
  }
}

// Navigation Tabs
function setupNavListeners() {
  const navBtns = document.querySelectorAll(".nav-tab-btn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  // Top Ward Selector dropdown
  const topWardFilter = document.getElementById("topWardFilter");
  if (topWardFilter) {
    topWardFilter.addEventListener("change", (e) => {
      currentFilter.ward = e.target.value;
      loadReports();
    });
  }

  // Quick track button in hero banner
  const heroTrackBtn = document.getElementById("heroTrackBtn");
  const heroTrackInput = document.getElementById("heroTrackInput");
  if (heroTrackBtn && heroTrackInput) {
    heroTrackBtn.addEventListener("click", () => {
      const val = heroTrackInput.value.trim();
      if (val) {
        trackTicketDirectly(val);
      }
    });
    heroTrackInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const val = heroTrackInput.value.trim();
        if (val) trackTicketDirectly(val);
      }
    });
  }
}

function switchTab(tab) {
  currentTab = tab;

  // Update Nav links
  const navBtns = document.querySelectorAll(".nav-tab-btn");
  navBtns.forEach((b) => {
    if (b.getAttribute("data-tab") === tab) {
      b.classList.add("bg-blue-800", "text-white");
      b.classList.remove("text-blue-100", "hover:bg-blue-900/60");
    } else {
      b.classList.remove("bg-blue-800", "text-white");
      b.classList.add("text-blue-100", "hover:bg-blue-900/60");
    }
  });

  // Hide all sections
  document.querySelectorAll(".tab-section").forEach((sec) => sec.classList.add("hidden"));

  // Show active tab
  const activeSec = document.getElementById(`tabSection_${tab}`);
  if (activeSec) activeSec.classList.remove("hidden");

  if (tab === "feed") {
    loadReports();
    setTimeout(() => window.CivicMap.initMainMap(), 100);
  } else if (tab === "admin") {
    loadAdminDashboard();
  } else if (tab === "file-report") {
    setTimeout(() => window.CivicMap.initReportPickerMap(), 200);
  }
}

// Filter listeners
function setupFilterListeners() {
  const chips = document.querySelectorAll(".category-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("chip-active", "bg-blue-600", "text-white"));
      chip.classList.add("chip-active", "bg-blue-600", "text-white");
      currentFilter.category = chip.getAttribute("data-category") || "All";
      loadReports();
    });
  });

  const statusFilter = document.getElementById("statusFilter");
  const sortByFilter = document.getElementById("sortByFilter");
  const searchInput = document.getElementById("searchInput");

  if (statusFilter) statusFilter.addEventListener("change", (e) => { currentFilter.status = e.target.value; loadReports(); });
  if (sortByFilter) sortByFilter.addEventListener("change", (e) => { currentFilter.sortBy = e.target.value; loadReports(); });
  
  if (searchInput) {
    let debounce;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { currentFilter.search = e.target.value.trim(); loadReports(); }, 300);
    });
  }
}

// Load reports
async function loadReports() {
  try {
    const feedContainer = document.getElementById("reportsFeed");
    if (feedContainer) {
      feedContainer.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-3xl mb-3"></i>
          <p class="text-slate-500 font-semibold text-xs">Loading municipal grievance feed...</p>
        </div>
      `;
    }

    const reports = await window.CivicAPI.getReports(currentFilter);
    currentReports = reports;

    renderFeed(reports);
    window.CivicMap.updateMapMarkers(reports);
  } catch (err) {
    console.error("Load reports error:", err);
  }
}

// Render feed cards
function renderFeed(reports) {
  const container = document.getElementById("reportsFeed");
  const countBadge = document.getElementById("activeReportCount");
  if (countBadge) countBadge.innerText = `${reports.length} Registered Issues`;

  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-8 rounded-2xl text-center border border-slate-200">
        <i class="fa-solid fa-clipboard-check text-slate-300 text-5xl mb-3"></i>
        <h4 class="text-base font-bold text-slate-700">No Civic Issues Found</h4>
        <p class="text-slate-500 text-xs mt-1">No active reports match the selected filters for this ward.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = reports
    .map((rep) => {
      const urgencyClass =
        rep.urgencyLevel === "CRITICAL"
          ? "bg-red-50 text-red-700 border-red-200"
          : rep.urgencyLevel === "HIGH"
          ? "bg-orange-50 text-orange-700 border-orange-200"
          : rep.urgencyLevel === "MEDIUM"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";

      const statusBadgeClass =
        rep.status === "RESOLVED"
          ? "bg-emerald-600 text-white"
          : rep.status === "IN_PROGRESS"
          ? "bg-blue-600 text-white"
          : rep.status === "ASSIGNED"
          ? "bg-purple-600 text-white"
          : "bg-slate-200 text-slate-800";

      const isUpvoted = rep.upvotedBy && rep.upvotedBy.includes(userIdentifier);
      const timeAgo = getTimeAgo(new Date(rep.createdAt));

      return `
      <div class="gov-card overflow-hidden flex flex-col justify-between">
        <div>
          <!-- Thumbnail & Badges -->
          <div class="relative h-44 w-full bg-slate-100 overflow-hidden cursor-pointer" onclick="CivicApp.openDetailModal('${rep._id || rep.id}')">
            <img src="${rep.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'}" 
                 class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                 alt="${rep.title}"
                 onerror="this.src='https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'"/>
            
            <div class="absolute top-2.5 left-2.5 flex gap-1.5">
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-md ${statusBadgeClass} shadow">
                ${rep.status.replace("_", " ")}
              </span>
              ${
                rep.isDuplicate
                  ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow">
                      Merged
                    </span>`
                  : ""
              }
            </div>

            <div class="absolute top-2.5 right-2.5">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-md border ${urgencyClass} bg-white/95 shadow-sm">
                ${rep.urgencyLevel}
              </span>
            </div>

            <div class="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur rounded-lg px-2.5 py-1 text-white text-[11px] flex justify-between items-center">
              <span>🏛️ ${rep.assignedDepartment || "Municipal Corp"}</span>
              <span>⏱️ SLA: ${rep.estimatedSlaHours || 48}h</span>
            </div>
          </div>

          <!-- Body -->
          <div class="p-4">
            <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono-code font-semibold">
              <span>${rep.ticketId}</span>
              <span>${timeAgo}</span>
            </div>

            <h3 class="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-1 hover:text-blue-600 cursor-pointer" onclick="CivicApp.openDetailModal('${rep._id || rep.id}')">
              ${rep.title}
            </h3>

            <p class="text-xs text-slate-600 line-clamp-2 mb-2.5">
              ${rep.description}
            </p>

            <div class="flex items-center text-xs text-slate-500 font-medium mb-2.5">
              <i class="fa-solid fa-location-dot text-red-500 mr-1.5 shrink-0"></i>
              <span class="truncate">${rep.address || rep.wardNumber || "Nagpur Ward Area"}</span>
            </div>

            <!-- Severity meter -->
            <div class="bg-slate-50 rounded-lg p-2 border border-slate-100 mb-2">
              <div class="flex justify-between items-center text-[11px] font-semibold mb-1">
                <span class="text-slate-600"><i class="fa-solid fa-brain text-purple-600 mr-1"></i> AI Hazard Rating</span>
                <span class="text-slate-900 font-bold">${rep.severityScore ? rep.severityScore.toFixed(1) : "5.0"}/10</span>
              </div>
              <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div class="h-full rounded-full ${
                  rep.severityScore > 7.5 ? "bg-red-500" : rep.severityScore > 5 ? "bg-orange-500" : "bg-emerald-500"
                }" style="width: ${(rep.severityScore || 5) * 10}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button onclick="CivicApp.toggleUpvote('${rep._id || rep.id}')" 
                  class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    isUpvoted
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }">
            <i class="fa-solid fa-thumbs-up ${isUpvoted ? "text-white" : "text-blue-600"}"></i>
            <span>${rep.upvotes || 1} Support</span>
          </button>

          <button onclick="CivicApp.openDetailModal('${rep._id || rep.id}')" 
                  class="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1">
            Track Ticket <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

// Toggle Upvote
async function toggleUpvote(reportId) {
  try {
    const res = await window.CivicAPI.upvoteReport(reportId, userIdentifier);
    if (res.success) {
      if (res.upvoted) addKarma(10);
      loadReports();
    }
  } catch (err) {
    console.error("Upvote error:", err);
  }
}

// Report Wizard
function setupReportWizardListeners() {
  const fileInput = document.getElementById("wizardPhotoInput");
  if (fileInput) fileInput.addEventListener("change", handleWizardImageScan);

  const voiceBtn = document.getElementById("wizardVoiceBtn");
  if (voiceBtn) voiceBtn.addEventListener("click", handleVoiceRecording);

  const gpsBtn = document.getElementById("wizardGpsBtn");
  if (gpsBtn) gpsBtn.addEventListener("click", handleGetCurrentGPS);

  const form = document.getElementById("wizardReportForm");
  if (form) form.addEventListener("submit", handleReportSubmit);
}

// Handle Image Scan
async function handleWizardImageScan(e) {
  const file = e.target.files[0];
  if (!file) return;

  const previewImg = document.getElementById("wizardImgPreview");
  const previewBox = document.getElementById("wizardImgBox");
  const uploadPlaceholder = document.getElementById("wizardUploadPlaceholder");
  const scanBox = document.getElementById("wizardAiScanBox");

  if (previewImg && previewBox) {
    previewImg.src = URL.createObjectURL(file);
    previewBox.classList.remove("hidden");
    if (uploadPlaceholder) uploadPlaceholder.classList.add("hidden");
  }

  if (scanBox) {
    scanBox.classList.remove("hidden");
    scanBox.innerHTML = `
      <div class="flex items-center gap-2 text-blue-700 font-semibold text-xs py-2">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>AI Vision Engine is analyzing hazard classification & severity...</span>
      </div>
    `;
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("notes", document.getElementById("wizardNotes") ? document.getElementById("wizardNotes").value : "");
  formData.append("latitude", document.getElementById("reportLat") ? document.getElementById("reportLat").value : "");
  formData.append("longitude", document.getElementById("reportLng") ? document.getElementById("reportLng").value : "");

  try {
    const ai = await window.CivicAPI.analyzeImagePreview(formData);

    const titleIn = document.getElementById("wizardTitle");
    const catSelect = document.getElementById("wizardCategory");

    if (titleIn && !titleIn.value) titleIn.value = ai.titleSuggestion;
    if (catSelect && ai.detectedCategory) catSelect.value = ai.detectedCategory;

    scanBox.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-blue-900 flex items-center gap-1.5">
            <i class="fa-solid fa-shield-check text-blue-600"></i> AI Vision Verified (${(ai.confidence * 100).toFixed(0)}% Match)
          </span>
          <span class="text-[11px] font-bold px-2 py-0.5 rounded ${
            ai.urgencyLevel === "CRITICAL" ? "bg-red-600 text-white" : "bg-blue-700 text-white"
          }">
            ${ai.urgencyLevel} Urgency
          </span>
        </div>
        <p class="text-xs text-slate-700 mb-1.5 font-medium">${ai.descriptionSummary}</p>
        <div class="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-700">
          <span class="bg-white px-2 py-0.5 rounded border border-blue-100">🏛️ ${ai.recommendedDepartment}</span>
          <span class="bg-white px-2 py-0.5 rounded border border-blue-100">⏱️ SLA: ${ai.estimatedSlaHours}h</span>
          ${
            ai.potentialDuplicateDetected
              ? `<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 font-bold">⚠️ Similar active report nearby</span>`
              : ""
          }
        </div>
      </div>
    `;
  } catch (err) {
    scanBox.innerHTML = `
      <div class="text-xs text-slate-600 flex items-center gap-1.5 py-1 font-medium">
        <i class="fa-solid fa-check text-emerald-600"></i> Photo attached. Ready for submission.
      </div>
    `;
  }
}

// Voice recording
function handleVoiceRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const notesField = document.getElementById("wizardNotes");
  const btn = document.getElementById("wizardVoiceBtn");

  if (!SpeechRecognition) {
    alert("Speech recognition is not supported on this browser. Please type your notes.");
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "en-IN";
  btn.innerHTML = `<i class="fa-solid fa-microphone-lines text-red-500 fa-pulse"></i> Listening...`;

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    if (notesField) notesField.value = notesField.value ? notesField.value + " " + text : text;
  };
  rec.onerror = () => resetBtn();
  rec.onend = () => resetBtn();
  rec.start();

  function resetBtn() {
    btn.innerHTML = `<i class="fa-solid fa-microphone text-blue-600"></i> Speak Notes`;
  }
}

// Get GPS
function handleGetCurrentGPS() {
  const btn = document.getElementById("wizardGpsBtn");
  if (navigator.geolocation) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.CivicMap.setReportCoords(pos.coords.latitude, pos.coords.longitude);
        if (window.reportPickerMap) {
          window.reportPickerMap.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
        btn.innerHTML = `<i class="fa-solid fa-check"></i> GPS Pinned`;
        setTimeout(() => { btn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Use GPS`; }, 2000);
      },
      () => { btn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Use GPS`; }
    );
  }
}

// Submit Report
async function handleReportSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("wizardSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting to Municipal Desk...`;

  try {
    const formData = new FormData(e.target);
    const rep = await window.CivicAPI.createReport(formData);

    addKarma(50);
    showAcknowledgementSlip(rep);
    e.target.reset();
    document.getElementById("wizardImgBox").classList.add("hidden");
    document.getElementById("wizardUploadPlaceholder").classList.remove("hidden");
    document.getElementById("wizardAiScanBox").classList.add("hidden");
  } catch (err) {
    alert("Submission error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i> Register Official Complaint`;
  }
}

// Show Acknowledgement Slip Modal
function showAcknowledgementSlip(rep) {
  const modal = document.getElementById("receiptModal");
  const box = document.getElementById("receiptContent");
  if (!modal || !box) return;

  box.innerHTML = `
    <div id="printableReceipt" class="p-6 font-sans">
      <div class="text-center border-b-2 border-slate-900 pb-4 mb-4">
        <h2 class="text-lg font-extrabold uppercase tracking-wide text-slate-900">Nagpur Municipal Corporation (NMC)</h2>
        <p class="text-xs text-slate-500 font-semibold">Citizen Grievance Redressal & Smart City Operations</p>
        <span class="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
          ✓ Complaint Registered Successfully
        </span>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs mb-4">
        <div>
          <span class="text-slate-500 font-semibold">Grievance Ticket ID:</span>
          <p class="font-mono-code font-bold text-sm text-blue-700">${rep.ticketId}</p>
        </div>
        <div>
          <span class="text-slate-500 font-semibold">Date & Time:</span>
          <p class="font-bold text-slate-800">${new Date(rep.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <span class="text-slate-500 font-semibold">Citizen Name:</span>
          <p class="font-bold text-slate-800">${rep.reporterName || "Civic Citizen"}</p>
        </div>
        <div>
          <span class="text-slate-500 font-semibold">Ward & Zone:</span>
          <p class="font-bold text-slate-800">${rep.wardNumber || "Ward 12 - Dharampeth"}</p>
        </div>
        <div class="col-span-2">
          <span class="text-slate-500 font-semibold">Hazard Summary:</span>
          <p class="font-bold text-slate-800">${rep.title}</p>
        </div>
        <div>
          <span class="text-slate-500 font-semibold">Assigned Department:</span>
          <p class="font-bold text-blue-700">${rep.assignedDepartment}</p>
        </div>
        <div>
          <span class="text-slate-500 font-semibold">Guaranteed SLA:</span>
          <p class="font-bold text-purple-700">${rep.estimatedSlaHours || 48} Hours</p>
        </div>
      </div>

      <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 mb-6">
        <p class="font-semibold mb-1">📢 Tracking & SMS Updates:</p>
        <p>You can track resolution progress at any time using your Ticket ID on this portal or via WhatsApp Municipal Bot.</p>
      </div>

      <div class="flex gap-3">
        <button onclick="window.print()" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2">
          <i class="fa-solid fa-print"></i> Print Receipt / PDF
        </button>
        <button onclick="document.getElementById('receiptModal').classList.add('hidden'); CivicApp.switchTab('feed');" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs">
          View on City Map
        </button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
}

// Track Ticket by ID (Direct Lookup)
async function trackTicketDirectly(ticketId) {
  try {
    switchTab("track-ticket");
    const resBox = document.getElementById("ticketTrackResult");
    const input = document.getElementById("trackTicketInput");
    if (input) input.value = ticketId;

    if (resBox) {
      resBox.innerHTML = `
        <div class="text-center py-8">
          <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-2xl mb-2"></i>
          <p class="text-xs text-slate-500 font-semibold">Searching municipal registry for ticket ${ticketId}...</p>
        </div>
      `;
    }

    const rep = await window.CivicAPI.trackTicket(ticketId);
    renderTrackResult(rep);
  } catch (err) {
    const resBox = document.getElementById("ticketTrackResult");
    if (resBox) {
      resBox.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-xs">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 text-red-500"></i>
          <h4 class="font-bold text-sm">Ticket Not Found</h4>
          <p class="mt-1">No municipal complaint matches reference '${ticketId}'. Please verify the ticket code.</p>
        </div>
      `;
    }
  }
}

function renderTrackResult(rep) {
  const box = document.getElementById("ticketTrackResult");
  if (!box) return;

  const isResolved = rep.status === "RESOLVED";

  box.innerHTML = `
    <div class="gov-card p-6 border border-slate-200">
      
      <!-- Top Ticket Header -->
      <div class="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
        <div>
          <span class="text-xs font-mono-code font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">${rep.ticketId}</span>
          <h3 class="text-base font-bold text-slate-900 mt-1">${rep.title}</h3>
          <p class="text-xs text-slate-500">📍 ${rep.address || "Ward 12, Nagpur"}</p>
        </div>
        <div class="text-right">
          <span class="px-3 py-1 rounded-full text-xs font-bold ${
            isResolved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
          }">
            ${rep.status.replace("_", " ")}
          </span>
          <p class="text-[11px] text-slate-400 mt-1">SLA Limit: ${rep.estimatedSlaHours || 48}h</p>
        </div>
      </div>

      <!-- Officer & Department Card -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 text-xs">
        <div>
          <span class="text-slate-500 font-medium">Assigned Department:</span>
          <p class="font-bold text-slate-900">${rep.assignedDepartment}</p>
        </div>
        <div>
          <span class="text-slate-500 font-medium">Nodal Officer:</span>
          <p class="font-bold text-slate-900">${rep.assignedOfficer || "Duty Officer"}</p>
        </div>
        <div>
          <span class="text-slate-500 font-medium">Officer Contact:</span>
          <p class="font-bold text-blue-700">${rep.officerContact || "+91 712-2561234"}</p>
        </div>
      </div>

      <!-- Milestones Timeline -->
      <h4 class="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5">
        <i class="fa-solid fa-list-check text-blue-600"></i> Milestone Redressal Timeline
      </h4>

      <div class="relative pl-6 space-y-4 mb-6">
        <div class="timeline-stem"></div>
        ${(rep.timelineEvents || [])
          .map(
            (ev, i) => `
          <div class="relative flex items-start gap-3 text-xs">
            <div class="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0 z-10">
              ${i + 1}
            </div>
            <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm w-full">
              <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-slate-800">${ev.title}</span>
                <span class="text-[10px] text-slate-400">${new Date(ev.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p class="text-slate-600 mb-1">${ev.description || "Updated."}</p>
              <span class="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                ${ev.actorName} (${ev.actorRole})
              </span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="flex gap-3">
        <button onclick="CivicApp.openDetailModal('${rep._id || rep.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl">
          Open Full Interactive Modal & Comments
        </button>
      </div>

    </div>
  `;
}

// Open Detail Modal
async function openDetailModal(reportId) {
  try {
    const modal = document.getElementById("detailModal");
    const container = document.getElementById("detailModalContent");
    if (!modal || !container) return;

    modal.classList.remove("hidden");
    container.innerHTML = `
      <div class="p-12 text-center">
        <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-3xl mb-3"></i>
        <p class="text-slate-500 font-semibold text-xs">Loading grievance file...</p>
      </div>
    `;

    const rep = await window.CivicAPI.getReportById(reportId);
    currentActiveReport = rep;
    renderDetailModalContent(rep);
  } catch (err) {
    console.error("Open detail modal error:", err);
  }
}

function renderDetailModalContent(rep) {
  const container = document.getElementById("detailModalContent");
  if (!container) return;

  const isResolved = rep.status === "RESOLVED";

  container.innerHTML = `
    <div class="p-6">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono-code font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded">${rep.ticketId}</span>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${
              isResolved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
            }">
              ${rep.status.replace("_", " ")}
            </span>
          </div>
          <h2 class="text-lg font-bold text-slate-900">${rep.title}</h2>
        </div>
        <button onclick="document.getElementById('detailModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 text-xl p-1.5">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Left Column: Photos & Details -->
        <div>
          
          <!-- Before / After Photo View -->
          ${
            rep.resolutionImageUrl
              ? `
              <div class="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                <span class="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-2">
                  <i class="fa-solid fa-circle-check text-emerald-600"></i> AI Verified Before vs After Repair
                </span>
                <div class="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <span class="text-[10px] font-bold text-slate-500 uppercase">Original Damage</span>
                    <img src="${rep.imageUrl}" class="w-full h-28 object-cover rounded-lg border border-slate-200 mt-1"/>
                  </div>
                  <div>
                    <span class="text-[10px] font-bold text-emerald-700 uppercase">Repaired Surface</span>
                    <img src="${rep.resolutionImageUrl}" class="w-full h-28 object-cover rounded-lg border border-emerald-300 mt-1"/>
                  </div>
                </div>
                <p class="text-xs text-emerald-900 font-medium">${rep.resolutionNotes || "Work completed and verified by municipal engineer."}</p>
              </div>
            `
              : `
              <div class="rounded-2xl overflow-hidden bg-slate-100 mb-4 border border-slate-200">
                <img src="${rep.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800'}" class="w-full h-52 object-cover" />
              </div>
            `
          }

          <!-- Details Box -->
          <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs mb-4">
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Ward / Zone:</span>
              <span class="font-bold text-slate-800">${rep.wardNumber || "Ward 12 - Dharampeth"} (${rep.zoneName || "Zone 2"})</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Department:</span>
              <span class="font-bold text-blue-700">${rep.assignedDepartment}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Officer-in-Charge:</span>
              <span class="font-bold text-slate-800">${rep.assignedOfficer || "Desk Officer"} (${rep.officerContact || "NMC Desk"})</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Reported By:</span>
              <span class="font-bold text-slate-800">${rep.reporterName || "Civic Citizen"}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Citizen Support:</span>
              <span class="font-bold text-emerald-600">👍 ${rep.upvotes || 1} Citizen Upvotes</span>
            </div>
          </div>

          <!-- Citizen Comments Section -->
          <div class="border-t border-slate-100 pt-3">
            <h4 class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <i class="fa-solid fa-comments text-blue-600"></i> Community Discussion (${(rep.comments || []).length})
            </h4>

            <div class="space-y-2 max-h-36 overflow-y-auto mb-2 text-xs">
              ${(rep.comments && rep.comments.length > 0)
                ? rep.comments.map((c) => `
                  <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span class="font-bold text-slate-700">${c.userName}</span>
                      <span>${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-slate-600">${c.text}</p>
                  </div>
                `).join("")
                : `<p class="text-slate-400 text-xs italic">No comments yet. Be the first to share an update.</p>`
              }
            </div>

            <!-- Add Comment Form -->
            <div class="flex gap-2">
              <input id="newCommentInput" type="text" placeholder="Add update or comment..." class="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onclick="CivicApp.postComment('${rep._id || rep.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold">
                Post
              </button>
            </div>
          </div>

        </div>

        <!-- Right Column: Timeline & Actions -->
        <div>
          <h4 class="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-route text-blue-600"></i> Redressal Milestones
          </h4>

          <div class="relative pl-6 space-y-4 mb-6">
            <div class="timeline-stem"></div>
            ${(rep.timelineEvents || [])
              .map((ev, i) => `
                <div class="relative flex items-start gap-3 text-xs">
                  <div class="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0 z-10">
                    ${i + 1}
                  </div>
                  <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm w-full">
                    <div class="flex justify-between items-center mb-0.5">
                      <span class="font-bold text-slate-800">${ev.title}</span>
                      <span class="text-[10px] text-slate-400">${new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-slate-600 text-[11px] mb-1">${ev.description || "Status updated."}</p>
                    <span class="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      ${ev.actorName}
                    </span>
                  </div>
                </div>
              `).join("")}
          </div>

          <!-- Bottom Action Buttons -->
          <div class="space-y-2 border-t border-slate-100 pt-3">
            <button onclick="CivicApp.toggleUpvote('${rep._id || rep.id}')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2">
              <i class="fa-solid fa-thumbs-up text-blue-600"></i> Support Issue (+10 Karma)
            </button>
            <button onclick="CivicApp.showAcknowledgementSlip(currentActiveReport)" class="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2">
              <i class="fa-solid fa-file-pdf"></i> Download Official Acknowledgement
            </button>
          </div>

        </div>

      </div>

    </div>
  `;
}

// Post comment
async function postComment(reportId) {
  const input = document.getElementById("newCommentInput");
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  try {
    const updated = await window.CivicAPI.addComment(reportId, {
      text,
      userName: "Civic Citizen (You)",
      userRole: "CITIZEN",
    });
    currentActiveReport = updated;
    renderDetailModalContent(updated);
  } catch (err) {
    alert("Error adding comment: " + err.message);
  }
}

// Admin Dashboard
async function loadAdminDashboard() {
  try {
    const stats = await window.CivicAPI.getAdminStats();

    document.getElementById("statTotal").innerText = stats.totalReports;
    document.getElementById("statCritical").innerText = stats.highUrgencyCount;
    document.getElementById("statInProgress").innerText = stats.inProgressReports;
    document.getElementById("statResolved").innerText = stats.resolvedReports;
    document.getElementById("statAvgSLA").innerText = `${stats.averageResolutionHours}h`;

    renderCategoryChart(stats.categoryDistribution);
    renderDepartmentTable(stats.departmentWorkload);
    renderAdminDispatchTable();
  } catch (err) {
    console.error("Admin dashboard error:", err);
  }
}

function renderCategoryChart(catDist) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;

  if (categoryChartInstance) categoryChartInstance.destroy();

  const labels = Object.keys(catDist);
  const data = Object.values(catDist);

  categoryChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.map((l) => l.split("&")[0].trim()),
      datasets: [
        {
          data: data,
          backgroundColor: ["#1e3a8a", "#059669", "#d97706", "#0284c7", "#dc2626", "#7c3aed"],
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 10, family: "Plus Jakarta Sans" } } },
      },
    },
  });
}

function renderDepartmentTable(workload) {
  const container = document.getElementById("departmentWorkloadList");
  if (!container) return;

  container.innerHTML = Object.entries(workload)
    .map(([dept, data]) => {
      const percentage = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
      return `
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div class="flex justify-between items-center mb-1 text-xs">
          <span class="font-bold text-slate-800">${dept}</span>
          <span class="font-bold text-blue-700">${data.resolved}/${data.total} Closed (${percentage}%)</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-600 h-full rounded-full" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    })
    .join("");
}

async function renderAdminDispatchTable() {
  const container = document.getElementById("adminDispatchTableBody");
  if (!container) return;

  const reports = await window.CivicAPI.getReports();
  container.innerHTML = reports
    .map(
      (r) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
      <td class="py-3 px-4 font-mono-code font-bold text-blue-700">${r.ticketId}</td>
      <td class="py-3 px-4 font-semibold text-slate-900 max-w-[190px] truncate">${r.title}</td>
      <td class="py-3 px-4 text-slate-600">${r.wardNumber || "Ward 12"}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
          r.urgencyLevel === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
        }">
          ${r.urgencyLevel}
        </span>
      </td>
      <td class="py-3 px-4">
        <select onchange="CivicApp.changeReportStatus('${r._id || r.id}', this.value)" class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800">
          <option value="REPORTED" ${r.status === "REPORTED" ? "selected" : ""}>REPORTED</option>
          <option value="VERIFIED" ${r.status === "VERIFIED" ? "selected" : ""}>VERIFIED</option>
          <option value="ASSIGNED" ${r.status === "ASSIGNED" ? "selected" : ""}>ASSIGNED</option>
          <option value="IN_PROGRESS" ${r.status === "IN_PROGRESS" ? "selected" : ""}>IN PROGRESS</option>
          <option value="RESOLVED" ${r.status === "RESOLVED" ? "selected" : ""}>RESOLVED</option>
        </select>
      </td>
      <td class="py-3 px-4 text-slate-600">${r.assignedDepartment}</td>
      <td class="py-3 px-4">
        <button onclick="CivicApp.openDetailModal('${r._id || r.id}')" class="text-blue-700 hover:text-blue-900 font-bold">
          Inspect
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

async function changeReportStatus(reportId, newStatus) {
  try {
    await window.CivicAPI.updateStatus(reportId, {
      status: newStatus,
      actorName: "Municipal Admin",
      actorRole: "ADMIN",
    });
    loadAdminDashboard();
    loadReports();
  } catch (err) {
    alert("Failed to update status: " + err.message);
  }
}

// Reset seed demo data
async function resetDemoData() {
  if (confirm("Reset all municipal reports to clean seed demo data?")) {
    await window.CivicAPI.resetSeedData();
    alert("Demo data reset successfully!");
    loadReports();
    if (currentTab === "admin") loadAdminDashboard();
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

window.CivicApp = {
  switchTab,
  toggleUpvote,
  openDetailModal,
  changeReportStatus,
  trackTicketDirectly,
  showAcknowledgementSlip,
  postComment,
  resetDemoData,
};
