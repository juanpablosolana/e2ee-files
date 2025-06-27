/**
 * API Route para login de usuarios
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, logAuditEvent, getClientIP } from '@/lib/auth';

// Esquema de validación para login
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        publicKey: true,
        encryptedPrivateKey: true,
        salt: true,
        isEmailVerified: true,
        isTwoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      await logAuditEvent(
        'login_attempt',
        undefined,
        undefined,
        { email, reason: 'user_not_found' },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        false,
        'Usuario no encontrado'
      );

      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await logAuditEvent(
        'login_attempt',
        user.id,
        undefined,
        { email, reason: 'invalid_password' },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        false,
        'Contraseña inválida'
      );

      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Email verification check removed - users can login immediately after registration

    // Crear sesión
    const sessionData = await createSession(
      user.id,
      getClientIP(request),
      request.headers.get('user-agent') || undefined
    );

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Registrar evento de auditoría exitoso
    await logAuditEvent(
      'user_login',
      user.id,
      undefined,
      { email, sessionId: sessionData.sessionId },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    // Preparar respuesta
    const response = {
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        publicKey: user.publicKey,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
      session: {
        sessionId: sessionData.sessionId,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
      },
      // Datos necesarios para descifrar la clave privada en el cliente
      cryptoData: {
        encryptedPrivateKey: user.encryptedPrivateKey,
        salt: user.salt,
      },
    };

    // Si tiene 2FA habilitado, requerir verificación adicional
    if (user.isTwoFactorEnabled) {
      return NextResponse.json(
        {
          ...response,
          requires2FA: true,
          message: 'Se requiere verificación de segundo factor',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error en login:', error);

    await logAuditEvent(
      'login_error',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      false,
      error instanceof Error ? error.message : 'Error interno del servidor'
    );

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
