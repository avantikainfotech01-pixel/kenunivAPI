const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const verifyToken = require("../middleware/auth");
const crypto = require("crypto");
const mongoose = require("mongoose");
require("dotenv").config();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/send-otp", async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: "Mobile is required" });

  const otp = generateOTP();
  let user = await User.findOne({ mobile });
  if (!user) user = new User({ mobile });
  user.otp = otp;
  await user.save();

  console.log(`OTP for ${mobile}: ${otp}`);
  res.json({ message: "OTP sent successfully" });
});

router.post("/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body;
  const user = await User.findOne({ mobile });
  if (!user || user.otp !== otp)
    return res.status(400).json({ error: "Invalid OTP" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
  user.otp = null;
  await user.save();

  res.json({ message: "OTP verified", token, user });
});
router.post("/register", async (req, res) => {
  const { name, mobile, password, address, state, city, role } =
    req.body;

  if (!mobile) {
    return res.status(400).json({ error: "Mobile is required" });
  }

  const existingMobile = await User.findOne({ mobile });
  if (existingMobile) {
    return res.status(400).json({ error: "Mobile already registered" });
  }


  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    mobile,
    password: hash,
    address,
    state,
    city,
    role: role && ["admin", "user"].includes(role) ? role : "user",
  });

  res.json({ message: "User registered successfully", user });
});

router.post("/admin-register", async (req, res) => {
  const { mobile, password } = req.body;
  const existing = await User.findOne({ mobile });
  if (existing)
    return res.status(400).json({ error: "Mobile already registered" });
  const hash = await bcrypt.hash(password, 10);

  const admin = await User.create({ mobile, password: hash, role: "admin" });
  res.json({ message: "Admin registered successfully", admin });
});

router.post("/login", async (req, res) => {
  const { mobile, password } = req.body;
  const user = await User.findOne({ mobile });
  if (!user) return res.status(400).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
  res.json({ message: "Login successful", token, user });
});
router.get("/get-user", (req, res) => {
  const userId = req.query.userId;
  User.find({}).then((users) => {
    res.json({ users });

  });
});
router.post("/update-address", async (req, res) => {
  try {
    const { userId, name, addressLine, city, state, pincode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    console.log("update address called with:", req.body)
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.name = name;
    user.address = addressLine;
    user.city = city;
    user.state = state;
    user.pincode = pincode;

    await user.save();

    return res.json({ success: true, message: "Address updated", user });
  } catch (e) {
    console.error("Update address error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
// GET /admin/location-stats
router.get("/location-stats", async (req, res) => {
  try {
    const users = await User.find({}, "city"); // Only fetch city

    const cityMap = {};

    users.forEach((u) => {
      if (!u.city) return;

      // Normalize city name (case-insensitive)
      let city = u.city.trim().toLowerCase();

      // Capitalize first letter
      city = city.charAt(0).toUpperCase() + city.slice(1);

      if (!cityMap[city]) cityMap[city] = 0;
      cityMap[city]++;
    });

    const result = Object.keys(cityMap).map((key) => ({
      location: key,
      count: cityMap[key],
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Location stats error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
// Get only real mobile app users (applicator list)
router.get("/app-users", async (req, res) => {
  try {
    const roles = ["user", "contractor", "customer"];

    const users = await User.find(
      { role: { $in: roles } },
      {
        name: 1,
        mobile: 1,
        address: 1,
        city: 1,
        state: 1,
        role: 1,
        createdAt: 1,
      }
    ).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error("App users fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
router.get("/profile", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const user = await User.findById(userId).select(
      "name mobile address city state pincode role createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
// POST or DELETE /api/delete
// Middleware removed as requested
router.post("/delete", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid userId is required" 
      });
    }

    // Directly delete the user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    return res.json({ 
      success: true, 
      message: "Account deleted successfully" 
    });
  } catch (err) {
    console.error("Deletion error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = router;
