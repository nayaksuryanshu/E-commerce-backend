const nodemailer = require('nodemailer');

const sendEmail = async ({ email, subject, text }) => {
  try {
    // Create transporter - NOTE: it's createTransport, not createTransporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Verify connection configuration
    await transporter.verify();

    // Send email
    const info = await transporter.sendMail({
      from: `"Your App Name" <${process.env.SMTP_EMAIL || process.env.FROM_EMAIL}>`,
      to: email,
      subject,
      text,
    });

    console.log('Email sent successfully:', info.messageId);
    return info;
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = sendEmail;