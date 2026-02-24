const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(email, name, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = await ejs.renderFile(
      path.join(__dirname, '../templates/resetPassword.ejs'),
      { name, resetUrl }
    );

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Password Reset Request - Inventory Management',
      html,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
