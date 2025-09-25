// src/utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 1025, // MailHog por defecto
    secure: false,
    auth: null,
});

module.exports = transporter;
