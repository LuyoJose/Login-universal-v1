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
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a Nuestra Plataforma</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .email-header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; color: white; }
        .email-header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .email-body { padding: 30px; color: #333; line-height: 1.6; }
        .welcome-text { font-size: 16px; margin-bottom: 20px; }
        .credentials-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .credential-row { display: flex; margin-bottom: 10px; align-items: center; }
        .credential-label { font-weight: 600; color: #475569; min-width: 100px; }
        .credential-value { background: white; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; flex: 1; font-family: monospace; }
        .security-alert { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; text-align: center; }
        .security-alert strong { color: #d97706; }
        .email-footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        .login-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 15px 0; }
        .button-container { text-align: center; }
        @media (max-width: 600px) {
            .credential-row { flex-direction: column; align-items: flex-start; }
            .credential-label { min-width: auto; margin-bottom: 5px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Bienvenido a Nuestra Plataforma</h1>
        </div>
        
        <div class="email-body">
            <p class="welcome-text">Estimado usuario,</p>
            
            <p>Nos complace informarle que su cuenta ha sido creada exitosamente en nuestra plataforma empresarial.</p>
            
            <div class="credentials-box">
                <h3 style="margin-top: 0; color: #1e293b;">Credenciales de Acceso</h3>
                
                <div class="credential-row">
                    <span class="credential-label">Email:</span>
                    <span class="credential-value">${to}</span>
                </div>
                
                <div class="credential-row">
                    <span class="credential-label">Contraseña:</span>
                    <span class="credential-value">${password}</span>
                </div>
                
                <div class="credential-row">
                    <span class="credential-label">Rol:</span>
                    <span class="credential-value">${role}</span>
                </div>
            </div>
            
            <div class="security-alert">
                ⚠️ <strong>Medida de Seguridad:</strong> Por su seguridad, le recomendamos cambiar su contraseña después del primer inicio de sesión.
            </div>
            
            <p>Para acceder a la plataforma, utilice las credenciales proporcionadas arriba.</p>
            
            <!-- Botón centrado -->
            <div class="button-container">
                <a href="#" class="login-button">Acceder a la Plataforma</a>
            </div>
        </div>
        
        <div class="email-footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>Si tiene alguna pregunta, contacte a nuestro equipo de soporte: soporte@tuapp.com</p>
        </div>
    </div>
</body>
</html>
        `,
    });
}

module.exports = {
    sendWelcomeEmail,
};