// models/redeem_history.js
const mongoose = require("mongoose");

const redeemHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    schemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scheme",
      required: true,
    },
    pointsUsed: {
      type: Number,
      required: true,
    },
    qrSerial: {
      type: String,
      default: null,
    },
    // store address snapshot at time of redeem
    address: {
      name: String,
      addressLine: String,
      city: String,
      state: String,
      pincode: String,
    },
    // optional GPS coords
    location: {
      lat: Number,
      lng: Number,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "dispatched", "completed"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RedeemHistory", redeemHistorySchema);
