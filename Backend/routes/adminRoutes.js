const express = require("express");
const { getDashboardStats, getHotspots } = require("../controllers/adminController");

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/hotspots", getHotspots);

module.exports = router;
