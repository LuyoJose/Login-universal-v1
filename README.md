# Auth Redis API - Documentación

API para autenticación con JWT, Redis y PostgreSQL que gestiona usuarios, roles y permisos.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Endpoints](#endpoints)
  - [Autenticación](#autenticación)
  - [Usuarios](#usuarios)
  - [Roles](#roles)
  - [Contraseñas](#contraseñas)
- [Modelos de Datos](#modelos-de-datos)
- [Flujos de Autenticación](#flujos-de-autenticación)
- [Permisos y Roles](#permisos-y-roles)
- [Ejemplos de Uso](#ejemplos-de-uso)
## Descripción General

Esta API proporciona un sistema completo de autenticación y autorización con las siguientes características:

- **Autenticación JWT** con expiración configurable
- **Gestión de sesiones** en Redis para escalabilidad
- **Sistema de roles y permisos** jerárquico
- **Recuperación de contraseñas** mediante OTP por email
- **Reglas de negocio** para creación y eliminación de usuarios
- **Documentación Swagger** interactiva

## Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos principal
- **Redis** - Almacenamiento de sesiones y cache
- **JWT** - Tokens de autenticación
- **bcryptjs** - Hash de contraseñas
- **Sequelize** - ORM para PostgreSQL
- **Nodemailer** - Envío de emails

## Instalación

```bash
# Clonar el proyecto
git clone <repository-url>
cd auth-redis-api

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar la aplicación
npm start
```
## Configuración

Variables de entorno requeridas en `.env`:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=tu_jwt_secret_super_seguro

# Email (para recuperación de contraseñas)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_de_app
```
## Endpoints

### Autenticación

#### POST `/api/auth/login`

Inicia sesión y obtiene un token JWT.

**Body:**

``` json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Respuesta Exitosa:**

``` json
{
  "message": "Login OK",
  "sessionId": "session_abc123def456",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "usuario@ejemplo.com",
    "role": "admin",
    "nombre": "Juan",
    "apellido": "Pérez"
  }
}
```

------------------------------------------------------------------------

#### POST `/api/auth/register` 🔐

Registra un nuevo usuario (**requiere autenticación y permiso
`create_user`**).

**Headers:**

    Authorization: Bearer <jwt-token>

**Body:**

``` json
{
  "nombre": "María",
  "apellido": "González",
  "email": "maria@ejemplo.com",
  "password": "nuevaContraseña123",
  "role": "user"
}
```

**Reglas de Negocio:** - **SuperAdmin**: Puede crear cualquier rol\
- **Admin**: Puede crear `manager` y `user`, pero **NO** otros `admin`\
- **Manager**: Solo puede crear `user`\
- **User**: No puede crear usuarios

------------------------------------------------------------------------

### Usuarios

#### GET `/api/auth/users` 🔐

Obtiene lista de todos los usuarios con sus roles (**requiere permiso
`read`**).

**Respuesta:**

``` json
{
  "users": [
    {
      "id": "uuid-usuario-1",
      "nombre": "Juan",
      "apellido": "Pérez",
      "email": "juan@ejemplo.com",
      "role": "admin",
      "status": "active"
    }
  ]
}
```

------------------------------------------------------------------------

#### DELETE `/api/auth/users/{userId}` 🔐

Elimina un usuario (**requiere permiso `delete_user`**).

**Reglas de Eliminación:** - **SuperAdmin**: Puede eliminar cualquier
usuario (excepto a sí mismo)\
- **Admin**: Puede eliminar `manager` y `user`, pero **NO** otros
`admin` ni `superadmin`\
- **Manager**: Solo puede eliminar `user`\
- **User**: No puede eliminar a nadie\
- 🚫 **Ningún usuario puede eliminarse a sí mismo**

------------------------------------------------------------------------

### Roles

#### GET `/api/auth/roles` 🔐

Obtiene lista de roles disponibles (**requiere permiso `read`**).

**Respuesta:**

``` json
{
  "roles": [
    { "name": "superadmin", "description": "Super Administrador del sistema" },
    { "name": "admin", "description": "Administrador del sistema" },
    { "name": "manager", "description": "Manager de equipo" },
    { "name": "user", "description": "Usuario estándar" }
  ]
}
```

------------------------------------------------------------------------

#### POST `/api/auth/assign-role` 🔐🏆

Asigna un nuevo rol a un usuario (**SOLO SuperAdmin**).

**Body:**

``` json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "roleName": "manager"
}
```

------------------------------------------------------------------------

#### POST `/api/auth/remove-role` 🔐🏆

Remueve el rol actual y asigna rol por defecto `"user"` (**SOLO
SuperAdmin**).

**Body:**

``` json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

------------------------------------------------------------------------

### Contraseñas

#### POST `/api/auth/forgot-password-otp`

Solicita OTP para recuperación de contraseña.

**Body:**

``` json
{
  "email": "usuario@ejemplo.com"
}
```

> ℹ️ Nota: Por seguridad, siempre devuelve éxito aunque el email no
> exista.

------------------------------------------------------------------------

#### POST `/api/auth/reset-password-otp`

Restablece contraseña usando OTP recibido por email.

**Body:**

``` json
{
  "email": "usuario@ejemplo.com",
  "otp": "123456",
  "newPassword": "nuevaContraseña123"
}
```

**Requisitos de Contraseña:** 
- Mínimo **8 caracteres**
- Al menos **una letra** y **un número**

Para saber mas sobre la logica de los endpoints puede ir defrente a la documentacion de los controllers con este link - [AuthController](src/docs/md/authController.md)

## Modelos de Datos

### Usuario (User)
```javascript
{
  id: UUID (Primary Key),
  nombre: STRING,
  apellido: STRING,
  roleId: UUID (Foreign Key),
  status: ENUM('active', 'inactive'),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Credencial (Credential)
```javascript
{
  id: UUID (Primary Key),
  email: STRING (Unique),
  password: STRING (Hashed),
  userId: UUID (Foreign Key),
  isVerified: BOOLEAN,
  lastLogin: DATE,
  createdAt: DATE,
  updatedAt: DATE
}
```

### Rol (Role)
```javascript
{
  id: UUID (Primary Key),
  name: STRING (Unique), // 'superadmin', 'admin', 'manager', 'user'
  description: STRING,
  createdAt: DATE,
  updatedAt: DATE
}
```

### Permiso (Permission)
```javascript
{
  id: UUID (Primary Key),
  name: STRING (Unique), // 'read', 'write', 'delete', 'manage_users', etc.
  description: STRING,
  createdAt: DATE,
  updatedAt: DATE
}
```

---

## Flujos de Autenticación

### 1. Login Exitoso
```text
Usuario → POST /login → Verifica credenciales → 
Crea sesión en Redis → Genera JWT → Retorna token y datos de usuario
```

### 2. Registro de Usuario
```text
Usuario autenticado → POST /register → Valida permisos → 
Crea usuario y credencial → Asigna permisos por defecto → 
Envía email de bienvenida → Retorna usuario creado
```

### 3. Recuperación de Contraseña
```text
Usuario → POST /forgot-password-otp → Genera OTP → 
Guarda OTP en Redis → Envía email → 
Usuario → POST /reset-password-otp → Valida OTP → 
Actualiza contraseña → Elimina OTP
```
# Permisos y Roles

## Jerarquía de Roles
```
SuperAdmin (Máximo nivel)
    ↓
Admin
    ↓
Manager
    ↓
User (Nivel básico)
```

## Permisos por Defecto

| Rol         | Permisos                                           |
|-------------|----------------------------------------------------|
| SuperAdmin  | read, write, edit, delete, manage_permissions, manage_roles, super_admin |
| Admin       | read, write, edit, delete, manage_permissions      |
| Manager     | read, write                                        |
| User        | read                                               |

## Ejemplos de Uso

### 1. Login y Acceso a Recursos Protegidos
```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@ejemplo.com',
    password: 'password123'
  })
});

const { token, user } = await loginResponse.json();

// 2. Acceder a recurso protegido
const usersResponse = await fetch('/api/auth/users', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 2. Creación de Usuario por Admin
```javascript
// Headers con token de admin
const headers = {
  'Authorization': 'Bearer <admin-token>',
  'Content-Type': 'application/json'
};

// Crear usuario con rol user (permisible para admin)
const newUser = {
  nombre: "Carlos",
  apellido: "López",
  email: "carlos@ejemplo.com",
  password: "tempPassword123",
  role: "user"
};

const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(newUser)
});
```

### 3. Recuperación de Contraseña
```javascript
// 1. Solicitar OTP
await fetch('/api/auth/forgot-password-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'usuario@ejemplo.com' })
});

// 2. Usar OTP recibido por email para resetear
await fetch('/api/auth/reset-password-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@ejemplo.com',
    otp: '123456',
    newPassword: 'nuevaContraseñaSegura123'
  })
});
```
## Documentación Interactiva

La documentación Swagger está disponible en:
```text
http://localhost:3000/api-docs
```
## Manejo de Errores

**Requisitos de Contraseña:** 
- `200` - Éxito
- `400` - Datos incorrectos o faltantes
- `401` - No autenticado
- `403` - No autorizado (sin permisos)
- `404` - Recurso no encontrado
- `409` - Conflicto (email ya existe)   
- `500` - Error interno del servidor

## Notas Adicionales

**Requisitos de Contraseña:** 
- Las sesiones se almacenan en Redis con expiración de 1 hora
- Los tokens JWT expiran después de 1 hora
- Los OTP para recuperación de contraseña expiran en 5 minutos
- Las contraseñas se hashean con bcrypt antes de almacenarse
- Cada rol tiene permisos predefinidos que se asignan automáticamente
