import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key');

export const sendVerificationEmail = async (to: string, code: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ WARNING: RESEND_API_KEY is missing from .env. The email will likely fail to send.');
  }

  try {
    const data = await resend.emails.send({
      from: 'CIRA Platform <noreply@ganathavinash.site>', 
      to,
      subject: 'Verify your CIRA account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e293b; text-align: center;">Welcome to CIRA</h2>
          <p style="color: #475569; font-size: 16px;">Thank you for registering. Please use the verification code below to complete your sign-up process:</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="color: #475569; font-size: 14px;">This code will expire shortly. If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">CIRA Centralized Access Portal</p>
        </div>
      `,
    });

    if (data.error) {
      console.error('Resend API Error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('✅ Verification email sent via Resend API to:', to);
    return data;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
};

export const sendAdminApprovalRequestEmail = async (
  adminEmail: string,
  facultyDetails: { name: string; email: string; employeeId: string; subject: string }
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ WARNING: RESEND_API_KEY is missing from .env. The email will likely fail to send.');
  }

  try {
    const data = await resend.emails.send({
      from: 'CIRA Platform <noreply@ganathavinash.site>',
      to: adminEmail,
      subject: 'New Faculty Account Pending Approval',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e293b; text-align: center;">Faculty Approval Request</h2>
          <p style="color: #475569; font-size: 16px;">A new faculty account has registered and is pending approval:</p>
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Name:</strong> ${facultyDetails.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${facultyDetails.email}</p>
            <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${facultyDetails.employeeId}</p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${facultyDetails.subject}</p>
          </div>
          <p style="color: #475569; font-size: 14px;">Please sign in to the Admin Dashboard to approve or reject this request.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">CIRA Centralized Access Portal</p>
        </div>
      `,
    });

    if (data.error) {
      console.error('Resend API Error (Admin Notification):', data.error);
      throw new Error(data.error.message);
    }

    console.log('✅ Admin approval request email sent via Resend API to:', adminEmail);
    return data;
  } catch (error) {
    console.error('Failed to send admin approval request email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (to: string, code: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ WARNING: RESEND_API_KEY is missing from .env. The email will likely fail to send.');
  }

  try {
    const data = await resend.emails.send({
      from: 'CIRA Platform <noreply@ganathavinash.site>',
      to,
      subject: 'Reset your CIRA account password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e293b; text-align: center;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 16px;">We received a request to reset your password. Use the verification code below to proceed with the reset:</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #b91c1c; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="color: #475569; font-size: 14px;">This code will expire shortly. If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">CIRA Centralized Access Portal</p>
        </div>
      `,
    });

    if (data.error) {
      console.error('Resend API Error (Password Reset):', data.error);
      throw new Error(data.error.message);
    }

    console.log('✅ Password reset email sent via Resend API to:', to);
    return data;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
};

