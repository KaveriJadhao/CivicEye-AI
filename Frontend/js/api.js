// CivicEye-AI API Service Client
const CivicAPI = {
  // Fetch reports with filters
  async getReports(params = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== "All") query.append("category", params.category);
    if (params.status && params.status !== "All") query.append("status", params.status);
    if (params.urgency && params.urgency !== "All") query.append("urgency", params.urgency);
    if (params.ward && params.ward !== "All") query.append("ward", params.ward);
    if (params.search) query.append("search", params.search);
    if (params.sortBy) query.append("sortBy", params.sortBy);

    const res = await fetch(`/api/reports?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch reports");
    return await res.json();
  },

  // Get single report by ID or Ticket
  async getReportById(id) {
    const res = await fetch(`/api/reports/${id}`);
    if (!res.ok) throw new Error("Failed to fetch report details");
    return await res.json();
  },

  // Track complaint by ticket ID
  async trackTicket(ticketId) {
    const res = await fetch(`/api/reports/track/${encodeURIComponent(ticketId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Ticket not found" }));
      throw new Error(err.error || "Ticket not found in municipal registry");
    }
    return await res.json();
  },

  // Add citizen/officer comment to ticket
  async addComment(reportId, payload) {
    const res = await fetch(`/api/reports/${reportId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to post comment");
    return await res.json();
  },

  // Submit report with multipart form data
  async createReport(formData) {
    const res = await fetch(`/api/reports`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to create report" }));
      throw new Error(err.error || "Submission error");
    }
    return await res.json();
  },

  // Live AI Preview analysis
  async analyzeImagePreview(formData) {
    const res = await fetch(`/api/ai/analyze-preview`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("AI Preview scan failed");
    return await res.json();
  },

  // Upvote report
  async upvoteReport(id, userIdentifier = "guest_user") {
    const res = await fetch(`/api/reports/${id}/upvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIdentifier }),
    });
    if (!res.ok) throw new Error("Upvote failed");
    return await res.json();
  },

  // Admin status update
  async updateStatus(id, payload) {
    const res = await fetch(`/api/reports/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Status update failed");
    return await res.json();
  },

  // Admin Dashboard stats
  async getAdminStats() {
    const res = await fetch(`/api/admin/stats`);
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return await res.json();
  },

  // Reset to clean seed data
  async resetSeedData() {
    const res = await fetch(`/api/reports/reset-seed`, { method: "POST" });
    return await res.json();
  },
};

window.CivicAPI = CivicAPI;
