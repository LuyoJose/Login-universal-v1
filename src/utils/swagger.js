const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Cargar el archivo YAML completo
const swaggerSpec = yaml.load(fs.readFileSync(path.join(__dirname, '../docs/auth-swagger.yaml'), 'utf8'));

// Agregar la configuración de servers que tenías
swaggerSpec.servers = [
    {
        url: "http://localhost:3000/api",
        description: "Servidor de desarrollo"
    },
];

// Opcional: Agregar securitySchemes si no están en el YAML
if (!swaggerSpec.components) {
    swaggerSpec.components = {};
}
if (!swaggerSpec.components.securitySchemes) {
    swaggerSpec.components.securitySchemes = {
        bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
        }
    };
}

function swaggerDocs(app) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`📄 Documentación disponible en http://localhost:3000/api-docs`);
}

module.exports = swaggerDocs;