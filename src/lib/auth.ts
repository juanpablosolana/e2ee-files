/**
 * Utilidades de autenticación y autorización
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

// Función para obtener IP del request
export function getClientIP(request: NextRequest): string | undefined {
  // Verificar headers comunes de proxy
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // En desarrollo local, no hay IP disponible
  return undefined;
}

// Tipos para autenticación
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  publicKey: string;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface SessionData {
  user: AuthUser;
  sessionId: string;
  expiresAt: Date;
}

// Configuración de JWT
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Hash de contraseña con bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verificar contraseña con hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generar token JWT
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'e2ee-app',
    audience: 'e2ee-users',
  });
}

/**
 * Generar refresh token
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'e2ee-app',
    audience: 'e2ee-users',
  });
}

/**
 * Verificar y decodificar token JWT
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'e2ee-app',
      audience: 'e2ee-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
}

/**
 * Crear nueva sesión de usuario
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; accessToken: string; refreshToken: string }> {
  // Crear sesión en base de datos
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken: generateSessionToken(),
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Obtener datos del usuario
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      publicKey: true,
      isEmailVerified: true,
      isTwoFactorEnabled: true,
    },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Generar tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    sessionId: session.id,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Actualizar sesión con tokens
  await prisma.session.update({
    where: { id: session.id },
    data: {
      accessToken,
      refreshToken,
    },
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
  };
}

/**
 * Validar sesión activa
 */
export async function validateSession(sessionId: string): Promise<SessionData | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            publicKey: true,
            isEmailVerified: true,
            isTwoFactorEnabled: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return {
      user: session.user,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    console.error('Error validando sesión:', error);
    return null;
  }
}

/**
 * Revocar sesión
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  });
}

/**
 * Revocar todas las sesiones de un usuario
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Obtener usuario autenticado desde request
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return null;
    }

    // Validar sesión
    const sessionData = await validateSession(payload.sessionId);
    if (!sessionData) {
      return null;
    }

    return sessionData.user;
  } catch (error) {
    console.error('Error obteniendo usuario autenticado:', error);
    return null;
  }
}

/**
 * Middleware de autenticación
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new Error('No autorizado');
  }
  return user;
}

/**
 * Generar token de sesión único
 */
function generateSessionToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Registrar evento de auditoría
 */
export async function logAuditEvent(
  action: string,
  userId?: string,
  fileId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        fileId,
        action,
        details: details as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        success,
        errorMessage,
      },
    });
  } catch (error) {
    console.error('Error registrando evento de auditoría:', error);
  }
}

/**
 * Validar permisos de archivo
 */
export async function validateFilePermission(
  fileId: string,
  userId: string,
  permission: 'read' | 'write' | 'share' | 'delete'
): Promise<boolean> {
  try {
    // Verificar si es el propietario
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { ownerId: true },
    });

    if (!file) {
      return false;
    }

    if (file.ownerId === userId) {
      return true; // El propietario tiene todos los permisos
    }

    // Verificar permisos compartidos
    const share = await prisma.fileShare.findUnique({
      where: {
        fileId_sharedWithId: {
          fileId,
          sharedWithId: userId,
        },
      },
    });

    if (!share || share.isRevoked || (share.expiresAt && share.expiresAt < new Date())) {
      return false;
    }

    // Convertir permisos de string a array
    const userPermissions = share.permissions.split(',').map(p => p.trim());

    // Mapear permisos
    const permissionMap: Record<string, string[]> = {
      read: ['read', 'download', 'share'],
      write: ['write'],
      share: ['share'],
      delete: [], // Solo el propietario puede eliminar
    };

    return userPermissions.some(p => permissionMap[permission]?.includes(p));
  } catch (error) {
    console.error('Error validando permisos de archivo:', error);
    return false;
  }
}
