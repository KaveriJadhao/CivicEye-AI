const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const { analyzePreview, verifyResolution } = require("../controllers/aiController");

const router = express.Router();

router.post("/analyze-preview", upload.single("image"), analyzePreview);
router.post("/verify-resolution", upload.single("resolutionImage"), verifyResolution);

module.exports = router;
