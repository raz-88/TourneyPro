// functions/passwordReset.js
// Send custom password reset email via Cloud Function

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Configure your email service (Gmail, SendGrid, etc.)
// For Gmail: enable "Less secure app access"
// For SendGrid: use API key
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,      // Your email
    pass: process.env.EMAIL_PASSWORD,   // App password
  },
});

// Alternative: SendGrid
/*
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
*/

exports.sendPasswordReset = functions.auth.user().onCreate(async (user) => {
  // This won't work for password reset, better to use:
  // 1. Before sign-in (handle password reset manually)
  // 2. Or use a callable function
});

// Better approach: Callable function
exports.sendCustomPasswordReset = functions.https.onCall(async (data, context) => {
  const { email, resetLink } = data;

  if (!email || !resetLink) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and reset link are required');
  }

  try {
    // Read your HTML template
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, '../src/emails/passwordResetTemplate.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders
    htmlContent = htmlContent
      .replace(/%LINK%/g, resetLink)
      .replace(/%EMAIL%/g, email)
      .replace(/%APP_NAME%/g, 'TourneyPro')
      .replace(/%SUPPORT_URL%/g, 'https://support.tourney-pro.com')
      .replace(/%PRIVACY_URL%/g, 'https://tourney-pro.com/privacy');

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset your TourneyPro password',
      html: htmlContent,
    });

    return { success: true, message: 'Password reset email sent' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
