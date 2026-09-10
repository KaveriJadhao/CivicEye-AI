// Leaflet Map Controller for CivicEye Nagpur
let mainMap = null;
let markersLayer = null;
let reportPickerMap = null;
let pickerMarker = null;

const NAGPUR_CENTER = [21.1458, 79.0882]; // Central Zero Mile Hub coordinates

function getSeverityColor(urgency) {
  switch (urgency) {
    case "CRITICAL":
      return "#dc2626"; // red
    case "HIGH":
      return "#ea580c"; // orange
    case "MEDIUM":
      return "#d97706"; // amber
    default:
      return "#059669"; // emerald
  }
}

function initMainMap() {
  const mapElement = document.getElementById("mapContainer");
  if (!mapElement) return;

  if (mainMap) {
    mainMap.invalidateSize();
    return;
  }

  mainMap = L.map("mapContainer", {
    center: NAGPUR_CENTER,
    zoom: 13,
    zoomControl: true,
  });

  // CartoDB Positron / OSM clean tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(mainMap);

  markersLayer = L.layerGroup().addTo(mainMap);
}

function updateMapMarkers(reports) {
  if (!mainMap || !markersLayer) return;
  markersLayer.clearLayers();

  if (!reports || reports.length === 0) return;

  reports.forEach((rep) => {
    const color = getSeverityColor(rep.urgencyLevel);
    const isResolved = rep.status === "RESOLVED";

    // Custom pulse marker icon
    const customIcon = L.divIcon({
      className: "custom-div-icon",
      html: `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          background: ${isResolved ? "#059669" : color};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 6px 16px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        ">
          ${isResolved ? "✓" : rep.severityScore ? rep.severityScore.toFixed(0) : "!"}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([rep.latitude, rep.longitude], { icon: customIcon });

    const popupContent = `
      <div style="min-width: 240px; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
        ${
          rep.imageUrl
            ? `<img src="${rep.imageUrl}" style="width:100%; height:120px; object-fit:cover; border-radius:10px; margin-bottom:8px;" onerror="this.style.display='none'"/>`
            : ""
        }
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:800; color:#475569; font-family:monospace;">${rep.ticketId}</span>
          <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; background:${color}15; color:${color}; border: 1px solid ${color}30;">
            ${rep.urgencyLevel}
          </span>
        </div>
        <h4 style="font-size:13px; font-weight:700; margin:0 0 4px 0; color:#0f172a; line-height:1.3;">${rep.title}</h4>
        <p style="font-size:11px; color:#64748b; margin:0 0 6px 0;">📍 ${rep.address || "Geo-tagged Location"}</p>
        <div style="font-size:10px; color:#1e3a8a; font-weight:600; margin-bottom:8px; background:#eff6ff; padding:3px 6px; border-radius:6px;">
          🏛️ ${rep.assignedDepartment || "Municipal Corp"}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:6px;">
          <span style="font-size:11px; font-weight:700; color:#2563eb;">👍 ${rep.upvotes || 1} votes</span>
          <button onclick="window.CivicApp.openDetailModal('${rep._id || rep.id}')" style="background:#1e3a8a; color:white; border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;">
            View Tracking
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    markersLayer.addLayer(marker);
  });
}

function initReportPickerMap(defaultLat = 21.1458, defaultLng = 79.0882) {
  const container = document.getElementById("pickerMapContainer");
  if (!container) return;

  if (reportPickerMap) {
    reportPickerMap.remove();
    reportPickerMap = null;
  }

  reportPickerMap = L.map("pickerMapContainer", {
    center: [defaultLat, defaultLng],
    zoom: 14,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(reportPickerMap);

  pickerMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(reportPickerMap);

  pickerMarker.on("dragend", function (e) {
    const position = pickerMarker.getLatLng();
    setReportCoords(position.lat, position.lng);
  });

  reportPickerMap.on("click", function (e) {
    pickerMarker.setLatLng(e.latlng);
    setReportCoords(e.latlng.lat, e.latlng.lng);
  });

  setReportCoords(defaultLat, defaultLng);
}

function setReportCoords(lat, lng) {
  const latInput = document.getElementById("reportLat");
  const lngInput = document.getElementById("reportLng");
  const addressInput = document.getElementById("reportAddress");
  const wardSelect = document.getElementById("reportWardSelect");

  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);

  // Auto detect ward based on proximity to key landmarks
  if (wardSelect) {
    if (lat > 21.148) wardSelect.value = "Ward 15 - Sadar";
    else if (lng < 79.08) wardSelect.value = "Ward 14 - Civil Lines";
    else if (lat < 21.13) wardSelect.value = "Ward 22 - Medical";
    else if (lng > 79.086) wardSelect.value = "Ward 18 - Sitabuldi";
    else wardSelect.value = "Ward 12 - Dharampeth";
  }

  // Reverse geocode preview
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then((r) => r.json())
    .then((data) => {
      if (data && data.display_name && addressInput && !addressInput.value) {
        const parts = data.display_name.split(",");
        addressInput.value = parts.slice(0, 3).join(",").trim();
      }
    })
    .catch(() => {});
}

window.CivicMap = {
  initMainMap,
  updateMapMarkers,
  initReportPickerMap,
  setReportCoords,
  NAGPUR_CENTER,
};
