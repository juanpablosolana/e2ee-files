'use client';

/**
 * Componente para subida de archivos con cifrado E2EE
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileOperations, FileUploadProgress } from '@/hooks/useFileOperations';
import { validateFileForProcessing, formatFileSize } from '@/lib/crypto-utils';

interface FileUploadProps {
  onUploadComplete?: (fileId: string) => void;
  onUploadError?: (error: string) => void;
}

export default function FileUpload({ onUploadComplete, onUploadError }: FileUploadProps) {
  const { uploadFile, uploadProgress } = useFileOperations();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Validar archivos
    const validFiles: File[] = [];
    const errors: string[] = [];

    acceptedFiles.forEach(file => {
      const validation = validateFileForProcessing(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'));
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, [onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleUpload = async (file: File, description?: string, tags?: string[]) => {
    try {
      const fileId = await uploadFile(file, description, tags);
      
      // Remover archivo de la lista
      setSelectedFiles(prev => prev.filter(f => f !== file));
      
      onUploadComplete?.(fileId);
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : 'Error subiendo archivo');
    }
  };

  const removeFile = (file: File) => {
    setSelectedFiles(prev => prev.filter(f => f !== file));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Zona de drop */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive || dragActive 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí'}
            </p>
            <p className="text-sm text-gray-500">
              o <span className="text-indigo-600 font-medium">haz clic para seleccionar</span>
            </p>
          </div>
          <div className="text-xs text-gray-400">
            <p>Máximo 100MB por archivo</p>
            <p>Tipos permitidos: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, ZIP</p>
          </div>
        </div>
      </div>

      {/* Lista de archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Archivos seleccionados ({selectedFiles.length})
          </h3>
          
          <div className="space-y-3">
            {selectedFiles.map((file, index) => (
              <FileUploadItem
                key={`${file.name}-${index}`}
                file={file}
                onUpload={handleUpload}
                onRemove={removeFile}
              />
            ))}
          </div>
        </div>
      )}

      {/* Progreso de subidas */}
      {uploadProgress.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Subiendo archivos
          </h3>
          
          <div className="space-y-3">
            {uploadProgress.map((progress) => (
              <UploadProgressItem key={progress.fileId} progress={progress} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para cada archivo seleccionado
function FileUploadItem({ 
  file, 
  onUpload, 
  onRemove 
}: { 
  file: File; 
  onUpload: (file: File, description?: string, tags?: string[]) => void;
  onRemove: (file: File) => void;
}) {
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      await onUpload(file, description || undefined, tagArray.length > 0 ? tagArray : undefined);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-sm text-gray-500">
                {formatFileSize(file.size)} • {file.type || 'Tipo desconocido'}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el contenido del archivo..."
                className="mt-1 block w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isUploading}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Etiquetas (opcional, separadas por comas)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="trabajo, importante, proyecto..."
                className="mt-1 block w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isUploading}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Subiendo...
              </>
            ) : (
              'Subir'
            )}
          </button>
          
          <button
            onClick={() => onRemove(file)}
            disabled={isUploading}
            className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar progreso de subida
function UploadProgressItem({ progress }: { progress: FileUploadProgress }) {
  const getStatusColor = () => {
    switch (progress.status) {
      case 'encrypting': return 'bg-blue-500';
      case 'uploading': return 'bg-indigo-500';
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'encrypting': return 'Cifrando...';
      case 'uploading': return 'Subiendo...';
      case 'complete': return 'Completado';
      case 'error': return 'Error';
      default: return 'Procesando...';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">{progress.fileName}</span>
        <span className="text-sm text-gray-500">{getStatusText()}</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      
      {progress.error && (
        <p className="mt-2 text-sm text-red-600">{progress.error}</p>
      )}
    </div>
  );
}
