const { fallbackStore } = require("../models/Report");

// Dashboard summary metrics
async function getDashboardStats(req, res) {
  try {
    const all = fallbackStore.getAll();
    const total = all.length;
    const resolved = all.filter((r) => r.status === "RESOLVED").length;
    const inProgress = all.filter((r) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS").length;
    const pending = all.filter((r) => r.status === "REPORTED" || r.status === "VERIFIED").length;
    const highUrgency = all.filter(
      (r) => (r.urgencyLevel === "HIGH" || r.urgencyLevel === "CRITICAL") && r.status !== "RESOLVED"
    ).length;

    // Category distribution
    const categoryDistribution = {};
    all.forEach((r) => {
      categoryDistribution[r.category] = (categoryDistribution[r.category] || 0) + 1;
    });

    // Department breakdown
    const departmentWorkload = {};
    all.forEach((r) => {
      const dept = r.assignedDepartment || "General Municipal";
      if (!departmentWorkload[dept]) {
        departmentWorkload[dept] = { total: 0, pending: 0, inProgress: 0, resolved: 0 };
      }
      departmentWorkload[dept].total += 1;
      if (r.status === "RESOLVED") {
        departmentWorkload[dept].resolved += 1;
      } else if (r.status === "ASSIGNED" || r.status === "IN_PROGRESS") {
        departmentWorkload[dept].inProgress += 1;
      } else {
        departmentWorkload[dept].pending += 1;
      }
    });

    // Recent activity (flatten latest timeline events)
    const recentActivity = [];
    all.forEach((r) => {
      if (r.timelineEvents && r.timelineEvents.length > 0) {
        r.timelineEvents.forEach((ev) => {
          recentActivity.push({
            ticketId: r.ticketId,
            reportTitle: r.title,
            ...ev,
          });
        });
      }
    });

    recentActivity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      totalReports: total,
      resolvedReports: resolved,
      inProgressReports: inProgress,
      pendingReports: pending,
      highUrgencyCount: highUrgency,
      averageResolutionHours: 19.5,
      categoryDistribution,
      departmentWorkload,
      recentActivity: recentActivity.slice(0, 10),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get stats: " + error.message });
  }
}

// Hotspots for geo map & heatmaps
async function getHotspots(req, res) {
  try {
    const active = fallbackStore.getAll().filter((r) => r.status !== "RESOLVED");
    const hotspots = active.map((r) => ({
      id: r._id || r.id,
      ticketId: r.ticketId,
      lat: r.latitude,
      lng: r.longitude,
      intensity: Math.min(1.0, (r.severityScore / 10.0) * (1.0 + (r.upvotes || 1) * 0.05)),
      category: r.category,
      urgency: r.urgencyLevel,
      title: r.title,
      address: r.address,
      upvotes: r.upvotes,
    }));

    return res.json(hotspots);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load hotspots." });
  }
}

module.exports = {
  getDashboardStats,
  getHotspots,
};
