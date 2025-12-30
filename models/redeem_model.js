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

    // snapshot of address at the time of redeem
    address: {
      name: String,
      addressLine: String,
      city: String,
      state: String,
      pincode: String,
    },

    // optional GPS coordinates at redeem time
    location: {
      lat: Number,
      lng: Number,
    },

    // ---------- STATUS FLOW ----------
    // pending -> kyc_pending -> approved -> packed -> dispatched -> delivered
    // rejected/cancelled are terminal states
    status: {
      type: String,
      enum: [
        "pending",
        "kyc_pending",
        "kyc_rejected",
        "approved",
        "packed",
        "dispatched",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    // ---------- DISPATCH DETAILS ----------
    courierName: {
      type: String,
      default: null,
    },

    trackingId: {
      type: String,
      default: null,
    },

    dispatchDate: {
      type: Date,
      default: null,
    },

    deliveryDate: {
      type: Date,
      default: null,
    },

    adminRemark: {
      type: String,
      default: null,
    },

    // whether KYC address matches delivery address
    kycMatchedWithAddress: {
      type: Boolean,
      default: false,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RedeemHistory", redeemHistorySchema);
