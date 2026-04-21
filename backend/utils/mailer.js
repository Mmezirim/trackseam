const nodemailer = require("nodemailer");
 
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});  
 
// Verify the connection configuration once at startup
transporter.verify((err) => {
  if (err) {
    console.warn("[mailer] SMTP connection failed — emails will not be sent:", err.message);
  } else {
    console.log("[mailer] SMTP ready — emails will be delivered via", process.env.MAIL_USER);
  }
});
 
// Email Helpers  
async function sendResetEmail(toEmail, shopName, resetUrl) { 
  const mailOptions = {
    from: `"Trackseam" <${process.env.MAIL_USER}>`,
    to:   toEmail, 
    subject: "Reset your Trackseam password",
 
    // Plain-text fallback for email clients that block HTML
    text: `Hi ${shopName},\n\nYou requested a password reset for your Trackseam account.\n\nClick the link below to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email — your password will not change.\n\n— The Trackseam Team`,
 
    // HTML version
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Reset your password</title>
    </head>
    <body style="margin:0;padding:0;background:#FAFAF8;font-family:Georgia,'Times New Roman',serif;color:#1A1916;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:40px 16px;">
        <tr>
        <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E2E0DC;border-radius:4px;">
    
            <!-- Header -->
            <tr>
                <td style="background:#1A1916;padding:20px 32px;">
                <span style="font-size:20px;font-weight:600;color:#FAFAF8;letter-spacing:0.04em;">✦ Trackseam</span>
                </td>
            </tr>
    
            <!-- Body -->
            <tr>
                <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:22px;font-weight:500;">Reset your password</p>
                <p style="margin:0 0 24px;font-size:15px;color:#706C64;line-height:1.6;">
                    Hi <strong>${shopName}</strong>, we received a request to reset the password for your Trackseam account.
                    Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
                </p>
    
                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                    <tr>
                    <td style="background:#1A1916;border-radius:2px;">
                        <a href="${resetUrl}"
                        style="display:inline-block;padding:12px 28px;font-family:Georgia,serif;font-size:15px;font-weight:500;color:#FAFAF8;text-decoration:none;">
                        Set New Password
                        </a>
                    </td>
                    </tr>
                </table>
    
                <p style="margin:0 0 8px;font-size:13px;color:#A09C94;line-height:1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:12px;word-break:break-all;">
                    <a href="${resetUrl}" style="color:#1A1916;">${resetUrl}</a>
                </p>
    
                <hr style="border:none;border-top:1px solid #E2E0DC;margin:0 0 20px;" />
    
                <p style="margin:0;font-size:13px;color:#A09C94;line-height:1.6;">
                    If you didn't request a password reset, you can safely ignore this email —
                    your password will remain unchanged.
                </p>
                </td>
            </tr>
    
            <!-- Footer -->
            <tr>
                <td style="padding:16px 32px;border-top:1px solid #E2E0DC;">
                <p style="margin:0;font-family:'DM Mono',monospace,sans-serif;font-size:11px;color:#A09C94;letter-spacing:0.06em;text-transform:uppercase;">
                    Trackseam · Client Measurement Records
                </p>
                </td>
            </tr>
    
            </table>
        </td>
        </tr>
    </table>
    </body>
    </html>`,
  };
 
  await transporter.sendMail(mailOptions);
}
 
module.exports = { transporter, sendResetEmail };