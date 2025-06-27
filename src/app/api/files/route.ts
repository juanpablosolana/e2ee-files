/**
 * API Route para listar archivos del usuario
 * GET /api/files
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, logAuditEvent, getClientIP } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await requireAuth(request);

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';

    // Validar parámetros
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parámetros de paginación inválidos' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    // Construir filtros
    const where = {
      ownerId: user.id,
      isDeleted: false,
      ...(search && {
        filename: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }),
    };

    // Obtener archivos del usuario
    const [files, totalCount] = await Promise.all([
      prisma.file.findMany({
        where,
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          checksum: true,
          createdAt: true,
          updatedAt: true,
          encryptedMetadata: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.file.count({ where }),
    ]);

    // Obtener archivos compartidos con el usuario
    const sharedFiles = await prisma.fileShare.findMany({
      where: {
        sharedWithId: user.id,
        isRevoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            checksum: true,
            createdAt: true,
            updatedAt: true,
            encryptedMetadata: true,
            owner: {
              select: {
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Formatear respuesta
    const ownFiles = files.map(file => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
      checksum: file.checksum,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      encryptedMetadata: file.encryptedMetadata,
      isOwner: true,
      sharedBy: null,
    }));

    const sharedFilesFormatted = sharedFiles.map(share => ({
      id: share.file.id,
      filename: share.file.filename,
      mimeType: share.file.mimeType,
      size: Number(share.file.size),
      checksum: share.file.checksum,
      createdAt: share.file.createdAt,
      updatedAt: share.file.updatedAt,
      encryptedMetadata: share.file.encryptedMetadata,
      isOwner: false,
      sharedBy: {
        username: share.file.owner.username,
        email: share.file.owner.email,
      },
      permissions: share.permissions.split(',').map(p => p.trim()),
      sharedAt: share.createdAt,
      expiresAt: share.expiresAt,
    }));

    const allFiles = [...ownFiles, ...sharedFilesFormatted];

    // Registrar evento de auditoría
    await logAuditEvent(
      'files_list',
      user.id,
      undefined,
      {
        page,
        limit,
        search,
        totalFiles: totalCount,
        sharedFiles: sharedFiles.length,
      },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      {
        files: allFiles,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        summary: {
          ownFiles: files.length,
          sharedFiles: sharedFiles.length,
          totalFiles: allFiles.length,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error listando archivos:', error);

    await logAuditEvent(
      'files_list_error',
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
