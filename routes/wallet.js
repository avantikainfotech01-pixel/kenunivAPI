const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/user");
const QRCode = require("../models/qrcode");
const WalletHistory = require("../models/wallet_history");
const Scheme = require("../models/scheme");
const Stock = require("../models/stock");
const RedeemHistory = require("../models/redeem_model");
/**
 * Helper function to get last wallet balance
 */
const getLastBalance = async (userId) => {
  const lastTx = await WalletHistory.findOne({ userId }).sort({ date: -1 });
  return lastTx ? lastTx.balanceAfter : 0;
};

// // ✅ Redeem Product API
// router.post("/redeem", async (req, res) => {
//   try {
//     const { userId, schemeId, address, location } = req.body;

//     // --- VALIDATION ---
//     if (!userId || !schemeId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId and schemeId are required",
//       });
//     }

//     // --- Fetch User ---
//     const user = await User.findById(userId);
//     if (!user)
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });

//     // --- Fetch Product/Scheme ---
//     const scheme = await Scheme.findById(schemeId);
//     if (!scheme)
//       return res.status(404).json({
//         success: false,
//         message: "Scheme not found",
//       });

//     const productPoints = scheme.points;

//     // --- Calculate Wallet Balance ---
//     const walletHistory = await Wallet.find({ userId });

//     let walletBalance = walletHistory.reduce((sum, tx) => {
//       return tx.type === "credit" ? sum + tx.points : sum - tx.points;
//     }, 0);

//     if (walletBalance < productPoints) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient balance",
//       });
//     }

//     // --- Check stock ---
//     const stock = await Stock.findOne({ schemeId });
//     if (!stock || stock.quantity <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Stock not available",
//       });
//     }

//     // --- Deduct stock ---
//     stock.quantity -= 1;
//     await stock.save();

//     // --- Deduct final wallet balance ---
//     const finalBalance = walletBalance - productPoints;

//     // Update actual user balance also
//     user.walletBalance = finalBalance;
//     await user.save();

//     const walletEntry = new WalletHistory({
//       userId,
//       points: productPoints,
//       type: "debit",
//       balanceAfter: finalBalance,
//       description: `Redeemed ${scheme.productName}`,
//       date: new Date(),
//     });

//     await walletEntry.save();

//     // --- Save redeem history ---
//     const redeemEntry = new RedeemHistory({
//       userId,
//       schemeId,
//       pointsUsed: productPoints,
//       address,
//       location,
//     });

//     await redeemEntry.save();

//     return res.json({
//       success: true,
//       message: "Redeemed successfully",
//       walletBalance: walletBalance - productPoints,
//       stockLeft: stock.quantity,
//       redeem: redeemEntry,
//     });

//   } catch (err) {
//     console.log("Redeem Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: err.message,
//     });
//   }
// });

// ----------------------------------------------------
// POST /wallet/redeem (DEBIT TRANSACTION)
// ----------------------------------------------------
router.post("/redeem", async (req, res) => {
  try {
    const { userId, schemeId, address, location } = req.body;

    if (!userId || !schemeId) {
      return res.status(400).json({
        success: false,
        message: "userId and schemeId are required",
      });
    }

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const scheme = await Scheme.findById(schemeId);
    if (!scheme)
      return res.status(404).json({ success: false, message: "Scheme not found" });

    const productPoints = scheme.points;

    const lastBalance = await getLastBalance(userId);
    if (lastBalance < productPoints) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const stock = await Stock.findOne({ schemeId });
    if (!stock || stock.quantity <= 0) {
      return res.status(400).json({ success: false, message: "Stock not available" });
    }

    stock.quantity -= 1;
    await stock.save();

    const newBalance = lastBalance - productPoints;
    user.walletBalance = newBalance;
    await user.save();

    await new WalletHistory({
      userId,
      points: productPoints,
      type: "debit",
      balanceAfter: newBalance,
      description: `Redeemed ${scheme.productName}`,
      date: new Date(),
    }).save();

    const redeemEntry = new RedeemHistory({
      userId,
      schemeId,
      pointsUsed: productPoints,
      address,
      location,
    });

    await redeemEntry.save();

    res.json({
      success: true,
      message: "Redeemed successfully",
      walletBalance: newBalance,
      stockLeft: stock.quantity,
      redeem: redeemEntry,
    });

  } catch (err) {
    console.log("Redeem Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ------------------------
// GET /wallet/redeem-history (Admin)
// ------------------------
router.get("/redeem-history", async (req, res) => {
  try {
    const history = await RedeemHistory.find()
      .populate("userId", "name mobile address city state pincode")
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
// PATCH /wallet/redeem-history/:id/approve  → Approve a redemption
// ------------------------
router.patch("/redeem-history/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid redeem ID" });
    }

    const redeemEntry = await RedeemHistory.findById(id);
    if (!redeemEntry) {
      return res.status(404).json({ success: false, message: "Redeem entry not found" });
    }

    // Update status to approved
    redeemEntry.status = "approved";
    await redeemEntry.save();

    res.json({ success: true, message: "Redemption approved", redeem: redeemEntry });
  } catch (err) {
    console.error("Approve redeem error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});
// // ------------------------
// // POST /wallet/scan
// // ------------------------
// router.post("/scan", async (req, res) => {
//   try {
//     const { qrText, userId } = req.body;
//     console.log(userId);

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid userId" });
//     }

//     const user = await User.findById(userId);
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });

//     const qr = await QRCode.findOne({ qrText });
//     if (!qr)
//       return res.status(404).json({ success: false, message: "QR not found" });
//     if (!qr.active) return res.json({ success: false, message: "QR inactive" });
//     if (qr.used)
//       return res.json({ success: false, message: "QR already used" });

//     // Add points to user wallet
//     user.walletBalance = (user.walletBalance || 0) + qr.points;
//     await user.save();

//     // Save wallet history with required fields
//     const history = new WalletHistory({
//       userId,
//       points: qr.points,
//       type: "credit",
//       balanceAfter: user.walletBalance,
//       date: new Date(),
//     });
//     await history.save();

//     // Mark QR as used
//     qr.used = true;
//     qr.active = false;
//     await qr.save();

//     // Fetch updated wallet history
//     const walletHistory = await WalletHistory.find({ userId }).sort({
//       date: -1,
//     });

//     res.json({
//       success: true,
//       message: `${qr.points} points added to wallet`,
//       data: { balance: user.walletBalance, history: walletHistory },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });
// ----------------------------------------------------
// POST /wallet/scan (CREDIT TRANSACTION)
// ----------------------------------------------------
router.post("/scan", async (req, res) => {
  try {
    const { qrText, userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const qr = await QRCode.findOne({ qrText });
    if (!qr) return res.status(404).json({ success: false, message: "QR not found" });
    if (!qr.active) return res.json({ success: false, message: "QR inactive" });
    if (qr.used) return res.json({ success: false, message: "QR already used" });

    const lastBalance = await getLastBalance(userId);
    const newBalance = lastBalance + qr.points;

    user.walletBalance = newBalance;
    await user.save();

    await new WalletHistory({
      userId,
      points: qr.points,
      type: "credit",
      balanceAfter: newBalance,
      date: new Date(),
      description: `QR Scan +${qr.points} points`
    }).save();

    qr.used = true;
    qr.active = false;
    await qr.save();

    const walletHistory = await WalletHistory.find({ userId }).sort({ date: -1 });

    res.json({
      success: true,
      message: `${qr.points} points added to wallet`,
      data: { balance: newBalance, history: walletHistory },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// // ------------------------
// // POST /wallet/add
// // ------------------------
// router.post("/add", async (req, res) => {
//   try {
//     const { userId, points, description } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid userId" });
//     }

//     if (!points)
//       return res
//         .status(400)
//         .json({ success: false, message: "Points are required" });

//     const user = await User.findById(userId);
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });

//     user.walletBalance = (user.walletBalance || 0) + points;
//     await user.save();

//     const history = new WalletHistory({
//       userId,
//       points,
//       type: "credit",
//       balanceAfter: user.walletBalance,
//       description,
//       date: new Date(),
//     });
//     await history.save();

//     const walletHistory = await WalletHistory.find({ userId }).sort({
//       date: -1,
//     });

//     res.json({
//       success: true,
//       message: `${points} points added to wallet`,
//       data: { balance: user.walletBalance, history: walletHistory },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });
// ----------------------------------------------------
// POST /wallet/add (ADMIN CREDIT)
// ----------------------------------------------------
router.post("/add", async (req, res) => {
  try {
    const { userId, points, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Invalid userId" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const lastBalance = await getLastBalance(userId);
    const newBalance = lastBalance + points;

    user.walletBalance = newBalance;
    await user.save();

    await new WalletHistory({
      userId,
      points,
      type: "credit",
      balanceAfter: newBalance,
      description: description || "Added by Admin",
      date: new Date(),
    }).save();

    const walletHistory = await WalletHistory.find({ userId }).sort({ date: -1 });

    res.json({
      success: true,
      message: `${points} points added to wallet`,
      data: { balance: newBalance, history: walletHistory },
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
// // ------------------------
// // GET /wallet/all-history  → For Admin Panel
// // ------------------------
// router.get("/all-history", async (req, res) => {
//   try {
//     const allHistory = await WalletHistory.find()
//       .populate("userId", "name mobile")
//       .sort({ date: -1 });

//     if (!allHistory.length) {
//       return res.json({
//         success: true,
//         message: "No wallet history found",
//         data: [],
//       });
//     }

//     res.json({
//       success: true,
//       data: allHistory.map((item) => ({
//         _id: item._id,
//         userName: item.userId?.name || "Unknown User",
//         userMobile: item.userId?.mobile || "N/A",
//         points: item.points,
//         type: item.type,
//         balanceAfter: item.balanceAfter,
//         description: item.description || "-",
//         date: item.date,
//       })),
//     });
//   } catch (err) {
//     console.error("Error fetching all wallet history:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });
// ----------------------------------------------------
// GET /wallet/all-history (ADMIN PANEL)
// ----------------------------------------------------
router.get("/all-history", async (req, res) => {
  try {
    const allHistory = await WalletHistory.find()
      .populate("userId", "name mobile")
      .sort({ date: -1 });

    res.json({
      success: true,
      data: allHistory.map((item) => ({
        _id: item._id,
        userName: item.userId?.name || "Unknown User",
        userMobile: item.userId?.mobile || "---",
        points: item.points,
        type: item.type,
        balanceAfter: item.balanceAfter,
        description: item.description || "-",
        date: item.date,
      })),
    });

  } catch (err) {
    console.error("Error fetching all wallet history:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
router.get("/wallet/admin/dashboard-stats", async (req, res) => {
  try {

    // Only contractor count (if needed change role value)
    const totalUsers = await User.countDocuments({
      role: "contractor"
    });

    // Remaining stock based on current Stock collection only
    const stockData = await Stock.aggregate([
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$quantity" }
        }
      }
    ]);

    const remainingStock =
      stockData.length > 0 ? stockData[0].totalStock : 0;

  const walletData = await User.aggregate([
  {
    $group: {
      _id: null,
      totalWallet: { $sum: "$walletBalance" }
    }
  }
]);

const walletAmount =
  walletData.length > 0 ? walletData[0].totalWallet : 0;

    // Total redemption point or amount
    const redeemData = await RedeemHistory.aggregate([
      {
        $group: {
          _id: null,
          totalRedeemed: { $sum: "$pointsUsed" }
        }
      }
    ]);

    const redemptionAmount =
      redeemData.length > 0 ? redeemData[0].totalRedeemed : 0;

    return res.json({
      success: true,
      data: {
        remainingStock,
        totalUsers,
        walletAmount,
        redemptionAmount
      }
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
});
module.exports = router;
