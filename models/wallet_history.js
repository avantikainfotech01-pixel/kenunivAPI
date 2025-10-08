const mongoose = require("mongoose");

const walletHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, required: true }, // Points added or removed
  type: { type: String, enum: ["credit", "debit"], required: true }, // For add/remove clarity
  balanceAfter: { type: Number, required: true }, // User’s balance after transaction
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WalletHistory", walletHistorySchema);
