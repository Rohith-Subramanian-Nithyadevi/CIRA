import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export const sendVerificationEmail = async (to: string, code: string) => {
  if (!transporter) {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Use real SMTP (e.g., Gmail) if credentials are provided in .env
      transporter = nodemailer.createTransport({
        service: 'gmail', // or your provider
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Fallback: Generate test account for local development
      console.log('No SMTP credentials found in .env, falling back to Ethereal Email');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  }

  const info = await transporter.sendMail({
    from: '"CIRA Platform" <noreply@cira-platform.edu>',
    to,
    subject: 'Your CIRA Verification Code',
    text: `Your verification code is: ${code}. It will expire in 10 minutes.`,
    html: `<b>Your verification code is: ${code}</b><br/>It will expire in 10 minutes.`,
  });

  console.log('Verification email sent: %s', info.messageId);
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // Useful for testing without real email
};
