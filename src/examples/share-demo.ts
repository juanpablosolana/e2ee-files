/**
 * Demostración del flujo completo E2EE para compartir archivos
 * Este ejemplo muestra cómo funcionaría en una implementación completa
 */

import {
  generateRSAKeyPair,
  generateAESKey,
  encryptKeyWithRSA,
  decryptKeyWithRSA,
  exportPublicKeyToPEM,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../lib/crypto';

import { reEncryptFileKey } from '../lib/share-crypto';

/**
 * Simula el flujo completo de compartir un archivo con E2EE
 */
export async function demonstrateE2EESharing() {
  console.log('🔐 Demostración de compartir archivos E2EE');
  console.log('================================================\n');

  try {
    // 1. Generar claves para el propietario del archivo
    console.log('1. Generando claves RSA para el propietario...');
    const ownerKeyPair = await generateRSAKeyPair();

    // 2. Generar claves para el destinatario
    console.log('2. Generando claves RSA para el destinatario...');
    const recipientKeyPair = await generateRSAKeyPair();
    const recipientPublicKeyPEM = await exportPublicKeyToPEM(recipientKeyPair.publicKey);

    // 3. Simular archivo: generar clave AES y cifrarla con la clave pública del propietario
    console.log('3. Simulando archivo cifrado...');
    const fileAESKey = await generateAESKey();
    const encryptedFileKey = await encryptKeyWithRSA(fileAESKey, ownerKeyPair.publicKey);
    const encryptedFileKeyBase64 = arrayBufferToBase64(encryptedFileKey);

    console.log('   ✓ Archivo cifrado con clave AES');
    console.log('   ✓ Clave AES cifrada con RSA público del propietario');
    console.log(`   ✓ Clave cifrada (base64): ${encryptedFileKeyBase64.substring(0, 50)}...`);

    // 4. COMPARTIR: Re-cifrar la clave del archivo para el destinatario
    console.log('\n4. Compartiendo archivo (re-cifrado E2EE)...');
    const reEncryptedKey = await reEncryptFileKey(
      encryptedFileKeyBase64,
      ownerKeyPair.privateKey,
      recipientPublicKeyPEM
    );

    console.log('   ✓ Clave descifrada con RSA privado del propietario');
    console.log('   ✓ Clave re-cifrada con RSA público del destinatario');
    console.log(`   ✓ Nueva clave cifrada: ${reEncryptedKey.substring(0, 50)}...`);

    // 5. VERIFICACIÓN: El destinatario puede descifrar la clave
    console.log('\n5. Verificando que el destinatario puede acceder...');
    const reEncryptedKeyBuffer = base64ToArrayBuffer(reEncryptedKey);
    const decryptedAESKey = await decryptKeyWithRSA(reEncryptedKeyBuffer, recipientKeyPair.privateKey);

    // Comparar las claves AES (exportándolas para comparación)
    const originalKeyData = await crypto.subtle.exportKey('raw', fileAESKey);
    const decryptedKeyData = await crypto.subtle.exportKey('raw', decryptedAESKey);

    const keysMatch = arrayBufferToBase64(originalKeyData) === arrayBufferToBase64(decryptedKeyData);

    if (keysMatch) {
      console.log('   ✅ ¡ÉXITO! El destinatario puede descifrar la clave del archivo');
      console.log('   ✅ Las claves AES coinciden perfectamente');
    } else {
      console.log('   ❌ ERROR: Las claves no coinciden');
    }

    // 6. Resumen de seguridad
    console.log('\n📋 Resumen de seguridad E2EE:');
    console.log('================================');
    console.log('✓ Cada usuario tiene su par de claves RSA único');
    console.log('✓ Los archivos se cifran con claves AES únicas');
    console.log('✓ Las claves AES se cifran con RSA público del propietario');
    console.log('✓ Para compartir, se re-cifra la clave AES con RSA público del destinatario');
    console.log('✓ El servidor nunca ve las claves en texto plano');
    console.log('✓ Solo el propietario y destinatarios autorizados pueden descifrar');

  } catch (error) {
    console.error('❌ Error en la demostración:', error);
  }
}

/**
 * Función para demostrar el flujo desde el frontend
 */
export async function clientSideShareExample() {
  console.log('\n🌐 Flujo desde el frontend (cliente):');
  console.log('=====================================\n');

  // Este sería el flujo real en una aplicación de producción:
  console.log('1. Usuario propietario inicia compartir');
  console.log('2. Frontend solicita contraseña del propietario');
  console.log('3. Frontend descifra clave privada del propietario usando PBKDF2');
  console.log('4. Frontend descifra clave AES del archivo');
  console.log('5. Frontend obtiene clave pública del destinatario');
  console.log('6. Frontend re-cifra clave AES con clave pública del destinatario');
  console.log('7. Frontend envía clave re-cifrada al servidor');
  console.log('8. Servidor almacena la compartición sin ver datos en texto plano');

  console.log('\n🔒 Ventajas de este enfoque:');
  console.log('• Zero-knowledge: El servidor nunca ve datos sin cifrar');
  console.log('• Forward secrecy: Cambiar contraseña no afecta archivos compartidos');
  console.log('• Revocación instantánea: Eliminar registro de compartición');
  console.log('• Auditoría completa: Todos los eventos se registran');
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  demonstrateE2EESharing()
    .then(() => clientSideShareExample())
    .catch(console.error);
}