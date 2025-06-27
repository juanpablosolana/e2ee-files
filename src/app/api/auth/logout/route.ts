/**
 * API Route para logout de usuarios
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, revokeSession, logAuditEvent, getClientIP } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Obtener usuario autenticado
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener sessionId del token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token.split('.')[1])); // Decodificar payload JWT
    const sessionId = payload.sessionId;

    // Revocar sesión
    await revokeSession(sessionId);

    // Registrar evento de auditoría
    await logAuditEvent(
      'user_logout',
      user.id,
      undefined,
      { sessionId },
      getClientIP(request),
      request.headers.get('user-agent') || undefined,
      true
    );

    return NextResponse.json(
      { message: 'Logout exitoso' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error en logout:', error);

    await logAuditEvent(
      'logout_error',
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
