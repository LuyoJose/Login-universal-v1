// src/utils/sendEmail.js
const transporter = require('./mailer'); // tu transporter configurado con MailHog o SMTP real

async function sendEmail({ to, subject, html }) {
    if (transporter) {
        try {
            await transporter.sendMail({
                from: '"Inpetum App" <no-reply@inpetum.com>',
                to,
                subject,
                html,
            });
        } catch (err) {
            console.error('Error enviando email:', err);
            throw err;
        }
    } else {
        console.log(`Simulación de envío a ${to}: ${html}`);
    }
}

module.exports = sendEmail;
