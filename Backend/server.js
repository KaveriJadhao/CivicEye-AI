require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const fs = require("fs");

const reportRoutes = require("./routes/reportRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { fallbackStore } = require("./models/Report");
const { seedReports } = require("./seedData");

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Seed initial reports if empty
fallbackStore.seedIfEmpty(seedReports);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads
app.use("/uploads", express.static(uploadsDir));

// Serve Frontend static assets
const frontendDir = path.join(__dirname, "../Frontend");
app.use(express.static(frontendDir));

// API Routes
app.use("/api/reports", reportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "CivicEye-AI Platform",
    time: new Date().toISOString(),
    reportsCount: fallbackStore.getAll().length,
  });
});

// Database connection attempt (with graceful offline fallback)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log(" Connected to MongoDB Atlas"))
    .catch((err) =>
      console.log("ℹ️ MongoDB connection not active, running with local file store:", err.message)
    );
} else {
  console.log("ℹ️ Running in Zero-Config Local Store mode (Fast & Reliable).");
}

// Catch-all route to serve index.html for SPA
app.use((req, res) => {
  const indexPath = path.join(frontendDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("CivicEye-AI Server Running. Frontend index.html loading...");
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CivicEye-AI Server is LIVE on http://localhost:${PORT}`);
  console.log(`🏛️ Citizen & Admin Portal: http://localhost:${PORT}`);
  console.log(`📡 API Endpoints: http://localhost:${PORT}/api/reports`);
  console.log(`====================================================`);
});
