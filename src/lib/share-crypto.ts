/**
 * Utilidades criptográficas para compartir archivos E2EE
 */

import {
  decryptKeyWithRSA,
  encryptKeyWithRSA,
  importPublicKeyFromPEM,
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from './crypto';

/**
 * Re-cifra una clave AES para compartir con otro usuario
 * NOTA: En un escenario E2EE real, esto se haría en el frontend
 * donde el usuario propietario tiene acceso a su clave privada descifrada
 */
export async function reEncryptFileKey(
  encryptedFileKey: string, // Clave AES cifrada con RSA público del propietario
  ownerPrivateKey: CryptoKey, // Clave privada RSA del propietario (descifrada)
  targetPublicKeyPEM: string // Clave pública RSA del destinatario en formato PEM
): Promise<string> {
  try {
    // 1. Descifrar la clave AES del archivo con la clave privada del propietario
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedFileKey);
    const aesKey = await decryptKeyWithRSA(encryptedKeyBuffer, ownerPrivateKey);
    
    // 2. Importar la clave pública del destinatario
    const targetPublicKey = await importPublicKeyFromPEM(targetPublicKeyPEM);
    
    // 3. Re-cifrar la clave AES con la clave pública del destinatario
    const reEncryptedKeyBuffer = await encryptKeyWithRSA(aesKey, targetPublicKey);
    
    // 4. Convertir a base64 para almacenamiento
    return arrayBufferToBase64(reEncryptedKeyBuffer);
    
  } catch (error) {
    console.error('Error re-cifrando clave de archivo:', error);
    throw new Error('No se pudo re-cifrar la clave del archivo');
  }
}

/**
 * Datos necesarios para el re-cifrado desde el frontend
 */
export interface ReEncryptRequest {
  fileId: string;
  encryptedFileKey: string; // Clave del archivo cifrada con la clave pública del propietario
  ownerPrivateKeyData: string; // Clave privada del propietario ya descifrada (en formato exportado)
  targetUserEmail: string;
  permissions: string[];
  expiresAt?: string;
}

/**
 * Función que simula el flujo completo E2EE para compartir
 * En producción, esto se ejecutaría en el frontend
 */
export async function shareFileE2EE(
  request: ReEncryptRequest,
  targetPublicKeyPEM: string
): Promise<string> {
  try {
    // Importar la clave privada del propietario
    const ownerPrivateKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToArrayBuffer(request.ownerPrivateKeyData),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );
    
    // Re-cifrar la clave del archivo
    const reEncryptedKey = await reEncryptFileKey(
      request.encryptedFileKey,
      ownerPrivateKey,
      targetPublicKeyPEM
    );
    
    return reEncryptedKey;
    
  } catch (error) {
    console.error('Error en compartir E2EE:', error);
    throw new Error('Error procesando el cifrado E2EE');
  }
}

/**
 * Validar que una clave pública sea válida
 */
export async function validatePublicKey(publicKeyPEM: string): Promise<boolean> {
  try {
    await importPublicKeyFromPEM(publicKeyPEM);
    return true;
  } catch (error) {
    console.error('Clave pública inválida:', error);
    return false;
  }
}

/**
 * Función auxiliar para verificar permisos de compartir
 */
export function validateSharePermissions(permissions: string[]): boolean {
  const validPermissions = ['read', 'download', 'share'];
  
  if (permissions.length === 0) {
    return false;
  }
  
  return permissions.every(permission => validPermissions.includes(permission));
}

/**
 * Generar metadata para auditoría de compartición
 */
export function generateShareAuditData(
  fileId: string,
  ownerEmail: string,
  targetEmail: string,
  permissions: string[],
  expiresAt?: Date
) {
  return {
    action: 'file_share',
    fileId,
    ownerEmail,
    targetEmail,
    permissions,
    expiresAt: expiresAt?.toISOString(),
    timestamp: new Date().toISOString(),
    shareMethod: 'e2ee_reencrypt',
  };
}