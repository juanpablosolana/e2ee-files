'use client';

/**
 * Contexto de autenticación para la aplicación E2EE
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  deriveKeyFromPassword, 
  decryptPrivateKey, 
  base64ToArrayBuffer,
  importPublicKeyFromPEM 
} from '@/lib/crypto';

// Tipos para el contexto de autenticación
export interface User {
  id: string;
  email: string;
  username: string;
  publicKey: string;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  // Claves criptográficas en memoria
  masterKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  publicKeyCrypto: CryptoKey | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

// Contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook para usar el contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

// Provider del contexto de autenticación
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    masterKey: null,
    privateKey: null,
    publicKeyCrypto: null,
  });

  // Función para login
  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en login');
      }

      // Derivar clave maestra desde la contraseña
      const salt = base64ToArrayBuffer(data.cryptoData.salt);
      const masterKey = await deriveKeyFromPassword(password, new Uint8Array(salt));

      // Descifrar clave privada
      const encryptedPrivateKeyData = JSON.parse(data.cryptoData.encryptedPrivateKey);
      const privateKey = await decryptPrivateKey(
        base64ToArrayBuffer(encryptedPrivateKeyData.encryptedData),
        masterKey,
        base64ToArrayBuffer(encryptedPrivateKeyData.iv),
        base64ToArrayBuffer(encryptedPrivateKeyData.authTag)
      );

      // Importar clave pública
      const publicKeyCrypto = await importPublicKeyFromPEM(data.user.publicKey);

      // Guardar tokens en localStorage
      localStorage.setItem('accessToken', data.session.accessToken);
      localStorage.setItem('refreshToken', data.session.refreshToken);

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        masterKey,
        privateKey,
        publicKeyCrypto,
      });

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        user: null,
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        masterKey: null,
        privateKey: null,
        publicKeyCrypto: null,
      }));
      throw error;
    }
  };

  // Función para registro
  const register = async (userData: RegisterData) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Generar claves criptográficas en el cliente
      const { generateRSAKeyPair, generateSalt, deriveKeyFromPassword, encryptPrivateKey, exportPublicKeyToPEM, arrayBufferToBase64 } = await import('@/lib/crypto');
      
      const salt = generateSalt();
      const masterKey = await deriveKeyFromPassword(userData.password, salt);
      const keyPair = await generateRSAKeyPair();
      
      const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, masterKey);
      const publicKeyPEM = await exportPublicKeyToPEM(keyPair.publicKey);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          username: userData.username,
          password: userData.password,
          publicKey: publicKeyPEM,
          encryptedPrivateKey: JSON.stringify({
            encryptedData: arrayBufferToBase64(encryptedPrivateKey.encryptedData),
            iv: arrayBufferToBase64(encryptedPrivateKey.iv),
            authTag: arrayBufferToBase64(encryptedPrivateKey.authTag),
          }),
          salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en registro');
      }

      setState(prev => ({ ...prev, isLoading: false }));

    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Función para logout
  const logout = async () => {
    try {
      if (state.accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Limpiar estado y localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        masterKey: null,
        privateKey: null,
        publicKeyCrypto: null,
      });
    }
  };

  // Función para refrescar autenticación
  const refreshAuth = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken || !refreshToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Verificar si el token es válido
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const publicKeyCrypto = await importPublicKeyFromPEM(data.user.publicKey);
        
        setState(prev => ({
          ...prev,
          user: data.user,
          isAuthenticated: true,
          accessToken,
          refreshToken,
          publicKeyCrypto,
          isLoading: false,
        }));
      } else {
        // Token inválido/expirado, limpiar estado
        console.log('Token expirado, redirigiendo al login');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState(prev => ({ 
          ...prev, 
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('Error refrescando autenticación:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Verificar autenticación al cargar
  useEffect(() => {
    refreshAuth();
  }, []);

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
