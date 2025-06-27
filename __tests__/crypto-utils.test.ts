/**
 * Tests para utilidades criptográficas adicionales
 */

import {
  processFileForUpload,
  processFileForDownload,
  validateFileIntegrity,
  encryptMetadata,
  decryptMetadata,
  validateFileForProcessing,
  formatFileSize,
  generateFileId,
  estimateEncryptionTime,
  preserveFileExtension,
  type FileMetadata,
} from '../src/lib/crypto-utils';

import {
  generateRSAKeyPair,
  type KeyPair,
} from '../src/lib/crypto';

describe('Crypto Utils', () => {
  let keyPair: KeyPair;

  beforeAll(async () => {
    keyPair = await generateRSAKeyPair();
  });

  describe('processFileForUpload', () => {
    it('should process a file for upload correctly', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });

      const result = await processFileForUpload(
        file,
        keyPair.publicKey,
        'Test description',
        ['test', 'document']
      );

      expect(result.encryptedFile).toBeDefined();
      expect(result.encryptedFile.encryptedData).toBeDefined();
      expect(result.encryptedFile.encryptedKey).toBeDefined();
      expect(result.encryptedFile.iv).toBeDefined();
      expect(result.encryptedFile.authTag).toBeDefined();
      expect(result.encryptedFile.checksum).toBeDefined();

      expect(result.metadata.originalName).toBe('test.txt');
      expect(result.metadata.mimeType).toBe('text/plain');
      expect(result.metadata.size).toBe(testData.length);
      expect(result.metadata.description).toBe('Test description');
      expect(result.metadata.tags).toEqual(['test', 'document']);
    });
  });

  describe('processFileForDownload', () => {
    it('should process a file for download correctly', async () => {
      const originalContent = 'Test file content for download';
      const testData = new TextEncoder().encode(originalContent);
      const file = new File([testData], 'download-test.txt', { type: 'text/plain' });

      // Primero procesar para subida
      const uploadResult = await processFileForUpload(
        file,
        keyPair.publicKey,
        'Download test'
      );

      // Luego procesar para descarga
      const downloadResult = await processFileForDownload(
        uploadResult.encryptedFile,
        keyPair.privateKey
      );

      const downloadedContent = await downloadResult.file.text();
      expect(downloadedContent).toBe(originalContent);
      expect(downloadResult.metadata.originalName).toBe('download-test.txt');
      expect(downloadResult.metadata.mimeType).toBe('text/plain');
    });

    it('should use fallback filename and mimeType when provided', async () => {
      const originalContent = 'Test content';
      const testData = new TextEncoder().encode(originalContent);
      const file = new File([testData], 'test.txt', { type: 'text/plain' });

      const uploadResult = await processFileForUpload(file, keyPair.publicKey);
      
      // Simular archivo sin metadatos cifrados
      const encryptedFileWithoutMetadata = {
        ...uploadResult.encryptedFile,
        metadata: null,
      };

      const downloadResult = await processFileForDownload(
        encryptedFileWithoutMetadata,
        keyPair.privateKey,
        'documento.pdf',
        'application/pdf'
      );

      const downloadedContent = await downloadResult.file.text();
      expect(downloadedContent).toBe(originalContent);
      expect(downloadResult.metadata.originalName).toBe('documento.pdf');
      expect(downloadResult.metadata.mimeType).toBe('application/pdf');
    });
  });

  describe('validateFileIntegrity', () => {
    it('should validate file integrity correctly', async () => {
      const testData = new TextEncoder().encode('Integrity test content');
      const file = new File([testData], 'integrity.txt', { type: 'text/plain' });

      const result = await processFileForUpload(file, keyPair.publicKey);
      const isValid = await validateFileIntegrity(
        result.encryptedFile,
        keyPair.privateKey
      );

      expect(isValid).toBe(true);
    });

    it('should detect corrupted files', async () => {
      const testData = new TextEncoder().encode('Test content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });

      const result = await processFileForUpload(file, keyPair.publicKey);
      
      // Corromper el checksum
      result.encryptedFile.checksum = 'corrupted-checksum';

      const isValid = await validateFileIntegrity(
        result.encryptedFile,
        keyPair.privateKey
      );

      expect(isValid).toBe(false);
    });
  });

  describe('metadata encryption/decryption', () => {
    it('should encrypt and decrypt metadata correctly', async () => {
      const metadata: FileMetadata = {
        originalName: 'metadata-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedAt: new Date(),
        description: 'Test PDF document',
        tags: ['pdf', 'test', 'document'],
      };

      const encrypted = await encryptMetadata(metadata, keyPair.publicKey);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      const decrypted = await decryptMetadata(encrypted, keyPair.privateKey);
      expect(decrypted.originalName).toBe(metadata.originalName);
      expect(decrypted.mimeType).toBe(metadata.mimeType);
      expect(decrypted.size).toBe(metadata.size);
      expect(decrypted.description).toBe(metadata.description);
      expect(decrypted.tags).toEqual(metadata.tags);
    });
  });

  describe('file validation', () => {
    it('should validate allowed file types', () => {
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileForProcessing(validFile);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid file types', () => {
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-executable' });
      const result = validateFileForProcessing(invalidFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Tipo de archivo no permitido');
    });

    it('should reject files that are too large', () => {
      const largeData = new Uint8Array(200 * 1024 * 1024); // 200MB
      const largeFile = new File([largeData], 'large.pdf', { type: 'application/pdf' });
      const result = validateFileForProcessing(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('demasiado grande');
    });
  });

  describe('utility functions', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0.0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should generate unique file IDs', () => {
      const id1 = generateFileId();
      const id2 = generateFileId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(32); // 16 bytes * 2 chars per byte
    });

    it('should estimate encryption time', () => {
      const small = estimateEncryptionTime(1024); // 1KB
      const large = estimateEncryptionTime(10 * 1024 * 1024); // 10MB
      
      expect(small).toBeGreaterThanOrEqual(1);
      expect(large).toBeGreaterThan(small);
    });

    it('should preserve file extensions correctly', () => {
      expect(preserveFileExtension('document.pdf', 'archivo_descargado')).toBe('archivo_descargado.pdf');
      expect(preserveFileExtension('image.jpg', 'photo')).toBe('photo.jpg');
      expect(preserveFileExtension('file.txt', 'documento.txt')).toBe('documento.txt'); // No duplicar
      expect(preserveFileExtension('noextension', 'archivo')).toBe('archivo'); // Sin extensión
      expect(preserveFileExtension('.hidden', 'archivo')).toBe('archivo'); // Archivo oculto
    });
  });
});