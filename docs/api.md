# API Reference

## Autenticación

Todas las rutas protegidas requieren un token de autorización en el header:
```
Authorization: Bearer <access_token>
```

### POST /api/auth/register
Registra un nuevo usuario.

**Body:**
```json
{
  "email": "usuario@email.com",
  "username": "usuario123",
  "password": "contraseña_segura",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "encryptedPrivateKey": "{\"encryptedData\":\"...\",\"iv\":\"...\",\"authTag\":\"...\"}",
  "salt": "base64_salt"
}
```

**Response (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "user_id",
    "email": "usuario@email.com",
    "username": "usuario123",
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "isEmailVerified": false,
    "isTwoFactorEnabled": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/auth/login
Inicia sesión de usuario.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "contraseña_segura"
}
```

**Response (200):**
```json
{
  "message": "Login exitoso",
  "user": {
    "id": "user_id",
    "email": "usuario@email.com",
    "username": "usuario123",
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "isEmailVerified": true,
    "isTwoFactorEnabled": false
  },
  "session": {
    "sessionId": "session_id",
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  },
  "cryptoData": {
    "encryptedPrivateKey": "{...}",
    "salt": "base64_salt"
  }
}
```

### POST /api/auth/logout
Cierra sesión del usuario.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logout exitoso"
}
```

### GET /api/auth/me
Obtiene información del usuario autenticado.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "user_id",
    "email": "usuario@email.com",
    "username": "usuario123",
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "isEmailVerified": true,
    "isTwoFactorEnabled": false
  }
}
```

## Gestión de Archivos

### POST /api/files/upload
Sube un archivo cifrado.

**Headers:** `Authorization: Bearer <token>`

**Body (FormData):**
- `filename`: Nombre original del archivo
- `mimeType`: Tipo MIME del archivo
- `size`: Tamaño original en bytes
- `encryptedData`: Datos cifrados en base64
- `encryptedKey`: Clave AES cifrada en base64
- `iv`: Vector de inicialización en base64
- `authTag`: Tag de autenticación en base64
- `checksum`: Hash SHA-256 del archivo original
- `encryptedMetadata`: Metadatos cifrados (opcional)

**Response (201):**
```json
{
  "message": "Archivo subido exitosamente",
  "fileId": "file_id",
  "file": {
    "id": "file_id",
    "filename": "documento.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /api/files
Lista archivos del usuario.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Archivos por página (default: 20, max: 100)
- `search`: Buscar por nombre de archivo

**Response (200):**
```json
{
  "files": [
    {
      "id": "file_id",
      "filename": "documento.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "checksum": "sha256_hash",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "encryptedMetadata": "{...}",
      "isOwner": true,
      "sharedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  },
  "summary": {
    "ownFiles": 45,
    "sharedFiles": 5,
    "totalFiles": 50
  }
}
```

### GET /api/files/[id]
Obtiene información de un archivo específico.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "file_id",
  "filename": "documento.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "checksum": "sha256_hash",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "encryptedMetadata": "{...}",
  "isOwner": true,
  "owner": {
    "username": "propietario",
    "email": "propietario@email.com"
  },
  "shareInfo": null
}
```

### GET /api/files/[id]/download
Descarga un archivo cifrado.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "file_id",
  "filename": "documento.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "encryptedSize": 1024128,
  "encryptedData": "base64_encrypted_data",
  "encryptedKey": "base64_encrypted_key",
  "iv": "base64_iv",
  "authTag": "base64_auth_tag",
  "checksum": "sha256_hash",
  "encryptedMetadata": "{...}"
}
```

### DELETE /api/files/[id]
Elimina un archivo (solo propietario).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Archivo eliminado exitosamente"
}
```

### PUT /api/files/[id]
Actualiza metadatos de un archivo.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "encryptedMetadata": "{...}"
}
```

**Response (200):**
```json
{
  "message": "Archivo actualizado exitosamente",
  "file": {
    "id": "file_id",
    "filename": "documento.pdf",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/files/[id]/share
Comparte un archivo con otro usuario.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "userEmail": "destinatario@email.com",
  "permissions": ["read", "download"],
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

**Response (201):**
```json
{
  "message": "Archivo compartido exitosamente",
  "share": {
    "id": "share_id",
    "sharedWith": {
      "email": "destinatario@email.com",
      "username": "destinatario"
    },
    "permissions": ["read", "download"],
    "expiresAt": "2024-12-31T23:59:59.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Códigos de Error

### 400 Bad Request
Datos de entrada inválidos.

### 401 Unauthorized
Token de autenticación faltante o inválido.

### 403 Forbidden
Permisos insuficientes para la operación.

### 404 Not Found
Recurso no encontrado.

### 409 Conflict
Conflicto con el estado actual del recurso.

### 410 Gone
Recurso eliminado permanentemente.

### 413 Payload Too Large
Archivo demasiado grande.

### 500 Internal Server Error
Error interno del servidor.

## Rate Limiting

Las APIs están protegidas contra abuso con rate limiting:
- 100 requests por 15 minutos por IP
- Límites específicos para operaciones sensibles

## Auditoría

Todas las operaciones se registran en logs de auditoría con:
- Timestamp
- Usuario
- Acción realizada
- Detalles de la operación
- IP y User-Agent
- Resultado (éxito/error)
