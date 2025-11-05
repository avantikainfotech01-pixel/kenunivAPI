const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true, // ✅ Replaces "image"
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("News", newsSchema);
