/**
 * Utilidades adicionales para operaciones criptográficas
 */

import { 
  encryptFile, 
  decryptFile, 
  calculateFileHash,
  arrayBufferToBase64,
  base64ToArrayBuffer 
} from './crypto';

// Tipos para metadatos de archivos
export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  description?: string;
  tags?: string[];
}

export interface EncryptedFileData {
  encryptedData: string; // Base64
  encryptedKey: string; // Base64
  iv: string; // Base64
  authTag: string; // Base64
  checksum: string;
  metadata: EncryptedFileData | null;
}

/**
 * Cifra metadatos de archivo
 */
export async function encryptMetadata(
  metadata: FileMetadata,
  publicKey: CryptoKey
): Promise<string> {
  const metadataJson = JSON.stringify(metadata);
  const metadataBuffer = new TextEncoder().encode(metadataJson);
  
  const encrypted = await encryptFile(metadataBuffer.buffer as ArrayBuffer, publicKey);
  
  return JSON.stringify({
    encryptedData: arrayBufferToBase64(encrypted.encryptedData),
    encryptedKey: arrayBufferToBase64(encrypted.encryptedKey),
    iv: arrayBufferToBase64(encrypted.iv),
    authTag: arrayBufferToBase64(encrypted.authTag),
  });
}

/**
 * Descifra metadatos de archivo
 */
export async function decryptMetadata(
  encryptedMetadata: string,
  privateKey: CryptoKey
): Promise<FileMetadata> {
  const parsed = JSON.parse(encryptedMetadata);
  
  const decryptedBuffer = await decryptFile(
    base64ToArrayBuffer(parsed.encryptedData),
    base64ToArrayBuffer(parsed.encryptedKey),
    base64ToArrayBuffer(parsed.iv),
    base64ToArrayBuffer(parsed.authTag),
    privateKey
  );
  
  const metadataJson = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(metadataJson);
}

/**
 * Procesa un archivo para subida cifrada
 */
export async function processFileForUpload(
  file: File,
  publicKey: CryptoKey,
  description?: string,
  tags?: string[]
): Promise<{
  encryptedFile: EncryptedFileData;
  metadata: FileMetadata;
}> {
  // Leer archivo
  const fileBuffer = await file.arrayBuffer();
  
  // Crear metadatos
  const metadata: FileMetadata = {
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date(),
    description,
    tags,
  };
  
  // Cifrar archivo
  const encrypted = await encryptFile(fileBuffer, publicKey);
  
  // Cifrar metadatos
  const encryptedMetadata = await encryptMetadata(metadata, publicKey);
  
  const encryptedFile: EncryptedFileData = {
    encryptedData: arrayBufferToBase64(encrypted.encryptedData),
    encryptedKey: arrayBufferToBase64(encrypted.encryptedKey),
    iv: arrayBufferToBase64(encrypted.iv),
    authTag: arrayBufferToBase64(encrypted.authTag),
    checksum: encrypted.checksum,
    metadata: JSON.parse(encryptedMetadata),
  };
  
  return { encryptedFile, metadata };
}

/**
 * Procesa un archivo cifrado para descarga
 */
export async function processFileForDownload(
  encryptedFile: EncryptedFileData,
  privateKey: CryptoKey,
  fallbackFilename?: string,
  fallbackMimeType?: string
): Promise<{
  file: Blob;
  metadata: FileMetadata;
}> {
  // Descifrar archivo
  const decryptedBuffer = await decryptFile(
    base64ToArrayBuffer(encryptedFile.encryptedData),
    base64ToArrayBuffer(encryptedFile.encryptedKey),
    base64ToArrayBuffer(encryptedFile.iv),
    base64ToArrayBuffer(encryptedFile.authTag),
    privateKey
  );
  
  // Verificar checksum
  const calculatedChecksum = await calculateFileHash(decryptedBuffer);
  if (calculatedChecksum !== encryptedFile.checksum) {
    throw new Error('Checksum inválido - archivo corrupto');
  }
  
  // Descifrar metadatos
  let metadata: FileMetadata;
  if (encryptedFile.metadata) {
    try {
      metadata = await decryptMetadata(JSON.stringify(encryptedFile.metadata), privateKey);
    } catch (error) {
      console.warn('Error descifrando metadatos, usando fallback:', error);
      // Fallback si falla el descifrado de metadatos
      const fileName = fallbackFilename || 'archivo_descargado';
      metadata = {
        originalName: fileName,
        mimeType: fallbackMimeType || 'application/octet-stream',
        size: decryptedBuffer.byteLength,
        uploadedAt: new Date(),
      };
    }
  } else {
    // Fallback para archivos sin metadatos cifrados - usar información del API
    const fileName = fallbackFilename || 'archivo_descargado';
    metadata = {
      originalName: fileName,
      mimeType: fallbackMimeType || 'application/octet-stream',
      size: decryptedBuffer.byteLength,
      uploadedAt: new Date(),
    };
  }
  
  // Crear blob
  const file = new Blob([decryptedBuffer], { type: metadata.mimeType });
  
  return { file, metadata };
}

/**
 * Valida la integridad de un archivo cifrado
 */
export async function validateFileIntegrity(
  encryptedFile: EncryptedFileData,
  privateKey: CryptoKey
): Promise<boolean> {
  try {
    const decryptedBuffer = await decryptFile(
      base64ToArrayBuffer(encryptedFile.encryptedData),
      base64ToArrayBuffer(encryptedFile.encryptedKey),
      base64ToArrayBuffer(encryptedFile.iv),
      base64ToArrayBuffer(encryptedFile.authTag),
      privateKey
    );
    
    const calculatedChecksum = await calculateFileHash(decryptedBuffer);
    return calculatedChecksum === encryptedFile.checksum;
  } catch (error) {
    console.error('Error validando integridad:', error);
    return false;
  }
}

/**
 * Genera una vista previa segura de un archivo (solo metadatos)
 */
export async function generateFilePreview(
  encryptedMetadata: string | null,
  privateKey: CryptoKey
): Promise<{
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  description?: string;
  tags?: string[];
} | null> {
  if (!encryptedMetadata) {
    return null;
  }
  
  try {
    const metadata = await decryptMetadata(encryptedMetadata, privateKey);
    return {
      name: metadata.originalName,
      type: metadata.mimeType,
      size: metadata.size,
      uploadedAt: metadata.uploadedAt,
      description: metadata.description,
      tags: metadata.tags,
    };
  } catch (error) {
    console.error('Error generando vista previa:', error);
    return null;
  }
}

/**
 * Comprime un archivo antes del cifrado (para archivos grandes)
 */
export async function compressFile(file: File): Promise<ArrayBuffer> {
  // Para archivos de texto, podemos usar compresión
  if (file.type.startsWith('text/') || file.type === 'application/json') {
    const text = await file.text();
    const compressed = new TextEncoder().encode(text); // Simplificado - en producción usar gzip
    return compressed.buffer as ArrayBuffer;
  }
  
  // Para otros archivos, retornar sin compresión
  return file.arrayBuffer();
}

/**
 * Estima el tiempo de cifrado basado en el tamaño del archivo
 */
export function estimateEncryptionTime(fileSize: number): number {
  // Estimación aproximada: ~1MB por segundo en hardware promedio
  const mbPerSecond = 1;
  const fileSizeMB = fileSize / (1024 * 1024);
  return Math.ceil(fileSizeMB / mbPerSecond);
}

/**
 * Valida que un archivo sea seguro para procesar
 */
export function validateFileForProcessing(file: File): {
  isValid: boolean;
  error?: string;
} {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/json',
  ];
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `El archivo es demasiado grande. Máximo permitido: ${maxSize / (1024 * 1024)}MB`,
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Tipo de archivo no permitido: ${file.type}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Genera un identificador único para un archivo
 */
export function generateFileId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Formatea el tamaño de archivo para mostrar
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Extrae la extensión de un archivo y la aplica a un nombre base
 */
export function preserveFileExtension(originalName: string, baseName: string): string {
  const lastDotIndex = originalName.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < originalName.length - 1) {
    const extension = originalName.substring(lastDotIndex);
    // Si el baseName ya tiene la extensión, no duplicarla
    if (!baseName.toLowerCase().endsWith(extension.toLowerCase())) {
      return baseName + extension;
    }
  }
  return baseName;
}
