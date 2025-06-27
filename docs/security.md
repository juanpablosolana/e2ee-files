# Seguridad y Criptografía

## Principios de Seguridad

### Zero-Knowledge Architecture
El servidor nunca tiene acceso a los datos en texto plano. Toda la criptografía ocurre en el cliente, garantizando que incluso un compromiso completo del servidor no exponga los datos del usuario.

### Defense in Depth
Múltiples capas de seguridad protegen el sistema:
- Cifrado de extremo a extremo
- Autenticación multifactor
- Validación de integridad
- Auditoría completa
- Rate limiting
- HTTPS obligatorio

## Algoritmos Criptográficos

### Cifrado Simétrico: AES-256-GCM
**Uso**: Cifrado de archivos
**Justificación**: 
- Estándar NIST aprobado
- Autenticación integrada (AEAD)
- Resistente a ataques de padding
- Excelente rendimiento

**Implementación**:
```javascript
// Generación de clave AES
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"]
);

// Cifrado
const encrypted = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv: iv },
  key,
  data
);
```

### Cifrado Asimétrico: RSA-OAEP
**Uso**: Intercambio seguro de claves AES
**Justificación**:
- Estándar bien establecido
- Soporte nativo en Web Crypto API
- Padding OAEP previene ataques
- Claves de 2048 bits mínimo

**Implementación**:
```javascript
// Generación de par de claves RSA
const keyPair = await crypto.subtle.generateKey(
  {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  },
  true,
  ["encrypt", "decrypt"]
);
```

### Firmas Digitales: ECDSA
**Uso**: Verificación de integridad y autenticidad
**Justificación**:
- Claves más pequeñas que RSA
- Mejor rendimiento
- Resistente a ataques cuánticos conocidos
- Curva P-256 estándar

### Derivación de Claves: PBKDF2
**Uso**: Derivación de clave maestra desde contraseña
**Parámetros**:
- 100,000 iteraciones mínimo
- Salt de 128 bits
- SHA-256 como función hash
- Clave derivada de 256 bits

## Gestión de Claves

### Jerarquía de Claves
1. **Clave Maestra**: Derivada de contraseña del usuario
2. **Clave Privada RSA**: Cifrada con clave maestra
3. **Claves AES**: Una por archivo, cifradas con RSA público

### Rotación de Claves
- **Claves de archivo**: No se rotan (inmutables)
- **Claves de usuario**: Rotación anual recomendada
- **Claves de sesión**: Rotación cada 24 horas

### Almacenamiento Seguro
- **Cliente**: Claves en memoria volátil únicamente
- **Servidor**: Solo claves públicas y privadas cifradas
- **Base de datos**: Nunca claves en texto plano

## Autenticación y Autorización

### Autenticación Multifactor
1. **Factor 1**: Contraseña (algo que sabes)
2. **Factor 2**: TOTP/SMS (algo que tienes)
3. **Factor 3**: Biometría (algo que eres) - opcional

### Gestión de Sesiones
- **JWT tokens**: Firmados con HS256
- **Refresh tokens**: Rotación automática
- **Expiración**: 15 minutos para access tokens
- **Revocación**: Lista negra de tokens

### Control de Acceso
- **RBAC**: Role-Based Access Control
- **Permisos granulares**: Lectura, escritura, compartir
- **Principio de menor privilegio**: Acceso mínimo necesario

## Compartición Segura

### Modelo de Compartición
1. Usuario A quiere compartir archivo con Usuario B
2. Sistema obtiene clave pública de Usuario B
3. Clave AES del archivo se re-cifra con clave pública de B
4. Se crea entrada de permiso en base de datos
5. Usuario B puede descifrar con su clave privada

### Revocación de Acceso
- **Inmediata**: Eliminación de permisos en base de datos
- **Re-cifrado**: Para revocación permanente
- **Notificaciones**: Alertas de cambios de permisos

## Auditoría y Monitoreo

### Eventos Auditados
- Inicio/cierre de sesión
- Subida/descarga de archivos
- Compartición/revocación de permisos
- Cambios de configuración
- Intentos de acceso fallidos

### Integridad de Logs
- **Firma digital**: Cada entrada firmada
- **Hash chain**: Cadena de hashes para detectar modificaciones
- **Timestamps**: Sellado de tiempo criptográfico

## Validaciones de Seguridad

### Validación de Entrada
- **Sanitización**: Todos los inputs sanitizados
- **Validación de tipos**: TypeScript + runtime validation
- **Límites de tamaño**: Archivos y requests limitados

### Protección CSRF
- **SameSite cookies**: Strict mode
- **CSRF tokens**: Para operaciones críticas
- **Origin validation**: Verificación de origen

### Protección XSS
- **CSP**: Content Security Policy estricta
- **Sanitización**: HTML sanitizado
- **Escape**: Datos escapados en templates

## Consideraciones de Implementación

### Manejo de Errores
- **No información sensible**: Errores genéricos al cliente
- **Logging detallado**: Solo en servidor
- **Fail secure**: Fallos seguros por defecto

### Performance vs Seguridad
- **Web Workers**: Operaciones criptográficas en background
- **Streaming**: Para archivos grandes
- **Caching**: Metadatos únicamente, nunca datos sensibles

### Compatibilidad
- **Navegadores modernos**: Chrome 60+, Firefox 57+, Safari 11+
- **Fallbacks**: Detección de capacidades
- **Progressive enhancement**: Funcionalidad básica sin JS

## Cumplimiento y Estándares

### Estándares Seguidos
- **NIST**: Algoritmos criptográficos aprobados
- **OWASP**: Top 10 mitigado
- **W3C**: Web Crypto API estándar
- **RFC**: Estándares IETF implementados

### Consideraciones Legales
- **GDPR**: Derecho al olvido implementado
- **Residencia de datos**: Configuración por región
- **Retención**: Políticas de retención configurables
