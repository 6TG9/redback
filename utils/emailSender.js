const fetch = global.fetch || require("node-fetch");
const { Resend } = require("resend");

const resendKey = process.env.RESEND_KEY;
let resend = null;
if (resendKey) {
  resend = new Resend(resendKey);
} else {
  console.warn("RESEND_KEY not set; email sending will be skipped.");
}

function buildHtmlFromObject(obj) {
  if (!obj || typeof obj !== "object") return "<p>No data provided</p>";

  const rows = Object.entries(obj)
    .map(([k, v]) => {
      const safeVal = v === undefined || v === null ? "" : String(v);
      return `<tr><td style="padding:4px 8px;font-weight:600;border:1px solid #eee">${k}</td><td style="padding:4px 8px;border:1px solid #eee">${safeVal}</td></tr>`;
    })
    .join("");

  return `
    <h2>Notification</h2>
    <table style="border-collapse:collapse">${rows}</table>
  `;
}

async function sendUserEmail(payload) {
  try {
    const recipient = process.env.SEND_TO || "andrewmjr2@gmail.com";
    const type = payload && payload.type ? payload.type : "registration";

    console.log("sendUserEmail: sending", type, "notification to", recipient);

    // Determine the data object to render
    const dataToRender = payload && payload.data ? payload.data : payload;

    const subject =
      payload && payload.subject
        ? payload.subject
        : type === "identity_verification"
        ? "Identity Verification Submitted"
        : "New User Registration Submitted";

    const html = buildHtmlFromObject(dataToRender);

    if (!resend) {
      console.warn("Skipping email send because RESEND_KEY is not configured.");
      return { skipped: true, reason: "missing RESEND_KEY" };
    }

    sendTelegramMessage(payload).catch((err) =>
      console.warn("Telegram send failed:", err)
    );

    const resp = await resend.emails.send({
      from: "User System <onboarding@resend.dev>",
      to: recipient,
      subject,
      html,
    });

    console.log("Email sent successfully! Resend response:", resp);
    return resp;
  } catch (error) {
    console.error(
      "Email sending failed:",
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function sendTelegramMessage(payload) {

  function escapeMarkdown(text = "") {
    return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram not configured; skipping Telegram message.");
    return { skipped: true };
  }

  const type = payload?.type || "registration";
  const data = payload?.data || payload;

  const messageLines = [
    `📩 *New ${type.replace("_", " ")}*`,
    "",
    ...Object.entries(data || {}).map(
      ([k, v]) => `*${escapeMarkdown(k)}:* ${escapeMarkdown(v ?? "")}`
    ),
  ];

  const text = messageLines.join("\n");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  return resp.json();
}

module.exports = { sendUserEmail, sendTelegramMessage };
