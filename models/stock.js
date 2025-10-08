const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  minQty: { type: Number, default: 0 },
  schemeId: { type: mongoose.Schema.Types.ObjectId, ref: "Scheme" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Stock", stockSchema);
