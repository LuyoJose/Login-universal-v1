// src/utils/mailer.js
const nodemailer = require('nodemailer');

let transporter;

try {
    transporter = nodemailer.createTransport({
        host: 'localhost', // MailHog
        port: 1025,
        secure: false, // MailHog no usa TLS
    });
} catch (err) {
    console.warn('No se pudo conectar con MailHog, se usará fallback a consola.');
    transporter = null;
}

module.exports = transporter;
