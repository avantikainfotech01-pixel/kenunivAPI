const mongoose = require("mongoose");

const qrCodeSchema = new mongoose.Schema({
  serial: Number,
  points: Number,
  qrText: String,
  uniqueCode: String,
  active: { type: Boolean, default: false },
  inactive: { type: Boolean, default: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.QRCode || mongoose.model("QRCode", qrCodeSchema);
