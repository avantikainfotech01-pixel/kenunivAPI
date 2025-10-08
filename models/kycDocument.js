const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  documentType: { type: String, enum: ["aadhar", "pan"], required: true },
  frontImage: { type: String, required: true },
  backImage: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("KycDocument", kycSchema);
