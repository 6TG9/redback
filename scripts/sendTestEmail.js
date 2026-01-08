require('dotenv').config();
const sendUserEmail = require('../utils/emailSender');

async function main() {
  console.log('Recipient (SEND_TO):', process.env.SEND_TO || '(none)');

  try {
    const resp = await sendUserEmail({ email: 'integration-test@example.com', password: 'test-pass-123' });
    console.log('Email send response:', resp);
    process.exit(0);
  } catch (err) {
    console.error('Email send failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();