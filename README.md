# Muralla - Sistema de Mural Interactivo 3D

Un sistema web completo para crear y gestionar murales interactivos con efectos 3D, que permite a los usuarios subir imágenes mediante WhatsApp y visualizarlas en un carrusel dinámico con efecto de perspectiva.

## Arquitectura del Sistema

### Componentes Principales

1. **Frontend (Astro + React)**
   - Interfaz visual con carrusel 3D
   - Sistema de carga en tiempo real via WebSocket
   - Panel de administración
   - QR para acceso móvil

2. **Backend (Node.js + Express)**
   - API REST para gestión de imágenes
   - Servidor WebSocket para actualizaciones en vivo
   - Gestión de archivos y base de datos MySQL
   - Sistema de uploads con validación

3. **Bot de WhatsApp (Baileys)**
   - Recepción de imágenes via WhatsApp
   - Flujo conversacional para metadata
   - Integración con backend API

## Requisitos del Sistema

- Node.js 18+
- MySQL 8.0+
- Nginx (opcional para producción)

## Instalación

### 1. Clonar repositorio
```bash
git clone <repository-url>
cd muralla
```

### 2. Base de datos
```bash
mysql -u root -p < backend/database/schema.sql
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno
npm run dev
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Configurar URLs de API y WebSocket
npm run dev
```

### 5. Bot de WhatsApp
```bash
cd bot
npm install
cp .env.example .env
# Configurar API_URL y token
npm start
```

## Configuración

### Variables de Entorno

**Backend (.env)**
```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=muralla
FRONTEND_URL=http://localhost:4321
```

**Frontend (.env)**
```env
PUBLIC_API_URL=http://localhost:3001
PUBLIC_WS_URL=ws://localhost:3001
PUBLIC_UPLOAD_LINK=http://localhost:4321/upload
```

**Bot (.env)**
```env
API_URL=http://localhost:3001
```

## Estructura de Directorios

```
muralla/
├── backend/
│   ├── config/          # Configuración DB y WebSocket
│   ├── controllers/     # Lógica de controladores
│   ├── database/        # Esquemas y scripts DB
│   ├── public/uploads/  # Archivos subidos
│   └── routes/          # Rutas API
├── frontend/
│   ├── src/
│   │   ├── components/  # Componentes React/Astro
│   │   ├── layouts/     # Layouts Astro
│   │   └── pages/       # Páginas Astro
│   └── public/          # Assets estáticos
└── bot/
    ├── auth_info/       # Sesiones WhatsApp
    └── files/           # Archivos temporales bot
```

## API Endpoints

### Imágenes
- `POST /api/upload` - Subir nueva imagen
- `GET /api/images` - Listar todas las imágenes
- `GET /api/images/:uid` - Obtener imagen específica
- `PUT /api/images/:uid` - Actualizar imagen
- `DELETE /api/images/:uid` - Eliminar imagen

### Utilidades
- `GET /health` - Health check del servidor
- `GET /api/debug-db` - Debug información DB

## WebSocket Events

- `newImage` - Nueva imagen agregada
- `updateImage` - Imagen actualizada
- `deleteImage` - Imagen eliminada

## Flujo de Trabajo

1. Usuario envía imagen al bot de WhatsApp
2. Bot procesa imagen y solicita mensaje dedicado
3. Bot envía datos al backend API
4. Backend almacena en DB y notifica via WebSocket
5. Frontend recibe notificación y actualiza carrusel
6. Imagen aparece en mural con efecto 3D

## Desarrollo

### Comandos Útiles

**Backend**
```bash
npm run dev        # Desarrollo con nodemon
npm start          # Producción
npm run db:init    # Inicializar DB
```

**Frontend**
```bash
npm run dev        # Servidor desarrollo
npm run build      # Build producción
npm run preview    # Preview build
```

### Scripts Base de Datos

- `backend/database/schema.sql` - Esquema inicial
- `backend/init-db.js` - Inicialización automática
- `backend/scripts/add_column.js` - Utilidades DB

## Seguridad

- CORS configurado para dominios específicos
- Validación de archivos y tamaños
- Sanitización de inputs
- Sistema de estados para imágenes

## Despliegue

### Producción
1. Configurar NGINX para frontend estático
2. Servir backend con PM2 o similar
3. Configurar SSL certificates
4. Ejecutar bot como servicio systemd

### Variables Producción
```env
NODE_ENV=production
FRONTEND_URL=https://dominio.com
```

## Troubleshooting

### Conexión WhatsApp
- Escanear QR al iniciar bot
- Archivos de sesión en `bot/auth_info/`
- Reconexión automática implementada

### Problemas DB
- Verificar credenciales en .env
- Revisar permisos MySQL
- Usar endpoint `/api/debug-db` para diagnóstico

### WebSocket
- Asegurar conexión estable
- Verificar CORS y firewall
- Logs de conexión en consola

## Licencia

Proyecto privado - Todos los derechos reservados