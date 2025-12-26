import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(req, res) {
  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL,
    to: process.env.SMTP_TO_EMAIL,
    subject: 'Contact from jezzlucena.com',
    text: `Hello!

You received an entry on the contact form at jezzlucena.com, or one of the apps.

Source: ${req.body.source}

First Name: ${req.body.firstName}
Last Name: ${req.body.lastName}

Email: ${req.body.email}
Phone: ${req.body.phone}

Subject: ${req.body.subject}
Message: ${req.body.message}

Kind regards,
Jezz Lucena`,
    replyTo: req.body.email,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json(true);
    console.log(`Email sent successfully from ${req.body.email}.`);
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json(false);
  }
}

export default {
  sendEmail
}
