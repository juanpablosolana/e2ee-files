# Plataforma de Almacenamiento Seguro de Documentos (E2EE)

## Descripción del Proyecto

Plataforma web fullstack que permite a los usuarios almacenar, visualizar y compartir documentos de manera segura utilizando cifrado de extremo a extremo (E2EE). La aplicación garantiza que solo el usuario autorizado pueda leer el contenido de los archivos, incluso si el backend, la base de datos o un tercero fueran comprometidos.

## Características Principales

- **Cifrado de Extremo a Extremo (E2EE)**: Los archivos se cifran localmente en el navegador antes de ser enviados al servidor
- **Gestión Segura de Usuarios**: Sistema de autenticación robusto con manejo seguro de sesiones
- **Compartición Segura**: Permite compartir documentos manteniendo el cifrado
- **Firma Digital**: Verificación de integridad y autenticidad de documentos
- **Auditoría Completa**: Registro detallado de todos los accesos y operaciones
- **Revocación de Permisos**: Control granular sobre el acceso a documentos

## Stack Tecnológico

### Frontend
- **Next.js 15** con App Router
- **TypeScript** para type safety
- **Tailwind CSS** para estilos
- **Web Crypto API** para operaciones criptográficas
- **React Hook Form** para manejo de formularios

### Backend
- **Next.js API Routes** para el backend
- **Prisma ORM** para gestión de base de datos
- **PostgreSQL** como base de datos principal
- **NextAuth.js** para autenticación
- **bcrypt** para hashing de contraseñas

### Seguridad y Criptografía
- **AES-256-GCM** para cifrado simétrico de archivos
- **RSA-OAEP** para intercambio seguro de claves
- **ECDSA** para firmas digitales
- **PBKDF2** para derivación de claves desde contraseñas
- **Web Crypto API** para operaciones criptográficas nativas

## Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Configuración del Entorno

1. Clona el repositorio:
```bash
git clone <repository-url>
cd e2ee
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

4. Configura la base de datos:
```bash
npx prisma migrate dev
npx prisma generate
```

5. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

## Documentación Técnica

- [Arquitectura del Sistema](./docs/architecture.md)
- [Seguridad y Criptografía](./docs/security.md)
- [API Reference](./docs/api.md)
- [Guía de Despliegue](./docs/deployment.md)
