const { Resend } = require("resend");

const resend = process.env.RESEND_KEY
  ? new Resend(process.env.RESEND_KEY)
  : null;

function buildHtmlFromObject(obj) {
  return `
    <h2>Identity Verification Submission</h2>
    <table border="1" cellpadding="6">
      ${Object.entries(obj)
        .map(
          ([k, v]) =>
            `<tr><td><strong>${k}</strong></td><td>${v ?? ""}</td></tr>`
        )
        .join("")}
    </table>
  `;
}

async function sendUserEmail({ data, subject }) {
  if (!resend) return;

  return resend.emails.send({
    from: "User System <onboarding@resend.dev>",
    to: process.env.SEND_TO,
    subject,
    html: buildHtmlFromObject(data),
  });
}

module.exports = sendUserEmail;
