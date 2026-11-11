/**
 * test/integration.test.js - Testes Automatizados da API e Persistência
 */

const assert = require('node:assert');
const http = require('node:http');
const db = require('../db.js');
const auth = require('../auth.js');

console.log('--- Iniciando Testes do Vaultwarden Clone ---');

// 1. Teste de Autenticação e Hashing
console.log('1. Testando auth.js (Hashing e JWT)...');
const clientHash = 'mock_auth_hash_from_client_123';
const salt = 'testsalt';
const stored = auth.hashAuthHash(clientHash, salt);
assert.strictEqual(auth.verifyAuthHash(clientHash, salt, stored), true, 'Verificação de hash deve ser verdadeira');
assert.strictEqual(auth.verifyAuthHash('wrong_hash', salt, stored), false, 'Hash errado deve falhar');

const token = auth.signToken({ userId: 'u123', email: 'teste@exemplo.com' });
assert.ok(token, 'Token gerado deve existir');
const payload = auth.verifyToken(token);
assert.strictEqual(payload.userId, 'u123');
assert.strictEqual(payload.email, 'teste@exemplo.com');
console.log('✅ Testes de auth.js passaram com sucesso!');

// 2. Teste do Banco de Dados
console.log('2. Testando db.js...');
const testUser = {
  id: 'test_user_id',
  email: 'test' + Date.now() + '@exemplo.com',
  auth_hash: 'salt:hash',
  salt: 'salt123',
  encrypted_user_key: 'enckey123',
  kdf_iterations: 100000,
  created_at: Date.now(),
  updated_at: Date.now()
};

db.createUser(testUser);
const retrieved = db.getUserByEmail(testUser.email);
assert.ok(retrieved, 'Usuário criado deve ser recuperado');
assert.strictEqual(retrieved.id, testUser.id);

// Pastas
const testFolder = {
  id: 'folder_' + Date.now(),
  user_id: testUser.id,
  encrypted_name: 'enc_pasta',
  created_at: Date.now()
};
db.createFolder(testFolder);
const folders = db.getFoldersByUser(testUser.id);
assert.ok(folders.some(f => f.id === testFolder.id), 'Pasta deve ser recuperada');

// Ciphers
const testCipher = {
  id: 'cipher_' + Date.now(),
  user_id: testUser.id,
  folder_id: testFolder.id,
  type: 1,
  favorite: 0,
  encrypted_name: 'enc_login_google',
  encrypted_data: 'enc_data_blob',
  deleted_at: null,
  created_at: Date.now(),
  updated_at: Date.now()
};
db.createCipher(testCipher);
const ciphers = db.getCiphersByUser(testUser.id);
assert.ok(ciphers.some(c => c.id === testCipher.id), 'Cipher deve ser recuperado');

// Soft delete
db.updateCipher(testCipher.id, testUser.id, { deleted_at: Date.now() });
const activeCiphers = db.getCiphersByUser(testUser.id, false);
assert.ok(!activeCiphers.some(c => c.id === testCipher.id), 'Cipher deletado não deve aparecer nos ativos');

console.log('✅ Testes de db.js passaram com sucesso!');
console.log('--- Todos os testes unitários foram concluídos com 100% de sucesso! ---');
