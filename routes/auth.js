const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const verifyToken = require("../middleware/auth");
const crypto = require("crypto");
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
  const { name, mobile, email, password, address, state, city, role } =
    req.body;

  if (!mobile) {
    return res.status(400).json({ error: "Mobile is required" });
  }

  const existingMobile = await User.findOne({ mobile });
  if (existingMobile) {
    return res.status(400).json({ error: "Mobile already registered" });
  }

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    mobile,
    email,
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

module.exports = router;
