// src/utils/sendEmail.js
const transporter = require('./mailer');

async function sendEmail({ to, subject, html }) {
    try {
        await transporter.sendMail({
            from: '"Inpetum App" <no-reply@inpetum.com>',
            to,
            subject,
            html,
        });
        console.log(`Correo enviado a ${to}`);
    } catch (err) {
        console.error('Error enviando email:', err);
        throw err;
    }
}

module.exports = sendEmail;
