/**
 * public/js/totp.js - Gerador de Códigos TOTP (RFC 6238) nativo no navegador
 * Suporta chaves secretas Base32 e gera códigos de 6 dígitos com rotação a cada 30 segundos.
 */

const VaultTOTP = (() => {
  // Tabela de decodificação Base32 (RFC 4648)
  const RFC4648_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32ToBytes(base32) {
    if (!base32) return new Uint8Array(0);
    // Remove espaços, traços e padding '='
    const cleaned = base32.toUpperCase().replace(/[\s\-=]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = RFC4648_BASE32.indexOf(cleaned[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * Gera código TOTP a partir de uma chave secreta
   * @param {string} secret - Chave secreta em Base32 ou URL otpauth://
   * @param {number} timeStep - Janela em segundos (padrão 30)
   * @param {number} digits - Dígitos do código (padrão 6)
   */
  async function generateTOTP(secret, timeStep = 30, digits = 6) {
    try {
      // Se for URL otpauth, extrai o secret
      if (secret.startsWith('otpauth://')) {
        const url = new URL(secret);
        secret = url.searchParams.get('secret') || secret;
      }

      const keyBytes = base32ToBytes(secret);
      if (keyBytes.length === 0) return null;

      const epoch = Math.floor(Date.now() / 1000);
      const counter = Math.floor(epoch / timeStep);
      const remainingSeconds = timeStep - (epoch % timeStep);

      // Prepara o contador de 8 bytes em Big-Endian
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setBigUint64(0, BigInt(counter));

      // Importa a chave HMAC-SHA1
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );

      // Assina o contador
      const hmacSignature = await window.crypto.subtle.sign('HMAC', cryptoKey, buffer);
      const hmacBytes = new Uint8Array(hmacSignature);

      // Dynamic Truncation
      const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
      const codeBinary =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);

      const codeModulo = codeBinary % Math.pow(10, digits);
      const formattedCode = codeModulo.toString().padStart(digits, '0');

      return {
        code: formattedCode,
        remainingSeconds,
        period: timeStep,
        progress: (remainingSeconds / timeStep) * 100
      };
    } catch (err) {
      console.warn('Erro ao calcular TOTP:', err);
      return null;
    }
  }

  return {
    generateTOTP,
    base32ToBytes
  };
})();
