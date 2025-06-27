/**
 * API Routes para operaciones individuales de archivos
 * GET /api/files/[id] - Obtener información del archivo
 * DELETE /api/files/[id] - Eliminar archivo
 * PUT /api/files/[id] - Actualizar metadatos del archivo
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateFilePermission, logAuditEvent, getClientIP } from '@/lib/auth';

// Esquema para actualización de metadatos
const updateMetadataSchema = z.object({
  encryptedMetadata: z.string().optional(),
});

// GET - Obtener información del archivo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: fileId } = await params;

    // Verificar permisos
    const hasPermission = await validateFilePermission(fileId, user.id, 'read');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para acceder a este archivo' },
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
        checksum: true,
        createdAt: true,
        updatedAt: true,
        encryptedMetadata: true,
        ownerId: true,
        isDeleted: true,
        owner: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!file || file.isDeleted) {
      return NextResponse.json(
        { error: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si es compartido
    let shareInfo = null;
    if (file.ownerId !== user.id) {
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_sharedWithId: {
            fileId,
            sharedWithId: user.id,
          },
        },
        select: {
          permissions: true,
          createdAt: true,
          expiresAt: true,
        },
      });
      shareInfo = share;
    }

    const responseData = {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
      checksum: file.checksum,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      encryptedMetadata: file.encryptedMetadata,
      isOwner: file.ownerId === user.id,
      owner: file.owner,
      shareInfo,
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error obteniendo archivo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar archivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  
  try {
    const user = await requireAuth(request);

    // Verificar que el usuario es el propietario
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        filename: true,
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

    if (file.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Solo el propietario puede eliminar el archivo' },
        { status: 403 }
      );
    }

    if (file.isDeleted) {
      return NextResponse.json(
        { error: 'El archivo ya está eliminado' },
        { status: 410 }
      );
    }

    // Marcar como eliminado (soft delete)
    await prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Revocar todas las comparticiones
    await prisma.fileShare.updateMany({
      where: { fileId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: user.id,
      },
    });

    // Registrar evento de auditoría
    await logAuditEvent(
      'file_delete',
      user.id,
      fileId,
      { filename: file.filename },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      { message: 'Archivo eliminado exitosamente' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error eliminando archivo:', error);

    await logAuditEvent(
      'file_delete_error',
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

// PUT - Actualizar metadatos del archivo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  
  try {
    const user = await requireAuth(request);

    // Verificar permisos de escritura
    const hasPermission = await validateFilePermission(fileId, user.id, 'write');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar este archivo' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateMetadataSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { encryptedMetadata } = validationResult.data;

    // Actualizar archivo
    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        encryptedMetadata,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        filename: true,
        updatedAt: true,
      },
    });

    // Registrar evento de auditoría
    await logAuditEvent(
      'file_update',
      user.id,
      fileId,
      { filename: updatedFile.filename },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      {
        message: 'Archivo actualizado exitosamente',
        file: updatedFile,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error actualizando archivo:', error);

    await logAuditEvent(
      'file_update_error',
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
