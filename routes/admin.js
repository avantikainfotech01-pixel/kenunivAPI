const express = require("express");
const router = express.Router();
const User = require("../models/user_master");
const Scheme = require("../models/scheme");
const Stock = require("../models/stock");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const QRModel = require("../models/qrcode");
const verifyToken = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const News = require("../models/news_model");

const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/news");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const newsUpload = multer({ storage: newsStorage });

// Middleware to ensure only admins can access
function isAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ error: "Admin access only" });
}

// --- USER MASTER (For Admin Panel Only) ---
// Add or Update User (Admin only)
router.post("/user-master", async (req, res) => {
  try {
    const { id, name, mobile, address, password, active, role, permissions } =
      req.body; // ✅ use permissions
    let user;

    if (id) {
      user = await User.findByIdAndUpdate(
        id,
        { name, mobile, address, password, active, role, permissions },
        { new: true }
      );
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
    } else {
      // Check for existing user with same mobile
      const existingUser = await User.findOne({ mobile });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this mobile already exists",
        });
      }

      const hash = await bcrypt.hash(password, 10);

      user = new User({
        name,
        mobile,
        address,
        password: hash,
        active,
        role,
        permissions: permissions || {},
      });
      await user.save();
    }

    res.json({ success: true, user });
  } catch (err) {
    if (err.name === "ValidationError") {
      res.status(400).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

router.post("/user-master-login", async (req, res) => {
  const { mobile, password } = req.body;
  const user = await User.findOne({ mobile });
  if (!user) return res.status(400).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
  res.json({ message: "Login successful", token, user });
});

// List All Users (Admin only)
router.get("/user-master", async (req, res) => {
  try {
    const users = await User.find();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle active/inactive status of a user (Admin only)
router.put(
  "/user-master/:id/status",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { active } = req.body;

      const user = await User.findByIdAndUpdate(id, { active }, { new: true });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({ success: true, user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// --- SCHEMES ---
// Add or Edit Scheme
const schemeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/schemes");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const schemeUpload = multer({ storage: schemeStorage });

router.post(
  "/schemes",

  schemeUpload.single("image"),
  async (req, res) => {
    try {
      const { id, schemeName, productName, points } = req.body;
      let imagePath = null;

      if (req.file) {
        imagePath = `/uploads/schemes/${req.file.filename}`;
      }

      let scheme;
      if (id) {
        // Edit scheme
        scheme = await Scheme.findByIdAndUpdate(
          id,
          {
            schemeName,
            productName,
            points,
            ...(imagePath && { image: imagePath }),
          },
          { new: true }
        );
        if (!scheme)
          return res
            .status(404)
            .json({ success: false, message: "Scheme not found" });
      } else {
        // Add scheme
        scheme = new Scheme({
          schemeName,
          productName,
          points,
          image: imagePath,
        });
        await scheme.save();
      }

      res.json({ success: true, scheme });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// --- FETCH ALL SCHEMES (Public endpoint) ---
// GET /fetch-schemes - Returns all schemes (no authentication)
router.get("/fetch-schemes", async (req, res) => {
  try {
    const schemes = await Scheme.find().sort({ createdAt: -1 });
    res.json({ success: true, data: schemes }); // ✅ return under 'data' key
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle Scheme Status
router.patch("/schemes/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const scheme = await Scheme.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!scheme) {
      return res
        .status(404)
        .json({ success: false, message: "Scheme not found" });
    }

    res.json({ success: true, scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- STOCKS ---
// Add Stock
router.post("/stocks", async (req, res) => {
  try {
    const { itemName, quantity, minQty, schemeId } = req.body;
    const stock = await Stock.create({ itemName, quantity, minQty, schemeId });
    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Stocks
router.get("/stocks", async (req, res) => {
  const stocks = await Stock.find({}).populate("schemeId", "name");
  res.json({ stocks });
});

// Generate QRs and PDF
router.post("/generate-qrs-pdf", verifyToken, isAdmin, async (req, res) => {
  try {
    const { startSerial, count, points } = req.body;
    if (!startSerial || !count || !points) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const generatedQrs = [];

    for (let i = 0; i < count; i++) {
      const serial = startSerial + i;
      const uniqueCode = uuidv4();
      const qrText = `serial=${serial}|points=${points}|code=${uniqueCode}`;

      await QRModel.create({ serial, points, uniqueCode, qrText, used: false });

      const qrImage = await QRCode.toDataURL(qrText);
      generatedQrs.push({ serial, points, qrImage });
    }

    const pdfFileName = `qr_batch_${Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, `../uploads/${pdfFileName}`);
    const doc = new PDFDocument({ margin: 20 });
    doc.pipe(fs.createWriteStream(pdfPath));

    let x = 50,
      y = 50,
      perRow = 3,
      idx = 0;

    for (const qr of generatedQrs) {
      doc.image(Buffer.from(qr.qrImage.split(",")[1], "base64"), x, y, {
        width: 100,
        height: 100,
      });
      doc.fontSize(10).text(`Serial: ${qr.serial}`, x, y + 110);
      doc.text(`Points: ${qr.points}`, x, y + 125);
      idx++;
      x += 180;
      if (idx % perRow === 0) {
        x = 50;
        y += 160;
      }
    }

    doc.end();

    res.json({
      message: "QRs generated successfully",
      pdf: `/uploads/${pdfFileName}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all QR codes with filters
router.get("/qrs", async (req, res) => {
  try {
    const { used, schemeId } = req.query;
    const filter = {};
    if (used !== undefined) filter.used = used === "true";
    if (schemeId) filter.schemeId = schemeId;

    const qrs = await QRModel.find(filter).populate("schemeId", "name");
    res.json({ count: qrs.length, qrs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate a QR manually by serial
router.put("/activate-qr/:serial", async (req, res) => {
  try {
    const { serial } = req.params;
    const qr = await QRModel.findOne({ serial });
    if (!qr) return res.status(404).json({ error: "QR not found" });
    if (qr.used) return res.status(400).json({ error: "QR already used" });

    qr.used = false;
    await qr.save();
    res.json({ message: "QR activated successfully", qr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a printable PDF for a single QR by serial
router.get("/print-qr/:serial", async (req, res) => {
  try {
    const { serial } = req.params;
    const qr = await QRModel.findOne({ serial });
    if (!qr) return res.status(404).json({ error: "QR not found" });

    const qrImage = await QRCode.toDataURL(qr.qrText);
    const pdfFileName = `qr_${serial}_${Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, `../uploads/${pdfFileName}`);

    const doc = new PDFDocument({ margin: 20 });
    doc.pipe(fs.createWriteStream(pdfPath));

    doc
      .fontSize(16)
      .text(`QR Code - Serial: ${qr.serial}`, { align: "center" });
    doc.image(Buffer.from(qrImage.split(",")[1], "base64"), 200, 150, {
      width: 200,
      height: 200,
    });
    doc
      .fontSize(14)
      .text(`Points: ${qr.points}`, { align: "center", continued: true });

    doc.end();

    res.json({
      message: "Printable QR generated",
      pdf: `/uploads/${pdfFileName}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- NEWS ROUTES ---
// Upload news with image, title, description
router.post("/news", newsUpload.any(), async (req, res) => {
  try {
    console.log("Files received:", req.files); // ✅ log all files
    console.log("Body received:", req.body);

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Image is required" });
    }

    const { title, description } = req.body;
    const file = req.files[0]; // ✅ first uploaded file

    const imagePath = `/uploads/news/${file.filename}`;
    const news = new News({ image: imagePath, title, description });
    await news.save();

    res.json({ success: true, news });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all news
router.get("/news", async (req, res) => {
  try {
    const newsList = await News.find().sort({ createdAt: -1 });
    res.json({ success: true, news: newsList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a news by id
router.delete("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const newsItem = await News.findById(id);
    if (!newsItem) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    // Delete image file
    const imagePath = path.join(__dirname, "..", newsItem.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await News.findByIdAndDelete(id);

    res.json({ success: true, message: "News deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
