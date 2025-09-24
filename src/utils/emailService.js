const transporter = require("./mailer");

// 👉 Función para enviar correo de bienvenida
async function sendWelcomeEmail(to, password, role) {
    if (!transporter) {
        // fallback a consola
        console.log("=== EMAIL SIMULADO ===");
        console.log(`Para: ${to}`);
        console.log(`Password: ${password}`);
        console.log(`Rol: ${role}`);
        console.log("=======================");
        return;
    }

    await transporter.sendMail({
        from: '"Tu Plataforma 👋" <no-reply@tuapp.com>',
        to,
        subject: "Bienvenido a la plataforma",
        html: `
      <h2>¡Hola!</h2>
      <p>Tu cuenta ha sido creada con éxito.</p>
      <p><b>Email:</b> ${to}</p>
      <p><b>Password:</b> ${password}</p>
      <p><b>Rol:</b> ${role}</p>
      <p>⚠️ Por seguridad, cambia tu contraseña al iniciar sesión.</p>
    `,
    });
}

module.exports = {
    sendWelcomeEmail,
};
