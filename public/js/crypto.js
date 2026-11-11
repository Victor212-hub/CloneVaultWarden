/**
 * public/js/crypto.js - Criptografia Ponta-a-Ponta Zero-Knowledge
 * Executada 100% no navegador via Web Crypto API nativa.
 * A senha mestra e as senhas em texto puro NUNCA são enviadas ao servidor.
 */

const VaultCrypto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Utilitários de conversão ArrayBuffer <-> Base64
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Deriva a chave mestra (Master Key) a partir da senha e do email usando PBKDF2
   */
  async function deriveMasterKey(password, email, iterations = 100000) {
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey', 'deriveBits']
    );

    const salt = enc.encode(email.trim().toLowerCase());

    const masterKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    return masterKey;
  }

  /**
   * Deriva o AuthHash enviado ao servidor para autenticação.
   * Feito através de PBKDF2(masterKey, password, 1 iteration, SHA-256),
   * garantindo que o servidor jamais descubra a chave mestra de decriptação.
   */
  async function deriveAuthHash(masterKey, password) {
    const rawMasterKey = await window.crypto.subtle.exportKey('raw', masterKey);
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      rawMasterKey,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const authBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(password),
        iterations: 1,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return bufferToBase64(authBits);
  }

  /**
   * Gera uma chave simétrica AES-256 exclusiva do usuário para cifrar os itens do cofre
   */
  async function generateUserKey() {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cifra a UserKey com a MasterKey para salvar no servidor
   */
  async function encryptUserKey(userKey, masterKey) {
    const rawUserKey = await window.crypto.subtle.exportKey('raw', userKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      masterKey,
      rawUserKey
    );

    return JSON.stringify({
      iv: bufferToBase64(iv),
      data: bufferToBase64(encrypted)
    });
  }

  /**
   * Decifra a UserKey recebida do servidor usando a MasterKey
   */
  async function decryptUserKey(encryptedUserKeyStr, masterKey) {
    const parsed = typeof encryptedUserKeyStr === 'string' ? JSON.parse(encryptedUserKeyStr) : encryptedUserKeyStr;
    const iv = base64ToBuffer(parsed.iv);
    const ciphertext = base64ToBuffer(parsed.data);

    const rawUserKey = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      masterKey,
      ciphertext
    );

    return await window.crypto.subtle.importKey(
      'raw',
      rawUserKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cifra dados em texto puro com a chave simétrica do usuário
   */
  async function encryptData(plaintext, key) {
    if (typeof plaintext === 'object') {
      plaintext = JSON.stringify(plaintext);
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = enc.encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoded
    );

    return JSON.stringify({
      iv: bufferToBase64(iv),
      data: bufferToBase64(ciphertext)
    });
  }

  /**
   * Decifra dados criptografados com a chave simétrica do usuário
   */
  async function decryptData(encryptedStr, key) {
    try {
      const parsed = typeof encryptedStr === 'string' ? JSON.parse(encryptedStr) : encryptedStr;
      const iv = base64ToBuffer(parsed.iv);
      const ciphertext = base64ToBuffer(parsed.data);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        ciphertext
      );

      return dec.decode(decrypted);
    } catch (err) {
      console.error('Falha ao decifrar dados:', err);
      return '[Erro de Decriptação]';
    }
  }

  return {
    bufferToBase64,
    base64ToBuffer,
    deriveMasterKey,
    deriveAuthHash,
    generateUserKey,
    encryptUserKey,
    decryptUserKey,
    encryptData,
    decryptData
  };
})();
