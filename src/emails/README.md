# Email Templates

Professional email templates for TourneyPro.

## Password Reset Email Template

### File
- `passwordResetTemplate.html` - Professional HTML email template for password reset notifications

### How to Use

#### Option 1: Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → **Authentication** → **Templates**
3. Click **Password reset** email
4. Enable custom email and replace the HTML with the content from `passwordResetTemplate.html`
5. Update placeholders with your actual values:
   - `{{USER_NAME}}` - User's name
   - `{{RESET_LINK}}` - Firebase password reset link
   - `{{YEAR}}` - Current year
   - `{{SUPPORT_URL}}` - Your support page URL
   - `{{PRIVACY_URL}}` - Your privacy policy URL
   - `{{TERMS_URL}}` - Your terms of service URL

#### Option 2: Custom Backend with SendGrid/Mailgun

If you want full control over email sending:

1. Create a Cloud Function that sends emails using SendGrid or Mailgun
2. Load the HTML template and replace placeholders
3. Send via your email service

Example with SendGrid:
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendPasswordReset = functions.https.onCall(async (data, context) => {
  const template = fs.readFileSync('./emails/passwordResetTemplate.html', 'utf8');
  const html = template
    .replace('{{USER_NAME}}', data.userName)
    .replace('{{RESET_LINK}}', data.resetLink)
    .replace('{{YEAR}}', new Date().getFullYear());

  await sgMail.send({
    to: data.email,
    from: 'noreply@tourney-pro.com',
    subject: 'Reset your password for TourneyPro',
    html: html,
  });
});
```

### Template Features

✅ **Professional Design** - Modern gradient header with TourneyPro branding  
✅ **Responsive** - Works on desktop and mobile  
✅ **Security Info** - Includes expiration time and security warnings  
✅ **User-Friendly** - Copy-paste link fallback if button doesn't work  
✅ **Troubleshooting** - Includes common issues and solutions  
✅ **Branded Footer** - Links to support, privacy, and terms  

### Customization

You can customize:
- Colors (change `#667eea` and `#764ba2` gradients)
- Font family (currently uses system fonts)
- Links and URLs
- Company name and branding
- Support email address

### Variables to Replace

| Variable | Example |
|----------|---------|
| `{{USER_NAME}}` | John Doe |
| `{{RESET_LINK}}` | https://tourney-pro.com/__/auth/action?mode=resetPassword&... |
| `{{YEAR}}` | 2026 |
| `{{SUPPORT_URL}}` | https://support.tourney-pro.com |
| `{{PRIVACY_URL}}` | https://tourney-pro.com/privacy |
| `{{TERMS_URL}}` | https://tourney-pro.com/terms |
