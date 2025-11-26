const express = require("express");
const multer = require("multer");
const path = require("path");
const KycDocument = require("../models/kycDocument");
const verifyToken = require("../middleware/auth");
const fs = require('fs');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "kyc");

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
router.post(
  "/upload",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { documentType, userId } = req.body;

      const frontImage = req.files["front"][0].filename;
      const backImage = req.files["back"][0].filename;

      const kyc = new KycDocument({
        userId,
        documentType,
        frontImage,
        backImage,
      });

      await kyc.save();

      res.status(200).json({
        success: true,
        message: "Your verification is sent to admin",
        data: kyc, // send frontImage/backImage here
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);


module.exports = router;
