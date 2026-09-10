const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const {
  createReport,
  getReports,
  getReportById,
  trackTicket,
  addComment,
  upvoteReport,
  updateReportStatus,
  resetSeedData,
} = require("../controllers/reportController");

const router = express.Router();

router.post("/", upload.single("image"), createReport);
router.get("/", getReports);
router.get("/track/:ticketId", trackTicket);
router.post("/reset-seed", resetSeedData);
router.get("/:id", getReportById);
router.post("/:id/comments", addComment);
router.post("/:id/upvote", upvoteReport);
router.patch("/:id/status", updateReportStatus);

module.exports = router;
