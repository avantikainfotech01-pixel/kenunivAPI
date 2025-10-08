// models/qrHistory.js
const mongoose = require("mongoose");

const qrHistorySchema = new mongoose.Schema(
  {
    startSerial: { type: Number, required: true },
    endSerial: { type: Number, required: true },
    points: { type: Number, required: true },
  },
  { timestamps: true } // adds createdAt & updatedAt
);

module.exports = mongoose.model("QrHistory", qrHistorySchema);
