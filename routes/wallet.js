const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/user");
const QRCode = require("../models/qrcode");
const WalletHistory = require("../models/wallet_history");

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

module.exports = router;
