const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  documentType: { type: String, enum: ["aadhar", "pan"], required: true },

  // New user detail fields
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  address: { type: String, required: true },

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
