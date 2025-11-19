const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const qrRoutes = require("./routes/qr");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const walletRoutes = require("./routes/wallet");
const kycRoutes = require("./routes/kyc");
const pointRoutes = require("./routes/point");
const path = require("path");
const cors = require("cors");
dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*",                      // allow all origins
    methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "200mb" })); // for large video uploads
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/", (req, res) => {
  res.send("Welcome to the QR Code API");
});
app.use("/api", qrRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/point", pointRoutes);

app.listen(3000, "0.0.0.0", () => console.log("Server running on port 3000"));
