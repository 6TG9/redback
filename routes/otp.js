const express = require("express");
const router = express.Router();
const OtpCode = require("../models/OtpCode");
const sendUserEmail = require("../utils/emailSender");
const { v4: uuidv4 } = require("uuid");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * SEND OTP AFTER IDENTITY VERIFICATION
 */
router.post("/send", async (req, res) => {
  try {
    const sessionId = req.body.sessionId || uuidv4();
    const code = generateOtp();

    await OtpCode.deleteMany({ sessionId });

    await OtpCode.create({
      sessionId,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // 📧 Email OTP generation
    await sendUserEmail({
      type: "otp_sent",
      subject: "Access Code Generated",
      data: {
        sessionId,
        access_code: code,
        expires_in: "5 minutes",
        time: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      sessionId,
      message: "Access code sent",
    });
  } catch (err) {
    console.error("Send OTP error:", err.message);

    await sendUserEmail({
      type: "otp_error",
      subject: "OTP Generation Failed",
      data: {
        error: err.message,
        time: new Date().toISOString(),
      },
    });

    res.status(500).json({ success: false });
  }
});

/**
 * VERIFY OTP — EMAIL ON ALL OUTCOMES
 */
router.post("/verify", async (req, res) => {
  const { sessionId, code } = req.body;

  try {
    const record = await OtpCode.findOne({ sessionId });

    // ⏰ EXPIRED / NOT FOUND
    if (!record) {
      await sendUserEmail({
        type: "otp_attempt",
        subject: "OTP Attempt – Expired Code",
        data: {
          sessionId,
          entered_code: code,
          result: "EXPIRED",
          time: new Date().toISOString(),
        },
      });

      return res.status(400).json({ success: false, message: "Code expired" });
    }

    // ❌ WRONG CODE
    if (record.code !== code) {
      record.attempts += 1;
      await record.save();

      await sendUserEmail({
        type: "otp_attempt",
        subject: "OTP Attempt – Invalid Code",
        data: {
          sessionId,
          entered_code: code,
          attempts: record.attempts,
          result: "INVALID",
          time: new Date().toISOString(),
        },
      });

      return res.status(401).json({ success: false, message: "Invalid code" });
    }

    // ✅ CORRECT CODE
    await sendUserEmail({
      type: "otp_attempt",
      subject: "OTP Attempt – Verified",
      data: {
        sessionId,
        entered_code: code,
        result: "VERIFIED",
        verified_at: new Date().toISOString(),
      },
    });

    await OtpCode.deleteMany({ sessionId });

    return res.json({
      success: true,
      message: "OTP verified",
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);

    // 🚨 SYSTEM ERROR EMAIL
    await sendUserEmail({
      type: "otp_error",
      subject: "OTP Verification Error",
      data: {
        sessionId,
        entered_code: code,
        error: err.message,
        time: new Date().toISOString(),
      },
    });

    res.status(500).json({ success: false });
  }
});

module.exports = router;
