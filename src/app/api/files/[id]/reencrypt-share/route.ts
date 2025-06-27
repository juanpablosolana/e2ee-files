/**
 * API Route para re-cifrar una clave de archivo compartido con E2EE completo
 * POST /api/files/[id]/reencrypt-share
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, logAuditEvent, getClientIP } from '@/lib/auth';
import { reEncryptFileKey } from '@/lib/share-crypto';

// Esquema de validación para re-cifrado
const reEncryptSchema = z.object({
  shareId: z.string().min(1, 'ID de compartición requerido'),
  ownerPrivateKeyData: z.string().min(1, 'Clave privada del propietario requerida'),
  targetUserEmail: z.string().email('Email del destinatario requerido'),
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
    const validationResult = reEncryptSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { shareId, ownerPrivateKeyData, targetUserEmail } = validationResult.data;

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
        { error: 'Solo el propietario puede re-cifrar claves' },
        { status: 403 }
      );
    }

    if (file.isDeleted) {
      return NextResponse.json(
        { error: 'No se puede re-cifrar un archivo eliminado' },
        { status: 410 }
      );
    }

    // Obtener la compartición
    const share = await prisma.fileShare.findUnique({
      where: { id: shareId },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            publicKey: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Compartición no encontrada' },
        { status: 404 }
      );
    }

    if (share.fileId !== fileId) {
      return NextResponse.json(
        { error: 'La compartición no corresponde al archivo' },
        { status: 400 }
      );
    }

    if (share.sharedWith.email !== targetUserEmail) {
      return NextResponse.json(
        { error: 'Email del destinatario no coincide' },
        { status: 400 }
      );
    }

    // Re-cifrar la clave del archivo
    try {
      // Obtener la clave original (sin el prefijo DEMO_ si existe)
      const originalEncryptedKey = file.encryptedKey.startsWith('DEMO_') 
        ? file.encryptedKey.substring(5) 
        : file.encryptedKey;

      // Importar la clave privada del propietario
      const ownerPrivateKey = await crypto.subtle.importKey(
        'pkcs8',
        Buffer.from(ownerPrivateKeyData, 'base64'),
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['decrypt']
      );

      // Re-cifrar la clave con la clave pública del destinatario
      const reEncryptedKey = await reEncryptFileKey(
        originalEncryptedKey,
        ownerPrivateKey,
        share.sharedWith.publicKey
      );

      // Actualizar la compartición con la clave re-cifrada real
      await prisma.fileShare.update({
        where: { id: shareId },
        data: {
          encryptedKey: reEncryptedKey,
        },
      });

      // Registrar evento de auditoría
      await logAuditEvent(
        'file_reencrypt_share',
        user.id,
        fileId,
        { 
          filename: file.filename,
          targetEmail: targetUserEmail,
          shareId,
        },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        true
      );

      return NextResponse.json(
        {
          message: 'Clave re-cifrada exitosamente. El destinatario ya puede descargar el archivo.',
          shareId,
        },
        { status: 200 }
      );

    } catch (cryptoError) {
      console.error('Error en re-cifrado:', cryptoError);
      return NextResponse.json(
        { error: 'Error procesando el re-cifrado E2EE' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error en re-cifrado de compartición:', error);

    await logAuditEvent(
      'file_reencrypt_share_error',
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