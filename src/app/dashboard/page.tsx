'use client';

/**
 * Dashboard principal de la aplicación E2EE
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/files/FileUpload';
import ShareFileModal from '@/components/files/ShareFileModal';
import SharedFileInfoModal from '@/components/files/SharedFileInfoModal';
import { useFileOperations } from '@/hooks/useFileOperations';

interface FileItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  isOwner?: boolean;
  sharedBy?: { username: string };
}

interface FilesResponse {
  files: FileItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { getFiles, downloadFile, deleteFile, shareFile, formatFileSize } = useFileOperations();

  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('files');
  const [error, setError] = useState('');
  const [shareModal, setShareModal] = useState<{ isOpen: boolean; fileId: string; fileName: string }>({
    isOpen: false,
    fileId: '',
    fileName: '',
  });
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; fileName: string; sharedBy: string }>({
    isOpen: false,
    fileName: '',
    sharedBy: '',
  });

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const loadFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const response = await getFiles();
      // Asegúrate de que response es de tipo FilesResponse
      const filesData = ((response as unknown) as FilesResponse)?.files ?? [];
      setFiles(filesData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error cargando archivos');
    } finally {
      setLoadingFiles(false);
    }
  }, [getFiles]);

  // Cargar archivos
  useEffect(() => {
    if (isAuthenticated) {
      loadFiles();
    }
  }, [isAuthenticated, loadFiles]);

  const handleUploadComplete = () => {
    loadFiles(); // Recargar lista de archivos
    setActiveTab('files'); // Cambiar a la pestaña de archivos
  };

  const handleDownload = async (fileId: string, fileName: string, isOwner?: boolean, sharedBy?: string) => {
    // Si es un archivo compartido, mostrar modal informativo en lugar de intentar descarga
    if (!isOwner && sharedBy) {
      setInfoModal({
        isOpen: true,
        fileName,
        sharedBy,
      });
      return;
    }
    
    try {
      await downloadFile(fileId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error descargando archivo';
      
      // Si es un error de archivo compartido en demo, mostrar mensaje más informativo
      if (errorMessage.includes('modo demostración')) {
        setError(`📤 Archivo compartido: "${fileName}" no puede descargarse aún. ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      return;
    }

    try {
      await deleteFile(fileId);
      loadFiles(); // Recargar lista
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error eliminando archivo');
    }
  };

  const handleShare = (fileId: string, fileName: string) => {
    setShareModal({
      isOpen: true,
      fileId,
      fileName,
    });
  };

  const handleShareSubmit = async (email: string, permissions: string[], expiresAt?: string) => {
    try {
      const expirationDate = expiresAt ? new Date(expiresAt) : undefined;
      await shareFile(shareModal.fileId, email, permissions, expirationDate);
      setShareModal({ isOpen: false, fileId: '', fileName: '' });
    } catch (error) {
      throw error; // Re-lanzar para que el modal maneje el error
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Almacenamiento Seguro E2EE
              </h1>
              <p className="text-sm text-gray-600">
                Bienvenido, {user.username}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                🔒 Cifrado de extremo a extremo activo
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navegación de pestañas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('files')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'files'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mis Archivos ({files.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Subir Archivos
            </button>
          </nav>
        </div>

        {/* Mostrar errores */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <button
              onClick={() => setError('')}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <span className="sr-only">Cerrar</span>
              ×
            </button>
            {error}
          </div>
        )}

        {/* Contenido de pestañas */}
        <div className="mt-6">
          {activeTab === 'upload' && (
            <FileUpload
              onUploadComplete={handleUploadComplete}
              onUploadError={setError}
            />
          )}

          {activeTab === 'files' && (
            <div>
              {loadingFiles ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando archivos...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto h-12 w-12 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay archivos</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Comienza subiendo tu primer archivo cifrado.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Subir Archivo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {files.map((file) => (
                      <li key={file.id}>
                        <div className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">
                                  {file.filename}
                                </p>
                                {!file.isOwner && (
                                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Compartido
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-sm text-gray-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span className="mx-2">•</span>
                                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                                {file.sharedBy && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span>Por {file.sharedBy.username}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDownload(file.id, file.filename, file.isOwner, file.sharedBy?.username)}
                              className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded ${
                                !file.isOwner 
                                  ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100' 
                                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              }`}
                              title={!file.isOwner ? 'Archivo compartido - Ver información del archivo' : 'Descargar archivo'}
                            >
                              <svg className="-ml-1 mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {!file.isOwner ? 'Ver Info' : 'Descargar'}
                            </button>
                            {file.isOwner && (
                              <>
                                <button
                                  onClick={() => handleShare(file.id, file.filename)}
                                  className="inline-flex items-center px-3 py-1.5 border border-indigo-300 text-xs font-medium rounded text-indigo-700 bg-white hover:bg-indigo-50"
                                >
                                  <svg className="-ml-1 mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                  </svg>
                                  Compartir
                                </button>
                                <button
                                  onClick={() => handleDelete(file.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50"
                                >
                                  <svg className="-ml-1 mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para compartir archivos */}
      <ShareFileModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, fileId: '', fileName: '' })}
        onShare={handleShareSubmit}
        fileName={shareModal.fileName}
        fileId={shareModal.fileId}
      />

      {/* Modal de información para archivos compartidos */}
      <SharedFileInfoModal
        isOpen={infoModal.isOpen}
        onClose={() => setInfoModal({ isOpen: false, fileName: '', sharedBy: '' })}
        fileName={infoModal.fileName}
        sharedBy={infoModal.sharedBy}
      />
    </div>
  );
}
