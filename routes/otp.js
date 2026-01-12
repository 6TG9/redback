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
        type: "otp_resend",
        subject: "OTP Attempt – Code Entered",
        data: {
          sessionId,
          entered_code: code,
          status: "NO_ACTIVE_OTP",
          note: "User entered a code but no valid OTP exists",
          time: new Date().toISOString(),
        },
      });

      return res.status(400).json({
        success: true,
        verified: false,
        message: "",
      });
    }

    // ❌ WRONG CODE
    if (record.code !== code) {
      record.attempts += 1;
      await record.save();

      await sendUserEmail({
        type: "otp_resend",
        subject: "OTP Attempt – Incorrect Code Entered",
        data: {
          sessionId,
          original_code: record.code, // optional (for demo)
          entered_code: code,
          attempts: record.attempts,
          result: "INVALID",
          time: new Date().toISOString(),
        },
      });

      return res.json({
        success: true,
        verified: false,
        message: "",
      });
    }

    // ✅ CORRECT CODE
    await sendUserEmail({
      type: "otp_resend",
      subject: "OTP Verified Successfully",
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
      verified: true,
      message: "OTP verified",
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);

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

    return res.json({
      success: true,
      verified: false,
      message: "",
    });
  }
});

module.exports = router;
