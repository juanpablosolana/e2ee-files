/**
 * Utilidades criptográficas para cifrado de extremo a extremo (E2EE)
 * Todas las operaciones se realizan en el cliente usando Web Crypto API
 */

// Tipos para las operaciones criptográficas
export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedData {
  encryptedData: ArrayBuffer;
  iv: ArrayBuffer;
  authTag: ArrayBuffer;
}

export interface EncryptedFile {
  encryptedData: ArrayBuffer;
  encryptedKey: ArrayBuffer;
  iv: ArrayBuffer;
  authTag: ArrayBuffer;
  checksum: string;
}

// Configuración de algoritmos criptográficos
const ALGORITHMS = {
  AES: {
    name: 'AES-GCM',
    length: 256,
  },
  RSA: {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  ECDSA: {
    name: 'ECDSA',
    namedCurve: 'P-256',
  },
  PBKDF2: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 100000,
    length: 256,
  },
} as const;

/**
 * Genera un salt criptográficamente seguro
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Deriva una clave maestra desde una contraseña usando PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: ALGORITHMS.PBKDF2.name,
      salt: salt,
      iterations: ALGORITHMS.PBKDF2.iterations,
      hash: ALGORITHMS.PBKDF2.hash,
    },
    baseKey,
    {
      name: ALGORITHMS.AES.name,
      length: ALGORITHMS.AES.length,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Genera un par de claves RSA para el usuario
 */
export async function generateRSAKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: ALGORITHMS.RSA.name,
      modulusLength: ALGORITHMS.RSA.modulusLength,
      publicExponent: ALGORITHMS.RSA.publicExponent,
      hash: ALGORITHMS.RSA.hash,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return keyPair;
}

/**
 * Genera una clave AES para cifrado de archivos
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: ALGORITHMS.AES.name,
      length: ALGORITHMS.AES.length,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra datos con AES-256-GCM
 */
export async function encryptWithAES(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits para GCM

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHMS.AES.name,
      iv: iv,
    },
    key,
    data
  );

  // Separar datos cifrados y tag de autenticación
  const encryptedArray = new Uint8Array(encrypted);
  const authTagLength = 16; // 128 bits
  const encryptedData = encryptedArray.slice(0, -authTagLength);
  const authTag = encryptedArray.slice(-authTagLength);

  return {
    encryptedData: encryptedData.buffer,
    iv: iv.buffer,
    authTag: authTag.buffer,
  };
}

/**
 * Descifra datos con AES-256-GCM
 */
export async function decryptWithAES(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: ArrayBuffer,
  authTag: ArrayBuffer
): Promise<ArrayBuffer> {
  // Combinar datos cifrados y tag de autenticación
  const combined = new Uint8Array(encryptedData.byteLength + authTag.byteLength);
  combined.set(new Uint8Array(encryptedData), 0);
  combined.set(new Uint8Array(authTag), encryptedData.byteLength);

  return crypto.subtle.decrypt(
    {
      name: ALGORITHMS.AES.name,
      iv: iv,
    },
    key,
    combined
  );
}

/**
 * Cifra una clave AES con RSA público
 */
export async function encryptKeyWithRSA(
  aesKey: CryptoKey,
  rsaPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  const keyData = await crypto.subtle.exportKey('raw', aesKey);
  
  return crypto.subtle.encrypt(
    {
      name: ALGORITHMS.RSA.name,
    },
    rsaPublicKey,
    keyData
  );
}

/**
 * Descifra una clave AES con RSA privado
 */
export async function decryptKeyWithRSA(
  encryptedKey: ArrayBuffer,
  rsaPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const keyData = await crypto.subtle.decrypt(
    {
      name: ALGORITHMS.RSA.name,
    },
    rsaPrivateKey,
    encryptedKey
  );

  return crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: ALGORITHMS.AES.name,
      length: ALGORITHMS.AES.length,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra la clave privada RSA con la clave maestra del usuario
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  masterKey: CryptoKey
): Promise<EncryptedData> {
  const keyData = await crypto.subtle.exportKey('pkcs8', privateKey);
  return encryptWithAES(keyData, masterKey);
}

/**
 * Descifra la clave privada RSA con la clave maestra del usuario
 */
export async function decryptPrivateKey(
  encryptedData: ArrayBuffer,
  masterKey: CryptoKey,
  iv: ArrayBuffer,
  authTag: ArrayBuffer
): Promise<CryptoKey> {
  const keyData = await decryptWithAES(encryptedData, masterKey, iv, authTag);
  
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: ALGORITHMS.RSA.name,
      hash: ALGORITHMS.RSA.hash,
    },
    false,
    ['decrypt']
  );
}

/**
 * Calcula el hash SHA-256 de un archivo
 */
export async function calculateFileHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cifra un archivo completo para almacenamiento
 */
export async function encryptFile(
  fileData: ArrayBuffer,
  rsaPublicKey: CryptoKey
): Promise<EncryptedFile> {
  // Generar clave AES para este archivo
  const aesKey = await generateAESKey();
  
  // Cifrar el archivo con AES
  const encryptedData = await encryptWithAES(fileData, aesKey);
  
  // Cifrar la clave AES con RSA público
  const encryptedKey = await encryptKeyWithRSA(aesKey, rsaPublicKey);
  
  // Calcular checksum del archivo original
  const checksum = await calculateFileHash(fileData);

  return {
    encryptedData: encryptedData.encryptedData,
    encryptedKey,
    iv: encryptedData.iv,
    authTag: encryptedData.authTag,
    checksum,
  };
}

/**
 * Descifra un archivo completo
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  encryptedKey: ArrayBuffer,
  iv: ArrayBuffer,
  authTag: ArrayBuffer,
  rsaPrivateKey: CryptoKey
): Promise<ArrayBuffer> {
  // Descifrar la clave AES con RSA privado
  const aesKey = await decryptKeyWithRSA(encryptedKey, rsaPrivateKey);
  
  // Descifrar el archivo con AES
  return decryptWithAES(encryptedData, aesKey, iv, authTag);
}

/**
 * Convierte ArrayBuffer a string base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convierte string base64 a ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Exporta clave pública RSA a formato PEM
 */
export async function exportPublicKeyToPEM(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const base64 = arrayBufferToBase64(exported);
  return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Importa clave pública RSA desde formato PEM
 */
export async function importPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
  const base64 = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  
  const keyData = base64ToArrayBuffer(base64);
  
  return crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: ALGORITHMS.RSA.name,
      hash: ALGORITHMS.RSA.hash,
    },
    false,
    ['encrypt']
  );
}
