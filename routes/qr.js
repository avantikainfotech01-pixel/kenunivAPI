const express = require("express");
const QRCode = require("qrcode");
const moment = require("moment");
const QRModel = require("../models/qrcode");
const QrHistory = require("../models/qr_history");
const router = express.Router();
const crypto = require("crypto");
const PDFDocument = require("pdfkit");   // install: npm i pdfkit
const fs = require("fs");
const path = require("path");

// Helper to generate unique code
function generateUniqueCode(serial) {
  const hash = crypto.createHash("sha256");
  hash.update(`${serial}-${Date.now()}-${Math.random()}`);
  return hash.digest("hex").slice(0, 8).toUpperCase();
}

// POST /api/generate-qrs
router.post("/generate-qrs", async (req, res) => {
  const { serialFrom, serialTo, points } = req.body;

  if (!serialFrom || !serialTo || !points) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const qrList = [];

  for (
    let serial = parseInt(serialFrom);
    serial <= parseInt(serialTo);
    serial++
  ) {
    const uniqueCode = generateUniqueCode(serial);

    const qrText = `serial=${serial}|points=${points}|code=${uniqueCode}`;
    const qrImage = await QRCode.toDataURL(qrText);

    await QRModel.create({
      serial,
      points,
      qrText,
      uniqueCode,
      used: false,
      active: false, // initially inactive
    });

    qrList.push({ serial, points, uniqueCode, qrImage });
  }

  await QrHistory.create({
    startSerial: parseInt(serialFrom),
    endSerial: parseInt(serialTo),
    points,
  });

  res.json({ count: qrList.length, qrs: qrList });
});

// GET /api/qr-history
router.get("/qr-history", async (req, res) => {
  try {
    const history = await QrHistory.find().sort({ createdAt: -1 });
    res.json({ history });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch history", details: err.message });
  }
});

// POST /api/activate-qr
router.post("/activate-qr", async (req, res) => {
  const { serialFrom, serialTo } = req.body;

  if (!serialFrom || !serialTo) {
    return res
      .status(400)
      .json({ error: "serialFrom and serialTo are required" });
  }

  const from = parseInt(serialFrom);
  const to = parseInt(serialTo);

  const result = await QRModel.updateMany(
    { serial: { $gte: from, $lte: to } },
    { $set: { active: true, deactive: false } }
  );

  res.json({ message: `Activated ${result.modifiedCount} QR Code(s)` });
});

// POST /api/deactivate-qr
router.post("/deactivate-qr", async (req, res) => {
  const { serialFrom, serialTo } = req.body;

  if (!serialFrom || !serialTo) {
    return res
      .status(400)
      .json({ error: "serialFrom and serialTo are required" });
  }

  const from = parseInt(serialFrom);
  const to = parseInt(serialTo);

  const result = await QRModel.updateMany(
    { serial: { $gte: from, $lte: to } },
    { $set: { active: false, deactive: true } }
  );

  res.json({ message: `Deactivated ${result.modifiedCount} QR Code(s)` });
});

// POST /api/activate-range
router.post("/activate-range", async (req, res) => {
  const { serialFrom, serialTo } = req.body;

  if (
    serialFrom === undefined ||
    serialTo === undefined ||
    isNaN(serialFrom) ||
    isNaN(serialTo)
  ) {
    return res.status(400).json({
      error: "serialFrom and serialTo must be provided and be numbers",
    });
  }

  const from = parseInt(serialFrom);
  const to = parseInt(serialTo);

  const result = await QRModel.updateMany(
    { serial: { $gte: from, $lte: to } },
    { $set: { active: true } }
  );

  if (result.matchedCount === 0) {
    return res
      .status(404)
      .json({ error: "No QR Codes found in the given range" });
  }

  res.json({
    message: `Activated ${result.modifiedCount} QR Code(s) successfully`,
  });
});

// POST /api/deactivate-range
router.post("/deactivate-range", async (req, res) => {
  const { serialFrom, serialTo } = req.body;

  if (
    serialFrom === undefined ||
    serialTo === undefined ||
    isNaN(serialFrom) ||
    isNaN(serialTo)
  ) {
    return res.status(400).json({
      error: "serialFrom and serialTo must be provided and be numbers",
    });
  }

  const from = parseInt(serialFrom);
  const to = parseInt(serialTo);

  const result = await QRModel.updateMany(
    { serial: { $gte: from, $lte: to } },
    { $set: { active: false } }
  );

  if (result.matchedCount === 0) {
    return res
      .status(404)
      .json({ error: "No QR Codes found in the given range" });
  }

  res.json({
    message: `Deactivated ${result.modifiedCount} QR Code(s) successfully`,
  });
});

// POST /api/scan-code
router.post("/scan-code", async (req, res) => {
  const { uniqueCode } = req.body;

  if (!uniqueCode) {
    return res.status(400).json({ error: "Unique code is required" });
  }

  const qr = await QRModel.findOne({ uniqueCode });

  if (!qr) {
    return res.status(404).json({ error: "QR Code not found" });
  }

  if (qr.used) {
    return res
      .status(403)
      .json({ error: "This QR code has already been used" });
  }

  qr.used = true;
  await qr.save();

  res.json({ message: "QR code validated successfully", data: qr });
});

// GET /api/get-qr/:uniqueCode
router.get("/get-qr/:uniqueCode", async (req, res) => {
  const { uniqueCode } = req.params;

  try {
    const qr = await QRModel.findOne({ uniqueCode });
    if (!qr) {
      return res.status(404).json({ error: "QR Code not found" });
    }

    const qrImage = await QRCode.toDataURL(qr.qrText);

    res.json({
      serial: qr.serial,
      points: qr.points,
      uniqueCode: qr.uniqueCode,
      used: qr.used,
      active: qr.active,
      qrText: qr.qrText,
      qrImage,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to retrieve QR code", details: err.message });
  }
});

// GET /api/get-all-qrs
router.get("/get-all-qrs", async (req, res) => {
  try {
    const allQrs = await QRModel.find({});
    const qrData = await Promise.all(
      allQrs.map(async (qr) => {
        const qrImage = await QRCode.toDataURL(qr.qrText);
        return {
          id: qr._id,
          serial: qr.serial,
          points: qr.points,
          expiry: qr.expiry,
          uniqueCode: qr.uniqueCode,
          used: qr.used,
          active: qr.active,
          qrText: qr.qrText,
          qrImage,
        };
      })
    );
    res.json({ count: qrData.length, qrs: qrData });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to retrieve all QR codes", details: err.message });
  }
});

// GET /api/qr-stats
router.get("/qr-stats", async (req, res) => {
  try {
    const activeCount = await QRModel.countDocuments({ active: true });
    const inactiveCount = await QRModel.countDocuments({ active: false });

    res.json({
      active: activeCount,
      inactive: inactiveCount,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to retrieve QR stats", details: err.message });
  }
});
router.get("/qr-history/pdf/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const history = await QrHistory.findById(id);
    if (!history) {
      return res.status(404).json({ error: "QR history not found" });
    }

    // Create PDF
    const doc = new PDFDocument();
    const fileName = `qr_history_${history._id}.pdf`;
    const filePath = path.join(__dirname, "../downloads", fileName);

    // Ensure folder exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // PDF Content
    doc.fontSize(20).text("QR Generation History", { underline: true });
    doc.moveDown();

    doc.fontSize(14).text(`Start Serial: ${history.startSerial}`);
    doc.text(`End Serial: ${history.endSerial}`);
    doc.text(`Points : ${history.points}`);
    doc.text(`Generated On: ${history.createdAt}`);
    doc.moveDown();

    doc.text("Thank you!", { align: "right" });

    doc.end();

    stream.on("finish", () => {
      res.download(filePath, fileName, () => {
        fs.unlinkSync(filePath); // delete temp file
      });
    });

  } catch (err) {
    console.error("PDF Error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

module.exports = router;
