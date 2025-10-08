const mongoose = require("mongoose");

const schemeSchema = new mongoose.Schema({
  schemeName: { type: String, required: true },
  productName: { type: String, required: true },
  points: { type: Number, required: true },
  image: { type: String }, // store image filename or URL
  status: { type: String, enum: ["active", "inactive"], default: "inactive" },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Scheme", schemeSchema);
