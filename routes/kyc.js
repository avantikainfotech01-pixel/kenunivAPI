const express = require("express");
const multer = require("multer");
const path = require("path");
const KycDocument = require("../models/kycDocument");
const User = require("../models/user");
const mongoose = require("mongoose");
const fs = require('fs');
const router = express.Router();

const imageUrl = (req, filename) => {
  if (!filename) return "";
  const protocol = (req.get("x-forwarded-proto") || req.protocol)
    .split(",")[0]
    .trim();
  const host = (req.get("x-forwarded-host") || req.get("host"))
    .split(",")[0]
    .trim();
  return `${protocol}://${host}/uploads/kyc/${filename}`;
};

const withImageUrls = (req, document) => {
  const data = document.toObject ? document.toObject() : document;
  return {
    ...data,
    frontImageUrl: imageUrl(req, data.frontImage),
    backImageUrl: imageUrl(req, data.backImage),
  };
};

const nonEmpty = (...values) => {
  for (const value of values) {
    const text = value?.toString().trim() || "";
    if (text && text !== "Not provided") return text;
  }
  return "Not provided";
};

const withUserDetails = (req, document) => {
  const data = document.toObject ? document.toObject() : document;
  const populatedUser = data.userId?._id ? data.userId : null;
  const profileAddress = populatedUser
    ? [
        populatedUser.address,
        populatedUser.city,
        populatedUser.state,
        populatedUser.pincode,
      ]
        .map((part) => part?.toString().trim())
        .filter(Boolean)
        .join(", ")
    : "";
  const name = nonEmpty(populatedUser?.name, data.name);
  const mobile = nonEmpty(populatedUser?.mobile, data.mobile);
  const address = nonEmpty(profileAddress, data.address);

  return withImageUrls(req, {
    ...data,
    name,
    mobile,
    address,
    userId: populatedUser
      ? {
          ...populatedUser,
          _id: populatedUser._id,
          name,
          mobile,
          address,
        }
      : data.userId,
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "kyc");

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});
router.post(
  "/upload",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { documentType, userId, name, mobile, address: requestAddress } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }
      if (!["aadhar", "pan"].includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: "Document type must be aadhar or pan",
        });
      }
      if (!req.files?.front?.[0] || !req.files?.back?.[0]) {
        return res.status(400).json({
          success: false,
          message: "Both front and back images are required",
        });
      }

      const user = await User.findById(userId).select(
        "name mobile address city state pincode"
      );
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const frontImage = req.files["front"][0].filename;
      const backImage = req.files["back"][0].filename;
      const profileAddress = [user.address, user.city, user.state, user.pincode]
        .filter(Boolean)
        .join(", ");

      const kyc = new KycDocument({
        userId,
        documentType,
        name: user.name || name || "Not provided",
        mobile: user.mobile || mobile || "Not provided",
        address: profileAddress || requestAddress || "Not provided",
        frontImage,
        backImage,
      });

      await kyc.save();

      res.status(200).json({
        success: true,
        message: "Your verification is sent to admin",
        data: withUserDetails(req, kyc),
      });
    } catch (err) {
      console.error("KYC upload error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
router.get("/user/:id", async (req, res) => {
  try {
    const kyc = await KycDocument.findOne({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .populate("userId", "name mobile address city state pincode");

    if (!kyc) {
      return res.json({ success: true, data: { status: "none" } });
    }

    res.json({ success: true, data: withUserDetails(req, kyc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// PUT /kyc/status/:id
router.put("/status/:id", async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid KYC status" });
    }
    const kyc = await KycDocument.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC document not found" });
    }
    await kyc.populate("userId", "name mobile address city state pincode");
    res.json({ success: true, data: withUserDetails(req, kyc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET UNIQUE LATEST KYC PER USER (ADMIN)
router.get("/admin/kyc", async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const pipeline = [
      { $sort: { createdAt: -1 } }, // latest first
      {
        $group: {
          _id: "$userId",
          latest: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$latest" } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          userId: {
            _id: "$userId",
            name: { $ifNull: ["$user.name", "$name"] },
            mobile: { $ifNull: ["$user.mobile", "$mobile"] },
            address: { $ifNull: ["$user.address", "$address"] },
            city: "$user.city",
            state: "$user.state",
            pincode: "$user.pincode",
          },
        },
      },
      { $project: { user: 0 } },
    ];

    const [result] = await KycDocument.aggregate([
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          meta: [{ $count: "total" }],
        },
      },
    ]);
    const total = result.meta[0]?.total || 0;
    const list = result.data.map((item) => withUserDetails(req, item));

    res.json({
      success: true,
      data: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
