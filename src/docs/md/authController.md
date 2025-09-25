# 🔐 Auth Controller Documentation

## 📋 Descripción General
Controlador principal para la autenticación y gestión de usuarios. Maneja login, registro, recuperación de contraseñas, gestión de roles y permisos.

## 🏗️ Estructura del Controlador

### Dependencias y Módulos
```javascript
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
```

## 🔧 Funciones Auxiliares

### `assignDefaultPermissions(userId, roleName)`
**Propósito**: Asigna permisos predefinidos según el rol del usuario.

**Flujo**:
- Busca el rol en la base de datos
- Obtiene los permisos predefinidos para ese rol
- Asigna cada permiso al usuario mediante `RolePermission`

**Permisos por Rol**:
- **superadmin**: read, write, edit, delete, manage_permissions, manage_roles, super_admin
- **admin**: read, write, edit, delete, manage_permissions
- **manager**: read, write
- **user**: read (por defecto)

## 🛡️ Middlewares de Autenticación

### `isSuperAdmin(req, res, next)`
**Propósito**: Verifica si el usuario tiene permisos de superadministrador.

**Validaciones**:
- ✅ Usuario existe en la base de datos
- ✅ Usuario tiene el permiso `super_admin`
- ❌ Retorna 403 si no tiene permisos suficientes

**Uso**: Protege rutas que requieren máximo nivel de acceso.

## 🔑 Controladores de Autenticación

### `login(req, res)`
**Endpoint**: `POST /api/auth/login`

**Propósito**: Autentica usuario y genera token JWT.

**Flujo**:
- Valida email y password en el request
- Busca credenciales en la base de datos
- Verifica contraseña usando `comparePassword`
- Actualiza último login
- Genera `sessionId` y token JWT
- Almacena sesión en Redis (expira en 1h)
- Retorna token y datos del usuario

**Respuesta Exitosa**:
```json
{
  "message": "Login OK",
  "sessionId": "session_abc123",
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "admin",
    "nombre": "John",
    "apellido": "Doe"
  }
}
```

**Códigos de Error**:
- 400 - Datos faltantes
- 401 - Credenciales inválidas
- 500 - Error interno

### `register(req, res)`
**Endpoint**: `POST /api/auth/register` (Requiere autenticación)

**Propósito**: Crea nuevo usuario (solo usuarios autorizados).

**Validaciones**:
- ✅ Todos los campos obligatorios presentes
- ✅ Email no está registrado previamente
- ✅ Rol solicitado existe
- ✅ Usuario tiene permisos para crear el rol especificado

**Reglas de Autorización**:
- **superadmin**: Puede crear cualquier rol
- **admin**: Puede crear managers y users (no otros admins)
- **manager**: Solo puede crear users

**Flujo**:
- Valida permisos del usuario que realiza la solicitud
- Crea usuario en la base de datos
- Crea credenciales (password se hashea automáticamente)
- Envía email de bienvenida
- Asigna permisos por defecto

**Respuesta Exitosa**:
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "user_id",
    "nombre": "Carlos",
    "apellido": "López",
    "role": "user"
  }
}
```

### `deleteUser(req, res)`
**Endpoint**: `DELETE /api/auth/users/:userId`

**Propósito**: Elimina usuario del sistema con validaciones de seguridad.

**Validaciones**:
- ✅ Usuario tiene permiso `delete_user`
- ✅ Usuario no puede eliminarse a sí mismo
- ✅ Validaciones jerárquicas según rol

**Reglas de Eliminación**:
- **superadmin**: Puede eliminar cualquier usuario
- **admin**: Solo puede eliminar managers y users
- **manager**: Solo puede eliminar users
- **user**: No puede eliminar a nadie

**Protecciones**:
- ❌ No se puede eliminar a uno mismo
- ❌ No se puede eliminar usuarios de rol superior

## 👥 Gestión de Roles y Permisos

### `assignRoleToUser(req, res)`
**Endpoint**: `POST /api/auth/assign-role`

**Propósito**: Asigna nuevo rol a usuario existente.

**Validaciones**:
- ✅ Usuario objetivo existe
- ❌ No se puede modificar rol de superadmin
- ❌ Solo superadmin puede asignar rol superadmin
- ✅ Nuevo rol existe en el sistema

**Flujo con Transacción**:
- Inicia transacción de base de datos
- Busca usuario y verifica permisos
- Valida que no sea superadmin
- Busca nuevo rol
- Valida que nuevo rol no sea superadmin (a menos que sea superadmin)
- Actualiza rol del usuario
- Confirma transacción

### `removeRoleFromUser(req, res)`
**Endpoint**: `POST /api/auth/remove-role`

**Propósito**: Remueve rol específico y asigna rol por defecto (`user`).

**Validaciones**:
- ✅ Usuario existe
- ❌ No se puede modificar superadmin
- ✅ Rol por defecto `user` existe

**Flujo**:
- Busca usuario y verifica que no sea superadmin
- Asigna rol `user` por defecto
- Retorna confirmación

## 📊 Consultas y Listados

### `getUsersWithRoles(req, res)`
**Endpoint**: `GET /api/auth/users`

**Propósito**: Obtiene lista completa de usuarios con sus roles y emails.

**Respuesta**:
```json
{
  "users": [
    {
      "id": "user_id",
      "nombre": "John",
      "apellido": "Doe",
      "email": "john@example.com",
      "role": "admin",
      "status": "active"
    }
  ]
}
```

### `getAvailableRoles(req, res)`
**Endpoint**: `GET /api/auth/roles`

**Propósito**: Lista todos los roles disponibles en el sistema.

**Respuesta**:
```json
{
  "roles": [
    {
      "name": "admin",
      "description": "Administrador del sistema"
    }
  ]
}
```

## 🔄 Recuperación de Contraseña

### `sendOtp(req, res)`
**Endpoint**: `POST /api/auth/forgot-password-otp`

**Propósito**: Envía OTP (One-Time Password) para recuperación.

**Flujo**:
- Genera OTP de 6 dígitos
- Almacena OTP en Redis (expira en 5 minutos)
- Envía OTP por email al usuario
- Retorna mensaje genérico (seguridad)

**Seguridad**: Siempre retorna éxito aunque el email no exista.

### `resetPasswordWithOtp(req, res)`
**Endpoint**: `POST /api/auth/reset-password-otp`

**Propósito**: Restablece contraseña usando OTP válido.

**Validaciones**:
- ✅ OTP coincide con el almacenado en Redis
- ✅ Nueva contraseña cumple requisitos de seguridad
- ✅ Email existe en el sistema

**Requisitos Contraseña**:
- Mínimo 8 caracteres
- Al menos una letra y un número
- Puede contener letras y números solamente

**Flujo**:
- Verifica OTP en Redis
- Hashea nueva contraseña
- Actualiza credenciales
- Elimina OTP usado
- Confirma éxito

## 🧪 Utilidades de Desarrollo

### `createTestUser()`
**Propósito**: Crea usuario de prueba para desarrollo.

**Características**:
- **Email**: `test@example.com`
- **Password**: `password123`
- **Rol**: `admin`
- Solo se crea si no existe previamente

**Uso**: Ejecutar manualmente en entorno de desarrollo.

## 🚨 Manejo de Errores

**Estrategias Implementadas**:
- **Logging Centralizado**: Usa `logger` para tracking detallado
- **Transacciones BD**: Para operaciones críticas (gestión de roles)
- **Validaciones Múltiples**: Seguridad en capas
- **Respuestas Estándar**: Códigos HTTP consistentes

**Códigos HTTP Utilizados**:
- **200** - Éxito
- **400** - Datos incorrectos
- **401** - No autenticado
- **403** - Sin permisos
- **404** - Recurso no encontrado
- **409** - Conflicto (email existente)
- **500** - Error interno

## 🔒 Consideraciones de Seguridad
- **Passwords**: Hasheados con bcrypt (salt 10)
- **Sesiones**: Almacenadas en Redis con expiración
- **Tokens JWT**: Expiran en 1 hora
- **OTP**: Expiran en 5 minutos
- **Validación Jerárquica**: Estricta validación de roles
- **Transacciones**: Para operaciones atómicas críticas

## 📝 Notas de Implementación
- Todas las operaciones sensibles están logueadas
- Uso de aliases en relaciones de Sequelize (`as: "role"`, `as: "permissions"`)
- Manejo robusto de errores con transacciones rollback
- Comunicación asíncrona con Redis para sesiones y OTP
- Integración con servicio de email para notificaciones

Este controlador proporciona una base sólida para la autenticación y gestión de usuarios con énfasis en seguridad y escalabilidad.