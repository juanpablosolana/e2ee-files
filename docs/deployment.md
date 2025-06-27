# Guía de Despliegue

## Requisitos del Sistema

### Mínimos
- Node.js 18.0+
- 2GB RAM
- 10GB espacio en disco
- PostgreSQL 14+ (producción)

### Recomendados
- Node.js 20.0+
- 4GB RAM
- 50GB espacio en disco SSD
- PostgreSQL 15+
- Redis (para caché y sesiones)

## Configuración de Producción

### 1. Variables de Entorno

Crear archivo `.env.production`:

```bash
# Base de datos
DATABASE_URL="postgresql://username:password@localhost:5432/e2ee_production"

# NextAuth.js
NEXTAUTH_URL="https://tu-dominio.com"
NEXTAUTH_SECRET="clave-secreta-muy-segura-de-32-caracteres-minimo"

# Configuración de la aplicación
APP_NAME="E2EE Document Storage"
APP_URL="https://tu-dominio.com"
NODE_ENV="production"

# Configuración de cifrado
ENCRYPTION_ALGORITHM="AES-256-GCM"
KEY_DERIVATION_ITERATIONS=100000

# Configuración de archivos
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES="pdf,doc,docx,txt,jpg,jpeg,png,gif,zip"

# Configuración de sesiones
SESSION_TIMEOUT=900  # 15 minutos
REFRESH_TOKEN_TIMEOUT=604800  # 7 días

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900

# Configuración de email (opcional)
SMTP_HOST="smtp.tu-proveedor.com"
SMTP_PORT="587"
SMTP_USER="tu-email@dominio.com"
SMTP_PASS="tu-password-smtp"
SMTP_FROM="noreply@tu-dominio.com"

# Logging
LOG_LEVEL="info"
```

### 2. Base de Datos

#### PostgreSQL Setup

```bash
# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Crear usuario y base de datos
sudo -u postgres psql
CREATE USER e2ee_user WITH PASSWORD 'password_seguro';
CREATE DATABASE e2ee_production OWNER e2ee_user;
GRANT ALL PRIVILEGES ON DATABASE e2ee_production TO e2ee_user;
\q

# Configurar conexiones
sudo nano /etc/postgresql/15/main/postgresql.conf
# Descomentar y configurar:
# listen_addresses = 'localhost'
# port = 5432

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Agregar línea:
# local   e2ee_production   e2ee_user                     md5

sudo systemctl restart postgresql
```

#### Migración de Base de Datos

```bash
# Ejecutar migraciones
npx prisma migrate deploy

# Generar cliente Prisma
npx prisma generate
```

### 3. Construcción de la Aplicación

```bash
# Instalar dependencias
npm ci --only=production

# Construir aplicación
npm run build

# Verificar construcción
npm run start
```

## Opciones de Despliegue

### Opción 1: Vercel (Recomendado para desarrollo)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Configurar proyecto
vercel

# Configurar variables de entorno en Vercel Dashboard
# Desplegar
vercel --prod
```

**Variables de entorno en Vercel:**
- Ir a Project Settings > Environment Variables
- Agregar todas las variables del archivo `.env.production`

### Opción 2: Docker

#### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Instalar dependencias solo cuando sea necesario
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Reconstruir código fuente solo cuando sea necesario
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar Prisma Client
RUN npx prisma generate

# Construir aplicación
RUN npm run build

# Imagen de producción
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copiar archivos de construcción
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://e2ee_user:password@db:5432/e2ee_production
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=your-secret-key
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=e2ee_production
      - POSTGRES_USER=e2ee_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Comandos Docker

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Ejecutar migraciones
docker-compose exec app npx prisma migrate deploy

# Parar servicios
docker-compose down
```

### Opción 3: VPS/Servidor Dedicado

#### 1. Configuración del Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar Nginx
sudo apt install nginx

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

#### 2. Configuración de Nginx

```nginx
# /etc/nginx/sites-available/e2ee
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";

    # Configuración de proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Límites de tamaño de archivo
    client_max_body_size 100M;
}
```

#### 3. SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Configurar renovación automática
sudo crontab -e
# Agregar línea:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 4. Configuración de PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'e2ee-app',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/your/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Configurar inicio automático
pm2 startup
pm2 save

# Monitorear
pm2 monit
```

## Monitoreo y Mantenimiento

### 1. Logs

```bash
# Logs de aplicación
pm2 logs e2ee-app

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### 2. Backup de Base de Datos

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="e2ee_production"

# Crear backup
pg_dump -h localhost -U e2ee_user $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Mantener solo últimos 7 días
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

# Configurar cron para backup diario
# 0 2 * * * /path/to/backup.sh
```

### 3. Actualizaciones

```bash
# Actualizar aplicación
git pull origin main
npm ci
npm run build
pm2 restart e2ee-app

# Ejecutar migraciones si es necesario
npx prisma migrate deploy
```

## Consideraciones de Seguridad

### 1. Firewall
- Solo abrir puertos necesarios (22, 80, 443)
- Configurar fail2ban para SSH

### 2. Base de Datos
- Usar conexiones SSL
- Configurar backup cifrado
- Restringir acceso por IP

### 3. Aplicación
- Usar HTTPS obligatorio
- Configurar CSP headers
- Implementar rate limiting
- Monitorear logs de seguridad

### 4. Sistema
- Mantener sistema actualizado
- Configurar monitoreo de recursos
- Implementar alertas de seguridad
