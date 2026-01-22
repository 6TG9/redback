// models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    ipAddress: String,
    userAgent: String,
    host: String,
    isp: String,
    submittedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
