// CivicEye - Advanced Leaflet Map Manager with Satellite & Street Layers
let mainMap = null;
let markersLayer = null;
let reportPickerMap = null;
let pickerMarker = null;
let currentTileLayer = null;
let currentLayerType = "street"; // 'street' or 'satellite'
const markerMap = new Map();

const NAGPUR_CENTER = [21.1458, 79.0882];

const MAP_TILES = {
  street: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

function getSeverityColor(urgency) {
  switch (urgency) {
    case "CRITICAL": return "#dc2626";
    case "HIGH": return "#ea580c";
    case "MEDIUM": return "#d97706";
    default: return "#059669";
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

  currentTileLayer = L.tileLayer(MAP_TILES.street, {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(mainMap);

  markersLayer = L.layerGroup().addTo(mainMap);
}

function switchMapLayer(type) {
  if (!mainMap || !MAP_TILES[type]) return;
  currentLayerType = type;

  if (currentTileLayer) {
    mainMap.removeLayer(currentTileLayer);
  }

  currentTileLayer = L.tileLayer(MAP_TILES[type], {
    maxZoom: 19,
    attribution: type === "satellite" ? "Tiles &copy; Esri" : "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(mainMap);
}

function updateMapMarkers(reports) {
  if (!mainMap || !markersLayer) return;
  markersLayer.clearLayers();
  markerMap.clear();

  if (!reports || reports.length === 0) return;

  reports.forEach((rep) => {
    const color = getSeverityColor(rep.urgencyLevel);
    const isResolved = rep.status === "RESOLVED";

    const customIcon = L.divIcon({
      className: "custom-pin",
      html: `
        <div id="marker-${rep._id || rep.id}" style="
          width: 32px;
          height: 32px;
          background: ${isResolved ? "#059669" : color};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        ">
          ${isResolved ? "✓" : rep.severityScore ? Math.round(rep.severityScore) : "!"}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([rep.latitude, rep.longitude], { icon: customIcon });

    const popupContent = `
      <div style="min-width: 220px; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
        ${
          rep.imageUrl
            ? `<img src="${rep.imageUrl}" style="width:100%; height:110px; object-fit:cover; border-radius:10px; margin-bottom:8px;" onerror="this.style.display='none'"/>`
            : ""
        }
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:700; color:#64748b; font-family:monospace;">${rep.ticketId}</span>
          <span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; background:${color}15; color:${color};">
            ${rep.urgencyLevel}
          </span>
        </div>
        <h4 style="font-size:13px; font-weight:700; margin:0 0 4px 0; color:#0f172a; line-height:1.3;">${rep.title}</h4>
        <p style="font-size:11px; color:#64748b; margin:0 0 8px 0;">📍 ${rep.address || "Nagpur"}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:6px;">
          <span style="font-size:11px; font-weight:700; color:#2563eb;">👍 ${rep.upvotes || 1} votes</span>
          <button onclick="CivicApp.openDetailModal('${rep._id || rep.id}')" style="background:#2563eb; color:white; border:none; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; cursor:pointer;">
            View Details
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    markersLayer.addLayer(marker);
    markerMap.set(rep._id || rep.id, marker);
  });
}

function focusReportOnMap(reportId) {
  const marker = markerMap.get(reportId);
  if (marker && mainMap) {
    const latLng = marker.getLatLng();
    mainMap.flyTo(latLng, 15, { duration: 1 });
    marker.openPopup();
  }
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

  L.tileLayer(MAP_TILES.street, { maxZoom: 19 }).addTo(reportPickerMap);

  pickerMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(reportPickerMap);

  pickerMarker.on("dragend", function (e) {
    const pos = pickerMarker.getLatLng();
    setReportCoords(pos.lat, pos.lng);
  });

  reportPickerMap.on("click", function (e) {
    pickerMarker.setLatLng(e.latlng);
    setReportCoords(e.latlng.lat, e.latlng.lng);
  });

  setReportCoords(defaultLat, defaultLng);
}

function setReportCoords(lat, lng) {
  const latIn = document.getElementById("reportLat");
  const lngIn = document.getElementById("reportLng");
  const addrIn = document.getElementById("reportAddress");
  const wardSelect = document.getElementById("reportWardSelect");

  if (latIn) latIn.value = lat.toFixed(6);
  if (lngIn) lngIn.value = lng.toFixed(6);

  if (wardSelect) {
    if (lat > 21.148) wardSelect.value = "Ward 15 - Sadar";
    else if (lng < 79.08) wardSelect.value = "Ward 14 - Civil Lines";
    else if (lat < 21.13) wardSelect.value = "Ward 22 - Medical";
    else if (lng > 79.086) wardSelect.value = "Ward 18 - Sitabuldi";
    else wardSelect.value = "Ward 12 - Dharampeth";
  }

  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then((r) => r.json())
    .then((d) => {
      if (d && d.display_name && addrIn && !addrIn.value) {
        const parts = d.display_name.split(",");
        addrIn.value = parts.slice(0, 3).join(",").trim();
      }
    })
    .catch(() => {});
}

window.CivicMap = {
  initMainMap,
  updateMapMarkers,
  focusReportOnMap,
  switchMapLayer,
  initReportPickerMap,
  setReportCoords,
  NAGPUR_CENTER,
};
