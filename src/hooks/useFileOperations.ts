'use client';

/**
 * Hook personalizado para operaciones de archivos con cifrado E2EE
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  processFileForUpload, 
  processFileForDownload, 
  validateFileForProcessing,
  formatFileSize,
} from '@/lib/crypto-utils';

export interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'encrypting' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface FileDownloadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'downloading' | 'decrypting' | 'complete' | 'error';
  error?: string;
}

export function useFileOperations() {
  const { user, publicKeyCrypto, privateKey, accessToken } = useAuth();
  const [uploadProgress, setUploadProgress] = useState<Map<string, FileUploadProgress>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, FileDownloadProgress>>(new Map());

  // Función para subir archivo
  const uploadFile = useCallback(async (
    file: File,
    description?: string,
    tags?: string[]
  ): Promise<string> => {
    if (!user || !publicKeyCrypto || !accessToken) {
      throw new Error('Usuario no autenticado');
    }

    // Validar archivo
    const validation = validateFileForProcessing(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const fileId = crypto.randomUUID();
    
    // Inicializar progreso
    setUploadProgress(prev => new Map(prev.set(fileId, {
      fileId,
      fileName: file.name,
      progress: 0,
      status: 'encrypting',
    })));

    try {
      // Cifrar archivo
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 25,
        status: 'encrypting',
      })));

      const { encryptedFile, metadata } = await processFileForUpload(
        file,
        publicKeyCrypto,
        description,
        tags
      );

      // Preparar datos para envío
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 50,
        status: 'uploading',
      })));

      const formData = new FormData();
      formData.append('filename', metadata.originalName);
      formData.append('mimeType', metadata.mimeType);
      formData.append('size', metadata.size.toString());
      formData.append('encryptedData', encryptedFile.encryptedData);
      formData.append('encryptedKey', encryptedFile.encryptedKey);
      formData.append('iv', encryptedFile.iv);
      formData.append('authTag', encryptedFile.authTag);
      formData.append('checksum', encryptedFile.checksum);
      
      if (encryptedFile.metadata) {
        formData.append('encryptedMetadata', JSON.stringify(encryptedFile.metadata));
      }

      // Subir archivo
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado, recargar la página para que AuthContext maneje el redirect
          window.location.reload();
          return '';
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error subiendo archivo');
      }

      const result = await response.json();

      // Completar progreso
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 100,
        status: 'complete',
      })));

      // Limpiar progreso después de un tiempo
      setTimeout(() => {
        setUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 3000);

      return result.fileId;

    } catch (error) {
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido',
      })));
      throw error;
    }
  }, [user, publicKeyCrypto, accessToken]);

  // Función para descargar archivo
  const downloadFile = useCallback(async (fileId: string): Promise<void> => {
    if (!user || !privateKey || !accessToken) {
      throw new Error('Usuario no autenticado');
    }

    // Inicializar progreso
    setDownloadProgress(prev => new Map(prev.set(fileId, {
      fileId,
      fileName: 'Descargando...',
      progress: 0,
      status: 'downloading',
    })));

    try {
      // Descargar archivo cifrado
      const response = await fetch(`/api/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Error descargando archivo';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no se puede parsear como JSON, usar el texto crudo
          const errorText = await response.text();
          errorMessage = errorText || `Error ${response.status}: ${response.statusText}`;
        }
        
        // Actualizar progreso como error
        setDownloadProgress(prev => new Map(prev.set(fileId, {
          ...prev.get(fileId)!,
          status: 'error',
          error: errorMessage,
        })));
        
        throw new Error(errorMessage);
      }

      let encryptedFileData;
      try {
        encryptedFileData = await response.json();
      } catch {
        throw new Error('Respuesta del servidor no válida. El archivo puede estar corrupto.');
      }

      setDownloadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        fileName: encryptedFileData.filename || 'archivo',
        progress: 50,
        status: 'decrypting',
      })));

      // Descifrar archivo
      const { file, metadata } = await processFileForDownload(
        encryptedFileData,
        privateKey,
        encryptedFileData.filename,
        encryptedFileData.mimeType
      );

      setDownloadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 90,
        status: 'decrypting',
      })));

      // Crear enlace de descarga
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Completar progreso
      setDownloadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 100,
        status: 'complete',
      })));

      // Limpiar progreso después de un tiempo
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 3000);

    } catch (error) {
      setDownloadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido',
      })));
      throw error;
    }
  }, [user, privateKey, accessToken]);

  // Función para eliminar archivo
  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    if (!user || !accessToken) {
      throw new Error('Usuario no autenticado');
    }

    const response = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error eliminando archivo');
    }
  }, [user, accessToken]);

  // Función para obtener lista de archivos
  const getFiles = useCallback(async (): Promise<unknown[]> => {
    if (!user || !accessToken) {
      throw new Error('Usuario no autenticado');
    }

    const response = await fetch('/api/files', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Error obteniendo archivos';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Error ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch {
      throw new Error('Respuesta del servidor no válida al obtener archivos.');
    }
  }, [user, accessToken]);

  // Función para compartir archivo
  const shareFile = useCallback(async (
    fileId: string,
    userEmail: string,
    permissions: string[],
    expiresAt?: Date
  ): Promise<void> => {
    if (!user || !accessToken) {
      throw new Error('Usuario no autenticado');
    }

    const response = await fetch(`/api/files/${fileId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userEmail,
        permissions,
        expiresAt: expiresAt?.toISOString(),
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Error compartiendo archivo';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Si no se puede parsear como JSON, usar el texto crudo
        const errorText = await response.text();
        errorMessage = errorText || `Error ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
  }, [user, accessToken]);

  return {
    uploadFile,
    downloadFile,
    deleteFile,
    getFiles,
    shareFile,
    uploadProgress: Array.from(uploadProgress.values()),
    downloadProgress: Array.from(downloadProgress.values()),
    formatFileSize,
  };
}
