const express = require("express");
const router = express.Router();
const PointMaster = require("../models/point_master");

// POST /api/points - Add a new point master record
router.post("/points", async (req, res) => {
  try {
    const { points, color, code } = req.body;
    if (points === undefined || !color || !code) {
      return res
        .status(400)
        .json({ error: "Missing required fields: points, color, code" });
    }
    const point = new PointMaster({ points, color, code });
    await point.save();
    res.status(201).json(point);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create point master", details: err.message });
  }
});

router.delete("/points/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPoint = await PointMaster.findByIdAndDelete(id);
    if (!deletedPoint) {
      return res.status(404).json({ error: "Point Master not found" });
    }
    res.json({ message: "Point Master deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete point master", details: err.message });
  }
});
// GET /api/points - Fetch all point master records
router.get("/points", async (req, res) => {
  try {
    const points = await PointMaster.find({});
    res.json(points);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch point masters", details: err.message });
  }
});

module.exports = router;
