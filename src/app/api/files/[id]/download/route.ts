/**
 * API Route para descargar archivos cifrados
 * GET /api/files/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateFilePermission, logAuditEvent, getClientIP } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  
  try {
    // Verificar autenticación
    const user = await requireAuth(request);

    // Verificar permisos de lectura
    const hasPermission = await validateFilePermission(fileId, user.id, 'read');
    if (!hasPermission) {
      await logAuditEvent(
        'file_download_denied',
        user.id,
        fileId,
        { reason: 'insufficient_permissions' },
        getClientIP(request),
        request.headers.get('user-agent') || undefined,
        false,
        'Permisos insuficientes'
      );

      return NextResponse.json(
        { error: 'No tienes permisos para descargar este archivo' },
        { status: 403 }
      );
    }

    // Obtener archivo
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        encryptedSize: true,
        encryptedData: true,
        encryptedKey: true,
        iv: true,
        authTag: true,
        checksum: true,
        encryptedMetadata: true,
        ownerId: true,
        isDeleted: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    if (file.isDeleted) {
      return NextResponse.json(
        { error: 'Archivo eliminado' },
        { status: 410 }
      );
    }

    // Determinar la clave cifrada apropiada
    let encryptedKey = file.encryptedKey;

    // Si el usuario no es el propietario, obtener la clave re-cifrada
    if (file.ownerId !== user.id) {
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_sharedWithId: {
            fileId,
            sharedWithId: user.id,
          },
        },
        select: {
          encryptedKey: true,
          isRevoked: true,
          expiresAt: true,
        },
      });

      if (!share || share.isRevoked || (share.expiresAt && share.expiresAt < new Date())) {
        return NextResponse.json(
          { error: 'Acceso al archivo revocado o expirado' },
          { status: 403 }
        );
      }

      // Verificar si es un archivo compartido en modo demo
      if (share.encryptedKey.startsWith('DEMO_')) {
        return NextResponse.json(
          { 
            error: 'Este archivo fue compartido contigo pero está en modo demostración. Para descargarlo, el propietario necesitaría re-cifrar la clave del archivo específicamente para tu clave pública RSA. Esta es una limitación del demo - en producción esto se haría automáticamente durante el proceso de compartir.',
            isSharedDemo: true,
            fileName: file.filename
          },
          { status: 501 }
        );
      }

      encryptedKey = share.encryptedKey;
    }

    // Preparar datos para el cliente
    const responseData = {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
      encryptedSize: Number(file.encryptedSize),
      encryptedData: Buffer.from(file.encryptedData).toString('base64'),
      encryptedKey,
      iv: file.iv,
      authTag: file.authTag,
      checksum: file.checksum,
      encryptedMetadata: file.encryptedMetadata,
    };

    // Registrar evento de auditoría
    await logAuditEvent(
      'file_download',
      user.id,
      fileId,
      { 
        filename: file.filename,
        size: Number(file.size),
        isOwner: file.ownerId === user.id,
      },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error descargando archivo:', error);

    await logAuditEvent(
      'file_download_error',
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
