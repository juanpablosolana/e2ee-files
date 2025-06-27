/**
 * API Route para registro de usuarios
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, logAuditEvent, getClientIP } from '@/lib/auth';

// Esquema de validación para registro
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z.string().min(3, 'Username debe tener al menos 3 caracteres').max(50),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
  publicKey: z.string().min(1, 'Clave pública requerida'),
  encryptedPrivateKey: z.string().min(1, 'Clave privada cifrada requerida'),
  salt: z.string().min(1, 'Salt requerido'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { email, username, password, publicKey, encryptedPrivateKey, salt } = validationResult.data;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      await logAuditEvent(
        'register_attempt',
        undefined,
        undefined,
        { email, username, reason: `${field}_exists` },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        false,
        `${field} ya existe`
      );

      return NextResponse.json(
        { error: `El ${field} ya está en uso` },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        salt,
        publicKey,
        encryptedPrivateKey,
        isEmailVerified: true, // Email verification disabled - set to true by default
      },
      select: {
        id: true,
        email: true,
        username: true,
        publicKey: true,
        isEmailVerified: true,
        isTwoFactorEnabled: true,
        createdAt: true,
      },
    });

    // Registrar evento de auditoría
    await logAuditEvent(
      'user_registered',
      user.id,
      undefined,
      { email, username },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      {
        message: 'Usuario registrado exitosamente',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          publicKey: user.publicKey,
          isEmailVerified: user.isEmailVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error en registro:', error);

    await logAuditEvent(
      'register_error',
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
