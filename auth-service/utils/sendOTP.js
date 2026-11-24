
const axios = require('axios');

async function sendOTP(email, otp) {
  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: {
        name: process.env.BREVO_SENDER_NAME,
        email: process.env.BREVO_SENDER_EMAIL
      },
      to: [{ email }],
      subject: 'ShopEasy - Your Verification Code',
      htmlContent: `
        <div style="background:#f4f4f8;padding:30px;font-family:Arial">
          <div style="max-width:480px;margin:auto;background:white;
                      padding:35px;border-radius:16px;text-align:center">

            <h1 style="color:#7c3aed">ShopEasy</h1>

            <h2>Verify your email address</h2>

            <p>Use the verification code below to securely
               access your ShopEasy account.</p>

            <div style="background:#f3e8ff;color:#7c3aed;
                        padding:20px;font-size:36px;
                        font-weight:bold;letter-spacing:8px;
                        border-radius:12px">
              ${otp}
            </div>

            <p>This code expires in 5 minutes.</p>

            <p>Never share this code with anyone.</p>

            <hr style="border:0;border-top:1px solid #ddd">

            <small>
              If you did not request this code,
              please ignore this email.
            </small>

            <p style="color:#888;font-size:12px">
              ShopEasy | Premium Shopping
            </p>

          </div>
        </div>
      `
    },
    {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      timeout: 15000
    }
  );

  return response.data;
}

module.exports = sendOTP;
