const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  mobile: { type: String, unique: true },
  otp: { type: Number },
  email: { type: String, unique: true },
  password: { type: String },
  name: String,
  address: String,
  state: String,
  city: String,
  role: { type: String, enum: ["admin", "user"], default: "user" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
