const { analyzeCivicIssue, verifyResolutionPhotos } = require("../services/aiService");
const { fallbackStore } = require("../models/Report");
const { findNearbyReports } = require("../services/geoService");

// Live image preview endpoint (called immediately when citizen snaps/selects photo)
async function analyzePreview(req, res) {
  try {
    const { notes = "", latitude, longitude } = req.body;
    const lat = latitude ? parseFloat(latitude) : null;
    const lon = longitude ? parseFloat(longitude) : null;

    const filename = req.file ? req.file.originalname : "photo.jpg";

    const aiResult = await analyzeCivicIssue({
      filename,
      userNotes: notes,
      latitude: lat,
      longitude: lon,
    });

    let potentialDuplicate = false;
    let duplicateTicketId = null;

    if (lat && lon) {
      const allReports = fallbackStore.getAll();
      const nearby = findNearbyReports(allReports, lat, lon, 80, aiResult.detectedCategory);
      if (nearby.length > 0) {
        potentialDuplicate = true;
        duplicateTicketId = nearby[0].report.ticketId;
      }
    }

    return res.json({
      ...aiResult,
      potentialDuplicateDetected: potentialDuplicate,
      duplicateTicketId,
    });
  } catch (error) {
    console.error("AI Preview error:", error);
    return res.status(500).json({ error: "AI preview failed: " + error.message });
  }
}

// Resolution verification (compares original damage vs field resolution photo)
async function verifyResolution(req, res) {
  try {
    const { reportId, notes } = req.body;
    const report = fallbackStore.getById(reportId);

    const result = await verifyResolutionPhotos({
      category: report ? report.category : "",
      notes,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Resolution verification error: " + error.message });
  }
}

module.exports = {
  analyzePreview,
  verifyResolution,
};
