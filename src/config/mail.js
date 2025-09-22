const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 1025, // MailHog default
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

const sendEmail = async ({ to, subject, html }) => {
    await mailer.sendMail({
        from: '"Inpetum Support" <no-reply@inpetum.com>',
        to,
        subject,
        html
    });
};

module.exports = { sendEmail };
