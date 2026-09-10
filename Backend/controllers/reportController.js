const { ReportModel, fallbackStore } = require("../models/Report");
const { analyzeCivicIssue } = require("../services/aiService");
const { findNearbyReports } = require("../services/geoService");
const { seedReports } = require("../seedData");

// Generate unique municipal ticket ID
function generateTicketId() {
  const d = new Date();
  const yearMonth = `${d.getFullYear().toString().slice(2)}${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CE-${yearMonth}-${randomHex}`;
}

// 1. Create a new civic report
async function createReport(req, res) {
  try {
    const {
      title,
      description,
      category,
      latitude,
      longitude,
      address,
      landmark,
      wardNumber,
      reporterName,
      reporterPhone,
      reporterEmail,
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and Longitude are required." });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    let imageUrl = "";

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Run AI Vision Triage
    let aiResult = null;
    try {
      aiResult = await analyzeCivicIssue({
        filename: req.file ? req.file.originalname : "",
        userNotes: `${title || ""} ${description || ""}`,
        latitude: lat,
        longitude: lon,
      });
    } catch (e) {
      console.warn("AI Triage error, using defaults:", e.message);
    }

    const finalCategory = category || (aiResult && aiResult.detectedCategory) || "Pothole & Road Damage";
    const finalTitle = title || (aiResult && aiResult.titleSuggestion) || "Reported Civic Hazard";
    const finalDescription = description || (aiResult && aiResult.descriptionSummary) || "Citizen submitted civic issue.";
    const severityScore = (aiResult && aiResult.severityScore) || 5.0;
    const urgencyLevel = (aiResult && aiResult.urgencyLevel) || "MEDIUM";
    const recommendedDept = (aiResult && aiResult.recommendedDepartment) || "Public Works & Roads (PWD)";
    const estimatedSla = (aiResult && aiResult.estimatedSlaHours) || 48;
    const subcategory = (aiResult && aiResult.subcategory) || "";
    const ticketId = generateTicketId();

    // Check duplicate proximity in existing reports (within 80 meters)
    const existingReports = fallbackStore.getAll();
    const nearby = findNearbyReports(existingReports, lat, lon, 80, finalCategory);
    let isDuplicate = false;
    let duplicateOfTicketId = null;

    if (nearby.length > 0) {
      isDuplicate = true;
      duplicateOfTicketId = nearby[0].report.ticketId;
    }

    const newReportData = {
      ticketId,
      title: finalTitle,
      description: finalDescription,
      category: finalCategory,
      subcategory,
      severityScore,
      urgencyLevel,
      aiConfidence: (aiResult && aiResult.confidence) || 0.9,
      aiRawAnalysis: aiResult,
      status: "REPORTED",
      assignedDepartment: recommendedDept,
      assignedOfficer: "Area Nodal Officer",
      officerContact: "+91 712-2561234",
      resolutionNotes: "",
      resolutionImageUrl: "",
      latitude: lat,
      longitude: lon,
      address: address || "Geo-tagged Location",
      landmark: landmark || "",
      wardNumber: wardNumber || "Ward 12 - Dharampeth",
      zoneName: "Zone 2 (West)",
      imageUrl,
      reporterName: reporterName || "Civic Citizen",
      reporterPhone: reporterPhone || "",
      reporterEmail: reporterEmail || "",
      upvotes: 1,
      isDuplicate,
      duplicateOfTicketId,
      estimatedSlaHours: estimatedSla,
      comments: [],
      timelineEvents: [
        {
          status: "REPORTED",
          title: "Complaint Registered via Citizen Mobile Portal",
          description: `Ticket ${ticketId} registered with AI Urgency [${urgencyLevel}]. Assigned to ${recommendedDept}.`,
          actorName: reporterName || "Citizen Reporter",
          actorRole: "CITIZEN",
          createdAt: new Date(),
        },
      ],
    };

    if (isDuplicate) {
      newReportData.timelineEvents.push({
        status: "FLAGGED",
        title: "Duplicate Spatial Match Linked",
        description: `CivicEye Geo-AI detected active ticket ${duplicateOfTicketId} within 80m. Escalating original ticket priority.`,
        actorName: "CivicEye AI Engine",
        actorRole: "SYSTEM",
        createdAt: new Date(),
      });
    }

    // Save to store
    let savedReport = null;
    if (ReportModel && ReportModel.db && ReportModel.db.readyState === 1) {
      savedReport = await ReportModel.create(newReportData);
    } else {
      savedReport = fallbackStore.create(newReportData);
    }

    return res.status(201).json(savedReport);
  } catch (error) {
    console.error("Create report error:", error);
    return res.status(500).json({ error: "Failed to create civic report: " + error.message });
  }
}

// 2. List reports with filters
async function getReports(req, res) {
  try {
    const { category, status, urgency, ward, search, sortBy } = req.query;
    const filter = {
      category,
      status,
      urgencyLevel: urgency,
      ward,
      search,
    };

    const reports = fallbackStore.getAll(filter, sortBy || "newest");
    return res.json(reports);
  } catch (error) {
    console.error("Get reports error:", error);
    return res.status(500).json({ error: "Failed to fetch reports." });
  }
}

// 3. Get single report by ID or Ticket ID
async function getReportById(req, res) {
  try {
    const { id } = req.params;
    const report = fallbackStore.getById(id);
    if (!report) {
      return res.status(404).json({ error: "Civic report not found." });
    }
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch report details." });
  }
}

// 4. Track Ticket by exact Ticket ID
async function trackTicket(req, res) {
  try {
    const { ticketId } = req.params;
    const report = fallbackStore.getById(ticketId);
    if (!report) {
      return res.status(404).json({ error: `Ticket '${ticketId}' not found in municipal registry.` });
    }
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: "Tracking failed: " + error.message });
  }
}

// 5. Add citizen/officer comment to ticket
async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { text, userName = "Citizen", userRole = "CITIZEN" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Comment text is required." });
    }

    const updated = fallbackStore.addComment(id, { userName, userRole, text });
    if (!updated) {
      return res.status(404).json({ error: "Report not found." });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to add comment: " + error.message });
  }
}

// 6. Upvote report
async function upvoteReport(req, res) {
  try {
    const { id } = req.params;
    const { userIdentifier = "guest_user" } = req.body;
    const report = fallbackStore.getById(id);

    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    report.upvotedBy = report.upvotedBy || [];
    const hasVoted = report.upvotedBy.includes(userIdentifier);

    if (hasVoted) {
      report.upvotedBy = report.upvotedBy.filter((u) => u !== userIdentifier);
      report.upvotes = Math.max(1, report.upvotes - 1);
    } else {
      report.upvotedBy.push(userIdentifier);
      report.upvotes = (report.upvotes || 1) + 1;

      if (report.upvotes >= 10 && report.urgencyLevel !== "CRITICAL") {
        report.urgencyLevel = "HIGH";
        report.timelineEvents.push({
          status: report.status,
          title: "Community Priority Auto-Escalated",
          description: `Citizen upvotes reached ${report.upvotes}. Escalated urgency level to HIGH.`,
          actorName: "Civic Community",
          actorRole: "CITIZEN",
          createdAt: new Date(),
        });
      }
    }

    fallbackStore.update(report._id || report.id, report);
    return res.json({
      success: true,
      upvoted: !hasVoted,
      upvotes: report.upvotes,
      report,
    });
  } catch (error) {
    return res.status(500).json({ error: "Upvote failed: " + error.message });
  }
}

// 7. Update status (Admin / Officer flow)
async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      assignedDepartment,
      assignedOfficer,
      officerContact,
      resolutionNotes,
      resolutionImageUrl,
      actorName = "Municipal Authority",
      actorRole = "ADMIN",
    } = req.body;

    const report = fallbackStore.getById(id);
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    const oldStatus = report.status;
    if (status) report.status = status;
    if (assignedDepartment) report.assignedDepartment = assignedDepartment;
    if (assignedOfficer) report.assignedOfficer = assignedOfficer;
    if (officerContact) report.officerContact = officerContact;
    if (resolutionNotes) report.resolutionNotes = resolutionNotes;
    if (resolutionImageUrl) report.resolutionImageUrl = resolutionImageUrl;

    let eventTitle = `Status updated to ${status}`;
    if (status === "ASSIGNED") eventTitle = `Assigned to ${report.assignedDepartment}`;
    if (status === "IN_PROGRESS") eventTitle = `Field Crew Dispatched On-Site`;
    if (status === "RESOLVED") eventTitle = `Issue Resolved & Verified Closed`;

    report.timelineEvents = report.timelineEvents || [];
    report.timelineEvents.push({
      status: status || oldStatus,
      title: eventTitle,
      description: resolutionNotes || `Progressed ticket from ${oldStatus} to ${status}.`,
      actorName,
      actorRole,
      createdAt: new Date(),
    });

    const updated = fallbackStore.update(report._id || report.id, report);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Status update failed: " + error.message });
  }
}

// 8. Reset to clean seed data
async function resetSeedData(req, res) {
  try {
    fallbackStore.resetWithFreshSeed(seedReports);
    return res.json({ success: true, count: seedReports.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

module.exports = {
  createReport,
  getReports,
  getReportById,
  trackTicket,
  addComment,
  upvoteReport,
  updateReportStatus,
  resetSeedData,
};
