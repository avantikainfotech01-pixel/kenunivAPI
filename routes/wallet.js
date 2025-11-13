const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/user");
const QRCode = require("../models/qrcode");
const WalletHistory = require("../models/wallet_history");
const Scheme = require("../models/scheme");
const RedeemHistory = require("../models/redeem_model");

// ------------------------
// POST /wallet/redeem
// ------------------------
router.post("/redeem", async (req, res) => {
  try {
    const { userId, schemeId, qrSerial } = req.body;
    console.log("Redeem Request Body:", req.body); // 👈 ADD THIS
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(schemeId)
    ) {
      console.log("Invalid IDs received:", { userId, schemeId });
      return res.status(400).json({ success: false, message: "Invalid IDs" });
    }

    const user = await User.findById(userId);
    const scheme = await Scheme.findById(schemeId);

    if (!user || !scheme) {
      return res
        .status(404)
        .json({ success: false, message: "User or Scheme not found" });
    }

    // ✅ Recalculate total wallet points from WalletHistory to ensure accuracy
    const allHistory = await WalletHistory.find({ userId });
    let totalPoints = 0;
    for (const h of allHistory) {
      totalPoints += h.type === "credit" ? h.points : -h.points;
    }

    // Update user's walletBalance for consistency
    user.walletBalance = totalPoints;
    await user.save();

    // Check again if user has enough points
    if (user.walletBalance < scheme.points) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient points to redeem" });
    }

    // Deduct points from wallet
    user.walletBalance -= scheme.points;
    await user.save();

    // Add redeem entry
    const redeem = new RedeemHistory({
      userId,
      schemeId,
      pointsUsed: scheme.points,
      qrSerial,
      status: "approved",
    });
    await redeem.save();

    // Add wallet debit entry
    const history = new WalletHistory({
      userId,
      points: scheme.points,
      type: "debit",
      balanceAfter: user.walletBalance,
      description: `Redeemed ${scheme.schemeName}`,
      date: new Date(),
    });
    await history.save();

    res.json({
      success: true,
      message: "Redemption successful",
      data: { balance: user.walletBalance, redeem },
    });
  } catch (err) {
    console.error("Redeem Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// GET /wallet/redeem-history (Admin)
// ------------------------
router.get("/redeem-history", async (req, res) => {
  try {
    const history = await RedeemHistory.find()
      .populate("userId", "name mobile")
      .populate("schemeId", "schemeName productName points")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: history });
  } catch (err) {
    console.error("Fetch Redeem Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// GET /wallet/redeem-history/:userId (User)
// ------------------------
router.get("/redeem-history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });

    const history = await RedeemHistory.find({ userId })
      .populate("schemeId", "schemeName productName points")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: history });
  } catch (err) {
    console.error("Fetch Redeem User Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// POST /wallet/scan
// ------------------------
router.post("/scan", async (req, res) => {
  try {
    const { qrText, userId } = req.body;
    console.log(userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const qr = await QRCode.findOne({ qrText });
    if (!qr)
      return res.status(404).json({ success: false, message: "QR not found" });
    if (!qr.active) return res.json({ success: false, message: "QR inactive" });
    if (qr.used)
      return res.json({ success: false, message: "QR already used" });

    // Add points to user wallet
    user.walletBalance = (user.walletBalance || 0) + qr.points;
    await user.save();

    // Save wallet history with required fields
    const history = new WalletHistory({
      userId,
      points: qr.points,
      type: "credit",
      balanceAfter: user.walletBalance,
      date: new Date(),
    });
    await history.save();

    // Mark QR as used
    qr.used = true;
    qr.active = false;
    await qr.save();

    // Fetch updated wallet history
    const walletHistory = await WalletHistory.find({ userId }).sort({
      date: -1,
    });

    res.json({
      success: true,
      message: `${qr.points} points added to wallet`,
      data: { balance: user.walletBalance, history: walletHistory },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// POST /wallet/add
// ------------------------
router.post("/add", async (req, res) => {
  try {
    const { userId, points, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    if (!points)
      return res
        .status(400)
        .json({ success: false, message: "Points are required" });

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.walletBalance = (user.walletBalance || 0) + points;
    await user.save();

    const history = new WalletHistory({
      userId,
      points,
      type: "credit",
      balanceAfter: user.walletBalance,
      description,
      date: new Date(),
    });
    await history.save();

    const walletHistory = await WalletHistory.find({ userId }).sort({
      date: -1,
    });

    res.json({
      success: true,
      message: `${points} points added to wallet`,
      data: { balance: user.walletBalance, history: walletHistory },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// GET /wallet/history
// ------------------------
router.get("/history", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const walletHistory = await WalletHistory.find({ userId }).sort({
      date: -1,
    });

    res.json({
      success: true,
      data: walletHistory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------------
// GET /wallet/points
// ------------------------
router.get("/points", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({
      success: true,
      data: { walletBalance: user.walletBalance || 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ------------------------
// GET /wallet/all-history  → For Admin Panel
// ------------------------
router.get("/all-history", async (req, res) => {
  try {
    const allHistory = await WalletHistory.find()
      .populate("userId", "name mobile")
      .sort({ date: -1 });

    if (!allHistory.length) {
      return res.json({
        success: true,
        message: "No wallet history found",
        data: [],
      });
    }

    res.json({
      success: true,
      data: allHistory.map((item) => ({
        _id: item._id,
        userName: item.userId?.name || "Unknown User",
        userMobile: item.userId?.mobile || "N/A",
        points: item.points,
        type: item.type,
        balanceAfter: item.balanceAfter,
        description: item.description || "-",
        date: item.date,
      })),
    });
  } catch (err) {
    console.error("Error fetching all wallet history:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
