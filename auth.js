/**
 * auth.js - Autenticação e Criptografia do Servidor
 * Zero dependências externas (usa node:crypto nativo).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SECRET_FILE = path.join(__dirname, 'data', 'jwt_secret.key');

// Carrega ou gera a chave secreta persistente para assinar os tokens
function getJwtSecret() {
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf-8');
  }
  const secret = crypto.randomBytes(64).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, secret, 'utf-8');
  } catch (err) {
    // Caso ocorra problema de permissão temporário, retorna o secret gerado
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

/**
 * Deriva hash seguro no servidor a partir do authHash enviado pelo cliente
 */
function hashAuthHash(clientAuthHash, salt) {
  return crypto.pbkdf2Sync(clientAuthHash, salt, 50000, 64, 'sha512').toString('hex');
}

/**
 * Compara dois hashes em tempo constante (evita timing attacks)
 */
function verifyAuthHash(clientAuthHash, salt, storedHash) {
  const computed = hashAuthHash(clientAuthHash, salt);
  const bufA = Buffer.from(computed, 'utf-8');
  const bufB = Buffer.from(storedHash, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Gera um token assinado com HMAC-SHA256 (compatível com formato JWT)
 */
function signToken(payload, expiresInHours = 24) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + (expiresInHours * 3600)
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifica e decodifica o token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf-8');
  const expBuf = Buffer.from(expectedSignature, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expirado
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Limitador de taxa (Rate Limiter) simples em memória
const rateLimits = new Map();

function checkRateLimit(ip, maxAttempts = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, resetAt: now + windowMs };
  
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    rateLimits.set(ip, entry);
    return true;
  }

  entry.count++;
  rateLimits.set(ip, entry);

  if (entry.count > maxAttempts) {
    return false;
  }
  return true;
}

module.exports = {
  hashAuthHash,
  verifyAuthHash,
  signToken,
  verifyToken,
  checkRateLimit
};
