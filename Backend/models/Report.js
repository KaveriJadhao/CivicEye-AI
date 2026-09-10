const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "reports.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Mongoose Schema
const reportSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      default: "Pothole & Road Damage",
    },
    subcategory: { type: String, default: "" },
    severityScore: { type: Number, default: 5.0 }, // 1.0 to 10.0
    urgencyLevel: {
      type: String,
      default: "MEDIUM",
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    aiConfidence: { type: Number, default: 0.9 },
    aiRawAnalysis: { type: Object, default: null },

    status: {
      type: String,
      default: "REPORTED",
      enum: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"],
    },
    assignedDepartment: {
      type: String,
      default: "Public Works & Roads (PWD)",
    },
    assignedOfficer: { type: String, default: "Desk Officer" },
    officerContact: { type: String, default: "+91 712-2567890" },
    resolutionNotes: { type: String, default: "" },
    resolutionImageUrl: { type: String, default: "" },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "" },
    landmark: { type: String, default: "" },
    wardNumber: { type: String, default: "Ward 12 - Dharampeth" },
    zoneName: { type: String, default: "Zone 2 (West)" },

    imageUrl: { type: String, default: "" },
    voiceNoteUrl: { type: String, default: "" },

    reporterName: { type: String, default: "Civic Citizen" },
    reporterPhone: { type: String, default: "" },
    reporterEmail: { type: String, default: "" },
    upvotes: { type: Number, default: 1 },
    upvotedBy: { type: [String], default: [] },
    isDuplicate: { type: Boolean, default: false },
    duplicateOfTicketId: { type: String, default: null },

    estimatedSlaHours: { type: Number, default: 48 },
    slaDeadline: { type: Date },
    
    comments: [
      {
        userName: { type: String, default: "Citizen" },
        userRole: { type: String, default: "CITIZEN" }, // CITIZEN, OFFICER, RESIDENT
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    timelineEvents: [
      {
        status: { type: String, default: "REPORTED" },
        title: { type: String, default: "Issue Submitted" },
        description: { type: String, default: "" },
        actorName: { type: String, default: "Civic System" },
        actorRole: { type: String, default: "CITIZEN" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Fallback Persistent File Store
class FallbackStore {
  constructor() {
    this.reports = [];
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        this.reports = JSON.parse(raw);
      }
    } catch (err) {
      console.warn("Could not load reports.json:", err.message);
      this.reports = [];
    }
  }

  saveToFile() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.reports, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving reports.json:", err.message);
    }
  }

  getAll(filter = {}, sortBy = "newest") {
    let list = [...this.reports];

    if (filter.category && filter.category !== "All") {
      list = list.filter((r) => r.category === filter.category);
    }
    if (filter.status && filter.status !== "All") {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter.urgencyLevel && filter.urgencyLevel !== "All") {
      list = list.filter((r) => r.urgencyLevel === filter.urgencyLevel);
    }
    if (filter.ward && filter.ward !== "All") {
      list = list.filter((r) => r.wardNumber && r.wardNumber.includes(filter.ward));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.ticketId.toLowerCase().includes(q) ||
          (r.address && r.address.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.assignedDepartment && r.assignedDepartment.toLowerCase().includes(q))
      );
    }

    if (sortBy === "upvotes") {
      list.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sortBy === "severity") {
      list.sort((a, b) => b.severityScore - a.severityScore);
    } else if (sortBy === "sla") {
      list.sort((a, b) => a.estimatedSlaHours - b.estimatedSlaHours);
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }

  getById(idOrTicket) {
    if (!idOrTicket) return null;
    const normalized = idOrTicket.toString().trim().toUpperCase();
    return this.reports.find(
      (r) =>
        (r._id && r._id.toString() === idOrTicket) ||
        (r.id && r.id.toString() === idOrTicket) ||
        (r.ticketId && r.ticketId.toUpperCase() === normalized)
    );
  }

  create(data) {
    const newDoc = {
      _id: "ce_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      id: "ce_" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      upvotes: 1,
      upvotedBy: [],
      comments: [],
      timelineEvents: [],
      ...data,
    };
    this.reports.unshift(newDoc);
    this.saveToFile();
    return newDoc;
  }

  update(idOrTicket, updateData) {
    const idx = this.reports.findIndex(
      (r) =>
        r._id === idOrTicket ||
        r.ticketId === idOrTicket ||
        r.id === idOrTicket ||
        (r.ticketId && r.ticketId.toUpperCase() === (idOrTicket || "").toUpperCase())
    );
    if (idx === -1) return null;

    this.reports[idx] = {
      ...this.reports[idx],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    this.saveToFile();
    return this.reports[idx];
  }

  addComment(idOrTicket, commentObj) {
    const report = this.getById(idOrTicket);
    if (!report) return null;
    report.comments = report.comments || [];
    report.comments.push({
      userName: commentObj.userName || "Citizen",
      userRole: commentObj.userRole || "CITIZEN",
      text: commentObj.text,
      createdAt: new Date().toISOString(),
    });
    this.update(report._id || report.id, report);
    return report;
  }

  seedIfEmpty(seedArray) {
    if (this.reports.length === 0 && seedArray && seedArray.length > 0) {
      this.reports = seedArray;
      this.saveToFile();
    }
  }

  resetWithFreshSeed(seedArray) {
    this.reports = seedArray;
    this.saveToFile();
  }
}

const fallbackStore = new FallbackStore();

let ReportModel = null;
try {
  ReportModel = mongoose.model("Report", reportSchema);
} catch {
  ReportModel = mongoose.models.Report;
}

module.exports = {
  ReportModel,
  fallbackStore,
};
