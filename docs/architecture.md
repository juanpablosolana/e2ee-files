# Arquitectura del Sistema

## Visión General

La plataforma utiliza una arquitectura de tres capas con cifrado de extremo a extremo, donde el cifrado y descifrado ocurre exclusivamente en el cliente, garantizando que el servidor nunca tenga acceso a los datos en texto plano.

## Selección de Tecnologías

### Frontend (Next.js + TypeScript)
**Justificación**: Next.js proporciona renderizado híbrido, optimización automática y API routes integradas. TypeScript añade type safety crucial para operaciones criptográficas.

**Ventajas**:
- Server-side rendering para mejor SEO y performance
- API routes eliminan la necesidad de un servidor separado
- Hot reloading para desarrollo ágil
- Optimización automática de bundles

### Base de Datos (PostgreSQL + Prisma)
**Justificación**: PostgreSQL ofrece robustez, ACID compliance y extensiones criptográficas. Prisma proporciona type safety y migraciones automáticas.

**Ventajas**:
- Soporte nativo para JSON y tipos complejos
- Transacciones ACID para operaciones críticas
- Extensiones de seguridad (pgcrypto)
- Escalabilidad horizontal

### Criptografía (Web Crypto API)
**Justificación**: API nativa del navegador, optimizada y auditada por proveedores de navegadores.

**Ventajas**:
- Operaciones criptográficas en hardware cuando disponible
- Estándares W3C implementados nativamente
- No requiere librerías externas
- Mejor rendimiento que implementaciones JavaScript

## Arquitectura de Seguridad

### Modelo de Amenazas
1. **Compromiso del servidor**: Los datos permanecen cifrados
2. **Compromiso de la base de datos**: Solo metadatos expuestos
3. **Ataques man-in-the-middle**: HTTPS + certificate pinning
4. **Ataques de fuerza bruta**: Rate limiting + PBKDF2
5. **Ataques de ingeniería social**: MFA + auditoría

### Principios de Seguridad
- **Zero-knowledge**: El servidor nunca ve datos en texto plano
- **Defense in depth**: Múltiples capas de seguridad
- **Principle of least privilege**: Acceso mínimo necesario
- **Fail secure**: Fallos seguros por defecto

## Flujo de Datos

### Registro de Usuario
1. Usuario ingresa credenciales
2. Generación de salt único
3. Derivación de clave maestra con PBKDF2
4. Generación de par de claves RSA
5. Cifrado de clave privada con clave maestra
6. Almacenamiento de clave pública y clave privada cifrada

### Subida de Archivo
1. Selección de archivo en el cliente
2. Generación de clave AES-256 aleatoria
3. Cifrado del archivo con AES-256-GCM
4. Cifrado de la clave AES con RSA público del usuario
5. Envío de archivo cifrado + clave cifrada al servidor
6. Almacenamiento en base de datos

### Descarga de Archivo
1. Solicitud de archivo por ID
2. Verificación de permisos en servidor
3. Envío de archivo cifrado + clave cifrada
4. Descifrado de clave AES con RSA privado del usuario
5. Descifrado del archivo con clave AES
6. Presentación del archivo al usuario

## Componentes del Sistema

### Capa de Presentación
- **Dashboard**: Interfaz principal del usuario
- **File Manager**: Gestión de archivos y carpetas
- **Sharing Interface**: Compartición y permisos
- **Audit Viewer**: Visualización de logs de auditoría

### Capa de Lógica de Negocio
- **Authentication Service**: Gestión de usuarios y sesiones
- **Encryption Service**: Operaciones criptográficas
- **File Service**: Gestión de archivos
- **Sharing Service**: Compartición y permisos
- **Audit Service**: Registro de eventos

### Capa de Datos
- **User Store**: Información de usuarios
- **File Store**: Metadatos y archivos cifrados
- **Permission Store**: Permisos y compartición
- **Audit Store**: Logs de auditoría

## Escalabilidad y Performance

### Estrategias de Escalabilidad
- **Horizontal scaling**: Múltiples instancias de Next.js
- **Database sharding**: Particionado por usuario
- **CDN**: Distribución de archivos estáticos
- **Caching**: Redis para sesiones y metadatos

### Optimizaciones de Performance
- **Lazy loading**: Carga bajo demanda
- **Compression**: Compresión antes del cifrado
- **Streaming**: Procesamiento de archivos grandes
- **Worker threads**: Operaciones criptográficas en background

## Consideraciones de Despliegue

### Infraestructura Recomendada
- **Contenedores**: Docker para consistencia
- **Orquestación**: Kubernetes para escalabilidad
- **Load balancer**: NGINX con SSL termination
- **Monitoring**: Prometheus + Grafana

### Seguridad en Producción
- **HTTPS obligatorio**: TLS 1.3 mínimo
- **HSTS**: Strict Transport Security
- **CSP**: Content Security Policy estricta
- **Rate limiting**: Protección contra ataques
- **WAF**: Web Application Firewall
