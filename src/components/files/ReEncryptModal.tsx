'use client';

/**
 * Modal para re-cifrar claves de archivos compartidos
 */

import React, { useState } from 'react';

interface ReEncryptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReEncrypt: (password: string) => Promise<void>;
  fileName: string;
  targetEmail: string;
}

export default function ReEncryptModal({
  isOpen,
  onClose,
  onReEncrypt,
  fileName,
  targetEmail,
}: ReEncryptModalProps) {
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('La contraseña es requerida');
      return;
    }

    try {
      setIsProcessing(true);
      await onReEncrypt(password);
      
      // Resetear formulario
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el re-cifrado');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Re-cifrar archivo compartido
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
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded text-sm mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p>
                    <strong>Archivo:</strong> {fileName}<br/>
                    <strong>Destinatario:</strong> {targetEmail}
                  </p>
                  <p className="mt-2 text-xs">
                    Para completar el cifrado E2EE, necesitas proporcionar tu contraseña para descifrar tu clave privada y re-cifrar el archivo para {targetEmail}.
                  </p>
                </div>
              </div>
            </div>

            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Tu contraseña
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ingresa tu contraseña"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Necesaria para descifrar tu clave privada y completar el re-cifrado
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
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Re-cifrando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Re-cifrar
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
                <strong>Seguridad:</strong> Tu contraseña no se enviará al servidor. Se usa localmente para descifrar tu clave privada y realizar el re-cifrado E2EE.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}