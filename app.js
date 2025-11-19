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
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With"
    ],
  })
);

// Required for browsers preflight OPTIONS
app.options("*", cors());

app.use(
  express.json({
    limit: "200mb",
  })
);

app.use(
  express.urlencoded({
    limit: "200mb",
    extended: true,
    parameterLimit: 50000,
  })
);


mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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
