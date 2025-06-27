'use client';

/**
 * Modal informativo para archivos compartidos en modo demo
 */

import React from 'react';

interface SharedFileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  sharedBy: string;
}

export default function SharedFileInfoModal({
  isOpen,
  onClose,
  fileName,
  sharedBy,
}: SharedFileInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              📤 Archivo Compartido
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-900">
                <p className="font-medium mb-2">
                  <strong>{fileName}</strong>
                </p>
                <p className="mb-3">
                  Compartido por: <span className="font-medium text-indigo-600">{sharedBy}</span>
                </p>
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>Modo Demostración:</strong> Este archivo no puede descargarse aún.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      🔐 ¿Por qué no puedo descargarlo?
                    </h4>
                    <p className="text-sm text-gray-600">
                      Para mantener el cifrado de extremo a extremo (E2EE), el archivo debe ser re-cifrado específicamente para tu clave pública RSA antes de que puedas descargarlo.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      🚀 ¿Cómo funcionaría en producción?
                    </h4>
                    <p className="text-sm text-gray-600">
                      El propietario proporcionaría su contraseña, el sistema descifraría la clave del archivo con su clave privada, y luego la re-cifraría automáticamente con tu clave pública.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      ✅ Funcionalidad Demostrada
                    </h4>
                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                      <li>Sistema de permisos granular</li>
                      <li>Fechas de expiración</li>
                      <li>Auditoría de comparticiones</li>
                      <li>Revocación de acceso</li>
                      <li>Arquitectura E2EE completa</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}