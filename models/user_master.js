const mongoose = require("mongoose");

const userMasterSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobile: String,
  password: String,
  role: { type: String, default: "sub-admin" }, // "primary-admin" | "sub-admin"
  active: { type: Boolean, default: true },
  permissions: {
    qr: { type: Boolean, default: false },
    point: { type: Boolean, default: false },
    news: { type: Boolean, default: false },
    stock: { type: Boolean, default: false },
    scheme: { type: Boolean, default: false },
    userMaster: { type: Boolean, default: false },
    contractor: { type: Boolean, default: false },
    wallet: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    dashboard: { type: Boolean, default: false },
  },
});

module.exports = mongoose.model("UserMaster", userMasterSchema);
