const express = require("express");
const { body, validationResult } = require("express-validator");
const sendUserEmail = require("../utils/emailSender");

const router = express.Router();

router.post("/", [
  body("fullName").trim().notEmpty(),
  body("dob").isISO8601(),
  body("ssn").matches(/^\d{3}-\d{2}-\d{4}$/),
  body("phone")
    .customSanitizer((v) => v.replace(/\D/g, ""))
    .isLength({ min: 10, max: 10 }),
  body("zip").isPostalCode("US"),
  body("email").isEmail(),
], async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const data = req.body;

  await sendUserEmail({
    type: "identity_verification",
    subject: "Identity Verification Submitted",
    data,
  });

  return res.json({ success: true });
});

module.exports = router;
