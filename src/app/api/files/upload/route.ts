/**
 * API Route para subida de archivos cifrados
 * POST /api/files/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, logAuditEvent, getClientIP } from '@/lib/auth';

// Esquema de validación para subida de archivos
const uploadSchema = z.object({
  filename: z.string().min(1, 'Nombre de archivo requerido'),
  mimeType: z.string().min(1, 'Tipo MIME requerido'),
  size: z.string().transform(val => parseInt(val, 10)),
  encryptedData: z.string().min(1, 'Datos cifrados requeridos'),
  encryptedKey: z.string().min(1, 'Clave cifrada requerida'),
  iv: z.string().min(1, 'IV requerido'),
  authTag: z.string().min(1, 'Tag de autenticación requerido'),
  checksum: z.string().min(1, 'Checksum requerido'),
  encryptedMetadata: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await requireAuth(request);

    // Obtener datos del formulario
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());

    // Validar datos
    const validationResult = uploadSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const {
      filename,
      mimeType,
      size,
      encryptedData,
      encryptedKey,
      iv,
      authTag,
      checksum,
      encryptedMetadata,
    } = validationResult.data;

    // Validar tamaño de archivo
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (size > maxSize) {
      return NextResponse.json(
        { error: `Archivo demasiado grande. Máximo: ${maxSize / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // Convertir datos base64 a Buffer para almacenamiento
    const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
    const encryptedSize = encryptedDataBuffer.length;

    // Crear archivo en base de datos
    const file = await prisma.file.create({
      data: {
        filename,
        mimeType,
        size: BigInt(size),
        encryptedSize: BigInt(encryptedSize),
        encryptedData: encryptedDataBuffer,
        encryptedKey,
        iv,
        authTag,
        checksum,
        ownerId: user.id,
        encryptedMetadata,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });

    // Registrar evento de auditoría
    await logAuditEvent(
      'file_upload',
      user.id,
      file.id,
      { 
        filename,
        mimeType,
        size,
        encryptedSize,
      },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      {
        message: 'Archivo subido exitosamente',
        fileId: file.id,
        file: {
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: Number(file.size),
          createdAt: file.createdAt,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error en subida de archivo:', error);

    await logAuditEvent(
      'file_upload_error',
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
