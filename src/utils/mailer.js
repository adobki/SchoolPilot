/* eslint-disable import/no-extraneous-dependencies */
const nodemailer = require('nodemailer');

class MailClient {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'schoolpilot.mgt@gmail.com',
        pass: 'fvhn lfcb upap wcob',
      },
    });
  }

  async sendToken(obj) {
    try {
      let additionalInfo = '';
      if (obj.role === 'student') {
        additionalInfo = `<p><strong>Matriculation Number:</strong> ${obj.matricNo}</p>`;
      } else {
        additionalInfo = `<p><strong>Staff ID:</strong> ${obj.staffId}</p>`;
      }
      const info = await this.transporter.sendMail({
        from: 'schoolpilot.mgt@gmail.com',
        to: obj.email,
        subject: 'Activation Profile Token',
        html: `
          <p>Dear ${obj.firstName},</p>
          <p>To complete your registration, please use the following activation token:</p>
          <p><strong>Activation Token:</strong> ${obj.resetOTP}</p>
          <p><strong>${additionalInfo}</p>
          <p>Use this token only once. Do not share it with anyone.</p>
          <p>This token is valid for 5 minutes. If you did not request this token, please ignore this email.</p>
          <p>Thank you for choosing SchoolPilot. If you have any questions, feel free to contact us.</p>
          <p>Best regards,</p>
          <p>The SchoolPilot Team</p>
        `,
      });
      console.log('Message sent: %s', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
}

const mailClient = new MailClient();
module.exports = mailClient;
