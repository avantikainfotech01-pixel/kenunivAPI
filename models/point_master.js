const mongoose = require("mongoose");

const pointMasterSchema = new mongoose.Schema(
  {
    points: { type: Number, required: true },
    color: { type: String, required: true },
    code: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PointMaster", pointMasterSchema);
