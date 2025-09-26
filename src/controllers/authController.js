// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require('uuid');
const { connectRedis } = require('../utils/redis');
const { User, Role, Credential, Permission, RolePermission } = require('../models');
const { sequelize } = require('../utils/db');
const config = require('../config');
const transporter = require('../utils/mailer');
const sendEmail = require('../utils/sendEmail');
const { sendWelcomeEmail } = require("../utils/emailService");
const logger = require("../utils/logger");

require('dotenv').config();
const USE_OTP = process.env.USE_OTP === 'true';
// ---------------------------------------------------
// Función para asignar permisos por defecto
async function assignDefaultPermissions(userId, roleName) {
  try {
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      logger.warn("Rol %s no encontrado al asignar permisos a usuario %s", roleName, userId);
      return;
    }

    const defaultPermissions = {
      superadmin: [
        "read",
        "write",
        "edit",
        "delete",
        "manage_permissions",
        "manage_roles",
        "super_admin",
      ],
      admin: ["read", "write", "edit", "delete", "manage_permissions"],
      manager: ["read", "write"],
      user: ["read"],
    };

    const permissionsToAssign = defaultPermissions[roleName] || ["read"];

    for (const permName of permissionsToAssign) {
      const permission = await Permission.findOne({ where: { name: permName } });
      if (permission) {
        await RolePermission.create({
          roleId: role.id,
          permissionId: permission.id,
          userId: userId,
        });
        logger.info("Permiso %s asignado al usuario %s con rol %s", permName, userId, roleName);
      } else {
        logger.warn("Permiso %s no encontrado en BD para rol %s", permName, roleName);
      }
    }

    logger.info("✅ Permisos asignados correctamente para usuario %s con rol %s", userId, roleName);
  } catch (error) {
    logger.error("❌ Error asignando permisos por defecto a usuario %s: %s", userId, error.stack);
  }
}

// ---------------------------------------------------
// Middleware para superadmin
exports.isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: "role",
          include: [{ model: Permission, as: "permissions" }],
        },
      ],
    });

    if (!user) {
      logger.warn("Usuario %s no encontrado al verificar superadmin", req.user.id);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const hasSuperAdminPermission = user.role?.permissions?.some(
      (p) => p.name === "super_admin"
    );

    if (!hasSuperAdminPermission) {
      logger.warn("Usuario %s intentó acceder sin permisos de superadmin", req.user.id);
      return res
        .status(403)
        .json({ error: "Se requieren permisos de superadministrador" });
    }

    logger.info("Usuario %s validado como superadmin", req.user.id);
    next();
  } catch (error) {
    logger.error("Error verificando superadmin para usuario %s: %s", req.user.id, error.stack);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


// ---------------------------------------------------
// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn("Intento de login sin email o password");
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    // Buscar credencial + usuario + rol
    const credential = await Credential.findOne({
      where: { email },
      include: [{ model: User, as: "user", include: [{ model: Role, as: "role" }] }]
    });

    if (!credential) {
      logger.warn("Login fallido: email %s no encontrado", email);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Usar método del modelo
    const validPassword = await credential.comparePassword(password);
    if (!validPassword) {
      logger.warn("Login fallido: contraseña inválida para email %s", email);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Actualizar último login
    await credential.update({ lastLogin: new Date() });

    const user = credential.user;
    const userRole = user.role;

    // Crear sesión y token
    const sessionId = `session_${uuidv4().replace(/-/g, "")}`;
    const token = jwt.sign(
      {
        userId: user.id,
        role: userRole?.name || "user",
        roleId: user.roleId,
        sessionId,
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    const redis = await connectRedis();
    const sessionData = {
      session: {
        token,
        user: {
          email: credential.email,
          nombre: user.nombre,
          apellido: user.apellido,
          role: userRole?.name,
        },
      },
    };

    // Guardar token en Redis
    await redis.set(`token:${user.id}`, token, { EX: 3600 });
    await redis.set(sessionId, JSON.stringify(sessionData), { EX: 3600 });
    await redis.set(`user:${user.id}:session`, sessionId, { EX: 3600 });

    logger.info("Usuario %s inició sesión correctamente con rol %s", email, userRole?.name);

    res.json({
      message: "Login OK",
      sessionId,
      token,
      user: {
        id: user.id,
        email: credential.email,
        role: userRole?.name,
        nombre: user.nombre,
        apellido: user.apellido,
      },
    });

  } catch (error) {
    logger.error("Error en login: %s", error.stack);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// ---------------------------------------------------
// Register (solo superadmin)
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, role } = req.body;

    if (!nombre || !apellido || !email || !password || !role) {
      logger.warn("Intento de registro con datos incompletos");
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    // Verificar si el email ya existe
    const existingCredential = await Credential.findOne({ where: { email } });
    if (existingCredential) {
      logger.warn("Registro fallido: el email %s ya está registrado", email);
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    // Validar rol solicitado
    const roleObj = await Role.findOne({ where: { name: role } });
    if (!roleObj) {
      logger.warn("Registro fallido: rol %s inválido", role);
      return res.status(400).json({ error: "Rol inválido" });
    }

    // 🔐 Reglas de negocio
    const requesterRole = req.user.role;

    if (requesterRole === "manager" && role !== "user") {
      logger.warn("Manager %s intentó crear un %s", req.user.id, role);
      return res.status(403).json({ error: "Managers solo pueden crear usuarios con rol user" });
    }

    if (requesterRole === "admin" && role === "admin") {
      logger.warn("Admin %s intentó crear otro admin", req.user.id);
      return res.status(403).json({ error: "Admins no pueden crear otros admins" });
    }

    if (requesterRole !== "superadmin" && role === "superadmin") {
      logger.warn("Usuario %s intentó crear un superadmin", req.user.id);
      return res.status(403).json({ error: "Solo un SuperAdmin puede crear SuperAdmins" });
    }

    // Crear usuario
    const userId = uuidv4();
    const newUser = await User.create({
      id: userId,
      nombre,
      apellido,
      roleId: roleObj.id,
      status: "active",
    });

    // Crear credencial
    await Credential.create({
      email,
      password, // Sequelize lo hashea en el hook
      userId: newUser.id,
      isVerified: true,
    });

    // 📧 Enviar correo
    try {
      await sendWelcomeEmail(email, password, roleObj.name);
      logger.info("Correo de bienvenida enviado a %s", email);
    } catch (mailError) {
      logger.error("Error enviando correo a %s: %s", email, mailError.stack);
    }

    logger.info("Usuario %s registrado con rol %s por %s", email, roleObj.name, requesterRole);

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        role: roleObj.name,
      },
    });
  } catch (error) {
    logger.error("Error en register: %s", error.stack);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // Validar permiso general
    if (!currentUser.permissions.includes("delete_user")) {
      logger.warn(`❌ Usuario ${currentUser.id} intentó eliminar sin permisos`);
      return res.status(403).json({ error: "No tienes permiso para eliminar usuarios" });
    }

    const userToDelete = await User.findByPk(userId, { include: { model: Role, as: "role" } });
    if (!userToDelete) {
      logger.warn(`⚠️ Intento de eliminar usuario inexistente con ID: ${userId}`);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const targetRole = userToDelete.role?.name;
    const currentRole = currentUser.role;

    // 🚫 No permitir borrar a uno mismo
    if (currentUser.id === userToDelete.id) {
      logger.warn(`🚫 Usuario ${currentUser.id} intentó eliminarse a sí mismo`);
      return res.status(403).json({ error: "No puedes eliminarte a ti mismo" });
    }

    // 🔹 Reglas según rol
    if (currentRole === "superadmin") {
      // ✅ Puede borrar a cualquiera excepto a sí mismo (ya validado arriba)
    } else if (currentRole === "admin") {
      if (targetRole === "admin" || targetRole === "superadmin") {
        logger.warn(`🚫 Admin ${currentUser.id} intentó eliminar ${targetRole} (${userId})`);
        return res.status(403).json({ error: "Un admin no puede eliminar a otros admins ni superadmins" });
      }
    } else if (currentRole === "manager") {
      if (targetRole !== "user") {
        logger.warn(`🚫 Manager ${currentUser.id} intentó eliminar a un ${targetRole}`);
        return res.status(403).json({ error: "Un manager solo puede eliminar usuarios con rol user" });
      }
    } else {
      logger.warn(`🚫 Usuario ${currentUser.id} intentó eliminar sin rol válido`);
      return res.status(403).json({ error: "No tienes permiso para eliminar usuarios" });
    }

    await userToDelete.destroy();
    logger.info(`✅ Usuario ${userId} eliminado por ${currentUser.id}`);
    res.json({ message: `Usuario ${userId} eliminado correctamente` });
  } catch (err) {
    logger.error("❌ Error en deleteUser:", err);
    res.status(500).json({ error: err.message });
  }
};



// ---------------------------------------------------
// Gestión de roles
exports.assignRoleToUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { userId, roleName } = req.body;
    if (!userId || !roleName) {
      logger.warn("⚠️ Falta userId o roleName en assignRoleToUser");
      return res.status(400).json({ error: "userId y roleName requeridos" });
    }

    // 1️⃣ Buscar usuario con su rol y permisos
    const targetUser = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "role",
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      transaction,
    });

    if (!targetUser) {
      await transaction.rollback();
      logger.warn(`⚠️ Usuario ${userId} no encontrado en assignRoleToUser`);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 2️⃣ Verificar si el usuario objetivo es superadmin
    const targetIsSuperAdmin = targetUser.role?.permissions?.some(
      (p) => p.name === "super_admin"
    );
    if (targetIsSuperAdmin) {
      await transaction.rollback();
      logger.warn(`🚫 Intento de modificar rol de superadmin (${userId})`);
      return res
        .status(403)
        .json({ error: "No puedes modificar roles de otros superadministradores" });
    }

    // 3️⃣ Buscar el nuevo rol con sus permisos
    const newRole = await Role.findOne({
      where: { name: roleName },
      include: [
        {
          model: Permission,
          as: "permissions",
          through: { attributes: [] },
        },
      ],
      transaction,
    });

    if (!newRole) {
      await transaction.rollback();
      logger.warn(`⚠️ Rol no encontrado: ${roleName}`);
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // 4️⃣ Verificar si el nuevo rol es superadmin
    const newRoleIsSuperAdmin = newRole.permissions?.some(
      (p) => p.name === "super_admin"
    );
    if (newRoleIsSuperAdmin) {
      await transaction.rollback();
      logger.warn(`🚫 Intento de asignar superadmin a ${userId}`);
      return res
        .status(403)
        .json({ error: "Solo superadministradores pueden asignar este rol" });
    }

    // 5️⃣ Actualizar rol del usuario
    await targetUser.update({ roleId: newRole.id }, { transaction });
    await transaction.commit();

    logger.info(`✅ Rol de usuario ${userId} cambiado a ${newRole.name}`);
    res.json({
      message: "Rol asignado correctamente",
      user: {
        id: targetUser.id,
        newRole: newRole.name,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("❌ Error asignando rol:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


exports.removeRoleFromUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { userId } = req.body;
    if (!userId) {
      logger.warn("⚠️ Falta userId en removeRoleFromUser");
      return res.status(400).json({ error: "userId requerido" });
    }

    // ✅ Incluir rol con alias y permisos
    const targetUser = await User.findByPk(userId, {
      include: {
        model: Role,
        as: "role",
        include: {
          model: Permission,
          as: "permissions",
          through: { attributes: [] },
        },
      },
      transaction,
    });

    if (!targetUser) {
      await transaction.rollback();
      logger.warn(`⚠️ Usuario ${userId} no encontrado en removeRoleFromUser`);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 🚫 Proteger superadmins
    const targetIsSuperAdmin = targetUser.role?.permissions?.some(
      (p) => p.name === "super_admin"
    );
    if (targetIsSuperAdmin) {
      await transaction.rollback();
      logger.warn(`🚫 Intento de remover rol a superadmin (${userId})`);
      return res
        .status(403)
        .json({ error: "No puedes modificar roles de otros superadministradores" });
    }

    // Buscar rol por defecto
    const defaultRole = await Role.findOne({ where: { name: "user" }, transaction });
    if (!defaultRole) {
      await transaction.rollback();
      logger.error("❌ Rol por defecto 'user' no configurado");
      return res.status(404).json({ error: "Rol por defecto no configurado" });
    }

    // ✅ Actualizar usuario
    await targetUser.update({ roleId: defaultRole.id }, { transaction });
    await transaction.commit();

    logger.info(`✅ Rol removido: Usuario ${userId} reasignado a 'user'`);
    res.json({
      message: "Rol removido, asignado rol por defecto",
      user: { id: targetUser.id, newRole: "user" },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("❌ Error removiendo rol:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


// ---------------------------------------------------
// Obtener usuarios y roles
exports.getUsersWithRoles = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "nombre", "apellido", "status"],
      include: [
        {
          model: Credential,
          as: "credential",
          attributes: ["email"],
        },
        {
          model: Role,
          as: "role",
          attributes: ["name", "description"],
        },
      ],
      order: [["id", "ASC"]],
    });

    logger.info(`📋 ${users.length} usuarios obtenidos con roles`);
    res.json({
      users: users.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.credential?.email || "sin email",
        role: u.role?.name || "sin rol",
        status: u.status,
      })),
    });
  } catch (error) {
    logger.error("❌ Error obteniendo usuarios con roles:", error);
    res.status(500).json({ error: "Error interno" });
  }
};

// Obtener roles disponibles
exports.getAvailableRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });

    logger.info(`📋 ${roles.length} roles disponibles obtenidos`);
    res.json({
      roles: roles.map((role) => ({
        name: role.name,
        description: role.description,
      })),
    });
  } catch (error) {
    logger.error("❌ Error obteniendo roles:", error);
    res.status(500).json({ error: "Error interno" });
  }
};

// ---------------------------------------------------
// Crear usuario de prueba (solo si no existe)
exports.createTestUser = async () => {
  try {
    const existing = await Credential.findOne({
      where: { email: "test@example.com" },
      include: [{ model: User, as: "user" }],
    });

    if (!existing) {
      const userRole = await Role.findOne({ where: { name: "admin" } });

      if (!userRole) {
        logger.error("❌ No se encontró el rol admin para crear user de prueba");
        return;
      }

      const user = await User.create({
        nombre: "Test",
        apellido: "User",
        roleId: userRole.id,
        status: "active",
      });

      await Credential.create({
        email: "test@example.com",
        password: "password123",
        userId: user.id,
        isVerified: true,
      });

      await assignDefaultPermissions(user.id, "admin");

      logger.info("✅ User de prueba creado con email test@example.com");
    } else {
      logger.warn("⚠️ User de prueba ya existe, no se creó nuevamente");
    }
  } catch (error) {
    logger.error("❌ Error creando user test:", error);
  }
};

// ---------------------------------------------------
// Solicitar recuperación de contraseña → Enviar OTP
exports.sendOtp = async (req, res) => {
  if (!USE_OTP) {
    logger.info('⚠️ Funcionalidad de OTP desactivada');
    return res.status(403).json({ error: 'Funcionalidad de OTP desactivada' });
  }

  const { email } = req.body;
  if (!email) {
    logger.warn('⚠️ Email no proporcionado en sendOtp');
    return res.status(400).json({ error: 'Email requerido' });
  }

  try {
    const credential = await Credential.findOne({ where: { email } });

    if (!credential) {
      logger.warn(`⚠️ Intento de recuperación para email inexistente: ${email}`);
      return res
        .status(200)
        .json({ message: 'Si el email existe, se ha enviado un OTP' });
    }

    // Generar OTP de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpCreationTime = Date.now(); // Guardar timestamp

    // Guardar OTP y timestamp en Redis (expira en 5 minutos)
    const redis = await connectRedis();
    await redis.set(`otp:${credential.userId}`, JSON.stringify({
      code: otp,
      createdAt: otpCreationTime
    }), { EX: 300 });

    // Enviar OTP por email (mismo HTML que ya tienes)
    const expirationTime = new Date(otpCreationTime + 5 * 60 * 1000);
    const formattedTime = expirationTime.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Lima',
    });

    // dentro de tu controlador
await sendEmail({
  to: email,
  subject: 'Recuperación de Contraseña - Código OTP',
  html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperación de Contraseña</title>
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #dc2626, #b91c1c); 
            padding: 30px; 
            text-align: center; 
            color: white; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
        }
        .email-body { 
            padding: 30px; 
            color: #333; 
            line-height: 1.6; 
        }
        .otp-container { 
            background: #f8fafc; 
            border: 2px dashed #e2e8f0; 
            border-radius: 8px; 
            padding: 25px; 
            margin: 25px 0; 
            text-align: center; 
        }
        .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #dc2626; 
            letter-spacing: 8px; 
            background: white; 
            padding: 15px 25px; 
            border-radius: 8px; 
            display: inline-block; 
            margin: 10px 0; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .expiration-info { 
            background: #fffbeb; 
            border: 1px solid #fcd34d; 
            border-radius: 6px; 
            padding: 15px; 
            margin: 20px 0; 
            font-size: 14px; 
            color: #92400e; 
            text-align: center;
        }
        .security-alert { 
            background: #fef3c7; 
            border: 1px solid #f59e0b; 
            border-radius: 6px; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .email-footer { 
            background: #f1f5f9; 
            padding: 20px; 
            text-align: center; 
            color: #64748b; 
            font-size: 14px; 
            border-top: 1px solid #e2e8f0; 
        }
        @media (max-width: 600px) { 
            .otp-code { font-size: 24px; letter-spacing: 6px; } 
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Recuperación de Contraseña</h1>
        </div>
        
        <div class="email-body">
            <p>Estimado usuario,</p>
            
            <p>Hemos recibido una solicitud para recuperar la contraseña de su cuenta. Utilice el siguiente código OTP para verificar su identidad:</p>
            
            <div class="otp-container">
                <h3 style="margin-top: 0; color: #1e293b;">Código de Verificación</h3>
                <div class="otp-code">${otp}</div>
                
                <div class="expiration-info">
                    ⏳ Este código es válido por <strong>5 minutos</strong>.<br>
                    <em>Expira a las ${formattedTime}</em>
                </div>
            </div>
            
            <div class="security-alert">
                ⚠️ <strong>Importante:</strong> Si no solicitó este código, ignore este mensaje. 
                Por su seguridad, nunca comparta este código con terceros.
            </div>
            
            <p style="text-align: center;">
                <strong>Ingrese este código en la página de verificación antes de que expire.</strong>
            </p>
        </div>
        
        <div class="email-footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>Si tiene alguna pregunta, contacte a nuestro equipo de soporte: soporte@tuapp.com</p>
        </div>
    </div>
</body>
</html>`
});


  logger.info(`📧 OTP enviado correctamente al email: ${email}`);

  // Enviar también el timestamp al frontend
  res.json({
    message: 'OTP enviado correctamente',
  });

} catch (error) {
  logger.error('❌ Error enviando OTP:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
}
};

// Restablecer contraseña con o sin OTP según USE_OTP
exports.resetPasswordWithOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !newPassword) {
    logger.warn('Intento de reset sin parámetros completos', { email });
    return res.status(400).json({ error: 'Email y nueva contraseña requeridos' });
  }

  // Validación simple de contraseña
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    logger.warn('Contraseña inválida en resetPasswordWithOtp', { email });
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres, al menos una letra y un número',
    });
  }

  try {
    const credential = await Credential.findOne({ where: { email } });
    if (!credential) {
      logger.warn('Usuario no encontrado en resetPasswordWithOtp', { email });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Si OTP está activado, validar el OTP
    if (USE_OTP) {
      if (!otp) {
        logger.warn('Intento de reset sin OTP cuando USE_OTP está activado', { email });
        return res.status(400).json({ error: 'OTP requerido' });
      }

      const redis = await connectRedis();
      const storedOtp = await redis.get(`otp:${credential.userId}`);

      if (!storedOtp || storedOtp !== otp) {
        logger.warn('OTP inválido o expirado', { email, otpEnviado: otp });
        return res.status(400).json({ error: 'OTP inválido o expirado' });
      }

      // Borrar OTP usado
      await redis.del(`otp:${credential.userId}`);
    }

    // Hashear y actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await credential.update({ password: hashedPassword });

    logger.info('✅ Contraseña actualizada correctamente', { userId: credential.userId, email });
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    logger.error('❌ Error en resetPasswordWithOtp', { error: error.message, email });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};