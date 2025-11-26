const express = require("express");
const multer = require("multer");
const path = require("path");
const KycDocument = require("../models/kycDocument");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/kyc/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Upload KYC
router.post(
  "/upload",
  
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { documentType } = req.body;
      const userId = req.user.id;

      const frontImage = req.files["front"][0].filename;
      const backImage = req.files["back"][0].filename;

      const kyc = new KycDocument({
        userId,
        documentType,
        frontImage,
        backImage,
      });

      await kyc.save();

      res.json({
        success: true,
        message: "KYC Uploaded Successfully",
        data: kyc,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
