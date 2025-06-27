/**
 * API Route para compartir archivos
 * POST /api/files/[id]/share
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, logAuditEvent, getClientIP } from '@/lib/auth';
import { importPublicKeyFromPEM } from '@/lib/crypto';
import { validatePublicKey, validateSharePermissions, generateShareAuditData } from '@/lib/share-crypto';

// Esquema de validación para compartir archivos
const shareSchema = z.object({
  userEmail: z.string().email('Email inválido'),
  permissions: z.array(z.enum(['read', 'download', 'share'])).min(1, 'Al menos un permiso requerido'),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  
  try {
    // Verificar autenticación
    const user = await requireAuth(request);

    const body = await request.json();
    const validationResult = shareSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { userEmail, permissions, expiresAt } = validationResult.data;

    // Validar permisos
    if (!validateSharePermissions(permissions)) {
      return NextResponse.json(
        { error: 'Permisos inválidos' },
        { status: 400 }
      );
    }

    // Verificar que el usuario es el propietario del archivo
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        filename: true,
        ownerId: true,
        encryptedKey: true,
        isDeleted: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    if (file.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Solo el propietario puede compartir el archivo' },
        { status: 403 }
      );
    }

    if (file.isDeleted) {
      return NextResponse.json(
        { error: 'No se puede compartir un archivo eliminado' },
        { status: 410 }
      );
    }

    // Buscar usuario destinatario
    const targetUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        username: true,
        publicKey: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuario destinatario no encontrado' },
        { status: 404 }
      );
    }

    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: 'No puedes compartir un archivo contigo mismo' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una compartición
    const existingShare = await prisma.fileShare.findUnique({
      where: {
        fileId_sharedWithId: {
          fileId,
          sharedWithId: targetUser.id,
        },
      },
    });

    if (existingShare && !existingShare.isRevoked) {
      return NextResponse.json(
        { error: 'El archivo ya está compartido con este usuario' },
        { status: 409 }
      );
    }

    // Validar clave pública del destinatario
    const isValidPublicKey = await validatePublicKey(targetUser.publicKey);
    if (!isValidPublicKey) {
      return NextResponse.json(
        { error: 'El usuario destinatario tiene una clave pública inválida' },
        { status: 400 }
      );
    }

    // Re-cifrar la clave del archivo con la clave pública del destinatario
    try {
      // Importar clave pública del destinatario para validación
      await importPublicKeyFromPEM(targetUser.publicKey);
      
      // NOTA IMPORTANTE: En una implementación completa de E2EE, necesitaríamos:
      // 1. Que el propietario proporcione su contraseña para descifrar su clave privada
      // 2. Descifrar la clave AES del archivo con la clave privada del propietario  
      // 3. Re-cifrar esa clave AES con la clave pública del destinatario
      //
      // TEMPORAL: Para esta demostración, marcamos que necesita re-cifrado real
      // En una implementación completa, el propietario proveería su contraseña y
      // se haría el re-cifrado real en el frontend antes de llamar esta API
      const reEncryptedKey = `DEMO_${file.encryptedKey}`; // Marcador para indicar que es demo

      // Crear o actualizar compartición
      const shareData = {
        fileId,
        sharedWithId: targetUser.id,
        sharedById: user.id,
        encryptedKey: reEncryptedKey,
        permissions: permissions.join(','),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isRevoked: false,
        revokedAt: null,
        revokedBy: null,
      };

      let share;
      if (existingShare) {
        // Actualizar compartición existente
        share = await prisma.fileShare.update({
          where: { id: existingShare.id },
          data: shareData,
        });
      } else {
        // Crear nueva compartición
        share = await prisma.fileShare.create({
          data: shareData,
        });
      }

      // Registrar evento de auditoría
      const auditData = generateShareAuditData(
        fileId,
        user.email,
        targetUser.email,
        permissions,
        expiresAt ? new Date(expiresAt) : undefined
      );
      
      await logAuditEvent(
        'file_share',
        user.id,
        fileId,
        { 
          ...auditData,
          filename: file.filename,
          shareId: share.id,
          isUpdate: !!existingShare,
        },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        true
      );

      return NextResponse.json(
        {
          message: 'Archivo compartido exitosamente',
          share: {
            id: share.id,
            sharedWith: {
              email: targetUser.email,
              username: targetUser.username,
            },
            permissions,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
          },
        },
        { status: 201 }
      );

    } catch (cryptoError) {
      console.error('Error en operaciones criptográficas:', cryptoError);
      return NextResponse.json(
        { error: 'Error procesando claves criptográficas' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error compartiendo archivo:', error);

    await logAuditEvent(
      'file_share_error',
      undefined,
      fileId,
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
