const mongoose = require("mongoose");

const OtpCodeSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },

  code: {
    type: String,
    required: true,
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  attempts: {
    type: Number,
    default: 0,
  },
});

// Auto-delete expired codes
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpCode", OtpCodeSchema);
