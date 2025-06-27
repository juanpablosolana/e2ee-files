'use client';

/**
 * Modal para compartir archivos de forma segura
 */

import React, { useState } from 'react';

interface ShareFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (email: string, permissions: string[], expiresAt?: string) => Promise<void>;
  fileName: string;
  fileId: string;
}

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Ver archivo', description: 'Permite ver el contenido del archivo' },
  { value: 'download', label: 'Descargar', description: 'Permite descargar el archivo' },
  { value: 'share', label: 'Compartir', description: 'Permite compartir con otros usuarios' },
];

export default function ShareFileModal({
  isOpen,
  onClose,
  onShare,
  fileName,
}: ShareFileModalProps) {
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState(['read']);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState('');

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setPermissions([...permissions, permission]);
    } else {
      setPermissions(permissions.filter(p => p !== permission));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('El email es requerido');
      return;
    }

    if (permissions.length === 0) {
      setError('Debe seleccionar al menos un permiso');
      return;
    }

    try {
      setIsSharing(true);
      await onShare(email.trim(), permissions, expiresAt || undefined);
      
      // Resetear formulario
      setEmail('');
      setPermissions(['read']);
      setExpiresAt('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error compartiendo archivo');
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPermissions(['read']);
    setExpiresAt('');
    setError('');
    onClose();
  };

  // Calcular fecha mínima (hoy + 1 día)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateString = minDate.toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Compartir archivo
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Compartir <span className="font-medium">{fileName}</span> de forma segura
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email del destinatario
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="usuario@ejemplo.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permisos
            </label>
            <div className="space-y-2">
              {PERMISSION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-start">
                  <input
                    type="checkbox"
                    checked={permissions.includes(option.value)}
                    onChange={(e) => handlePermissionChange(option.value, e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de expiración (opcional)
            </label>
            <input
              type="date"
              id="expiresAt"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={minDateString}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Si no se especifica, el acceso no expirará
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSharing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Compartiendo...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Compartir
                </>
              )}
            </button>
          </div>
        </form>

        <div className="px-6 py-3 bg-yellow-50 rounded-b-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Cifrado E2EE:</strong> El archivo se re-cifrará automáticamente para el destinatario manteniendo la seguridad de extremo a extremo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}