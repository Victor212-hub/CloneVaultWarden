/**
 * server.js - Servidor HTTP Zero-Dependencies do Vaultwarden Clone
 * Provê API RESTful e serve a interface Web Vault de forma segura e rápida.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./db.js');
const auth = require('./auth.js');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Utilitário para respostas JSON
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  res.end(body);
}

// Utilitário para erros da API
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message, success: false });
}

// Leitura de corpo de requisição
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) { // Limite de 10MB
        reject(new Error('Corpo da requisição excede o limite máximo permitido'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Formato JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

// Middleware de autenticação
function authenticate(req) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.substring(7);
  return auth.verifyToken(token);
}

// Servidor Principal
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const clientIp = req.socket.remoteAddress || 'unknown';

  try {
    // ==========================================
    // ROTAS DE AUTENTICAÇÃO
    // ==========================================

    // POST /api/auth/prelogin - Retorna salt do usuário para derivação da chave mestra
    if (req.method === 'POST' && pathname === '/api/auth/prelogin') {
      const { email } = await parseBody(req);
      if (!email) return sendError(res, 400, 'E-mail é obrigatório');
      
      const user = db.getUserByEmail(email);
      if (user) {
        return sendJson(res, 200, {
          kdf: 0, // PBKDF2
          kdfIterations: user.kdf_iterations || 100000,
          salt: user.salt
        });
      }

      // Caso o usuário não exista, gera um salt pseudo-aleatório baseado no email
      // para prevenir enumeração de contas
      const pseudoSalt = crypto.createHash('sha256').update(email.toLowerCase() + 'vw-salt-protection').digest('base64');
      return sendJson(res, 200, {
        kdf: 0,
        kdfIterations: 100000,
        salt: pseudoSalt
      });
    }

    // POST /api/auth/register - Registra nova conta
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      if (!auth.checkRateLimit(clientIp, 15, 60000)) {
        return sendError(res, 429, 'Muitas tentativas. Aguarde 1 minuto.');
      }

      const { email, authHash, salt, encryptedUserKey, kdfIterations } = await parseBody(req);
      if (!email || !authHash || !salt || !encryptedUserKey) {
        return sendError(res, 400, 'Dados incompletos para registro');
      }

      const existing = db.getUserByEmail(email);
      if (existing) {
        return sendError(res, 409, 'Este endereço de e-mail já está cadastrado');
      }

      const serverSalt = crypto.randomBytes(32).toString('hex');
      const storedAuthHash = auth.hashAuthHash(authHash, serverSalt);
      const now = Date.now();
      const userId = crypto.randomUUID();

      const newUser = {
        id: userId,
        email: email.trim().toLowerCase(),
        auth_hash: `${serverSalt}:${storedAuthHash}`,
        salt,
        encrypted_user_key: encryptedUserKey,
        kdf_iterations: kdfIterations || 100000,
        created_at: now,
        updated_at: now
      };

      db.createUser(newUser);

      const token = auth.signToken({ userId, email: newUser.email });
      return sendJson(res, 201, {
        success: true,
        token,
        user: {
          id: userId,
          email: newUser.email,
          encryptedUserKey: newUser.encrypted_user_key,
          kdfIterations: newUser.kdf_iterations
        }
      });
    }

    // POST /api/auth/login - Autenticação de usuário
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      if (!auth.checkRateLimit(clientIp, 20, 60000)) {
        return sendError(res, 429, 'Muitas tentativas de login. Aguarde um instante.');
      }

      const { email, authHash } = await parseBody(req);
      if (!email || !authHash) {
        return sendError(res, 400, 'E-mail e senha são obrigatórios');
      }

      const user = db.getUserByEmail(email);
      if (!user) {
        return sendError(res, 401, 'E-mail ou senha mestra incorretos');
      }

      const [serverSalt, storedHash] = user.auth_hash.split(':');
      const isValid = auth.verifyAuthHash(authHash, serverSalt, storedHash);

      if (!isValid) {
        return sendError(res, 401, 'E-mail ou senha mestra incorretos');
      }

      const token = auth.signToken({ userId: user.id, email: user.email });
      return sendJson(res, 200, {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          encryptedUserKey: user.encrypted_user_key,
          kdfIterations: user.kdf_iterations
        }
      });
    }

    // GET /api/auth/me - Perfil do usuário atual
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const user = db.getUserById(session.userId);
      if (!user) return sendError(res, 404, 'Usuário não encontrado');

      return sendJson(res, 200, { user });
    }

    // POST /api/auth/password - Alterar senha mestra
    if (req.method === 'POST' && pathname === '/api/auth/password') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const { oldAuthHash, newAuthHash, newSalt, newEncryptedUserKey } = await parseBody(req);
      const user = db.getUserByEmail(session.email);
      if (!user) return sendError(res, 404, 'Usuário não encontrado');

      const [serverSalt, storedHash] = user.auth_hash.split(':');
      if (!auth.verifyAuthHash(oldAuthHash, serverSalt, storedHash)) {
        return sendError(res, 400, 'Senha mestra atual incorreta');
      }

      const newServerSalt = crypto.randomBytes(32).toString('hex');
      const newStoredHash = auth.hashAuthHash(newAuthHash, newServerSalt);
      const fullHash = `${newServerSalt}:${newStoredHash}`;

      db.updateMasterPassword(session.userId, fullHash, newSalt, newEncryptedUserKey);
      return sendJson(res, 200, { success: true, message: 'Senha mestra atualizada com sucesso' });
    }

    // ==========================================
    // SINCRONIZAÇÃO COMPLETA (VAULT SYNC)
    // ==========================================

    // GET /api/sync - Sincroniza cofre completo
    if (req.method === 'GET' && pathname === '/api/sync') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const user = db.getUserById(session.userId);
      const folders = db.getFoldersByUser(session.userId);
      const ciphers = db.getCiphersByUser(session.userId, true);

      return sendJson(res, 200, {
        profile: user,
        folders,
        ciphers
      });
    }

    // ==========================================
    // ROTAS DE PASTAS (FOLDERS)
    // ==========================================

    // POST /api/folders - Cria pasta
    if (req.method === 'POST' && pathname === '/api/folders') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const { encryptedName } = await parseBody(req);
      if (!encryptedName) return sendError(res, 400, 'Nome da pasta é obrigatório');

      const folder = {
        id: crypto.randomUUID(),
        user_id: session.userId,
        encrypted_name: encryptedName,
        created_at: Date.now()
      };

      db.createFolder(folder);
      return sendJson(res, 201, folder);
    }

    // PUT /api/folders/:id - Atualiza pasta
    if (req.method === 'PUT' && pathname.startsWith('/api/folders/')) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const folderId = pathname.split('/')[3];
      const { encryptedName } = await parseBody(req);
      if (!encryptedName) return sendError(res, 400, 'Nome é obrigatório');

      const updated = db.updateFolder(folderId, session.userId, encryptedName);
      if (!updated) return sendError(res, 404, 'Pasta não encontrada');

      return sendJson(res, 200, { success: true, id: folderId });
    }

    // DELETE /api/folders/:id - Remove pasta
    if (req.method === 'DELETE' && pathname.startsWith('/api/folders/')) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const folderId = pathname.split('/')[3];
      const deleted = db.deleteFolder(folderId, session.userId);
      if (!deleted) return sendError(res, 404, 'Pasta não encontrada');

      return sendJson(res, 200, { success: true });
    }

    // ==========================================
    // ROTAS DE ITENS DO COFRE (CIPHERS)
    // ==========================================

    // POST /api/ciphers - Cria item no cofre
    if (req.method === 'POST' && pathname === '/api/ciphers') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const body = await parseBody(req);
      if (!body.encryptedName || !body.encryptedData) {
        return sendError(res, 400, 'Dados criptografados do item são obrigatórios');
      }

      const now = Date.now();
      const cipher = {
        id: crypto.randomUUID(),
        user_id: session.userId,
        folder_id: body.folderId || null,
        type: Number(body.type) || 1,
        favorite: body.favorite ? 1 : 0,
        encrypted_name: body.encryptedName,
        encrypted_data: body.encryptedData,
        deleted_at: null,
        created_at: now,
        updated_at: now
      };

      db.createCipher(cipher);
      return sendJson(res, 201, cipher);
    }

    // PUT /api/ciphers/:id - Atualiza item
    if (req.method === 'PUT' && pathname.startsWith('/api/ciphers/')) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const cipherId = pathname.split('/')[3];
      const body = await parseBody(req);

      const updates = {};
      if (body.folderId !== undefined) updates.folder_id = body.folderId;
      if (body.type !== undefined) updates.type = Number(body.type);
      if (body.favorite !== undefined) updates.favorite = body.favorite ? 1 : 0;
      if (body.encryptedName !== undefined) updates.encrypted_name = body.encryptedName;
      if (body.encryptedData !== undefined) updates.encrypted_data = body.encryptedData;

      const updated = db.updateCipher(cipherId, session.userId, updates);
      if (!updated) return sendError(res, 404, 'Item não encontrado');

      return sendJson(res, 200, { success: true, id: cipherId });
    }

    // POST /api/ciphers/:id/favorite - Alterna favorito
    if (req.method === 'POST' && pathname.match(/^\/api\/ciphers\/[^/]+\/favorite$/)) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const cipherId = pathname.split('/')[3];
      const cipher = db.getCipherById(cipherId, session.userId);
      if (!cipher) return sendError(res, 404, 'Item não encontrado');

      const newFavorite = cipher.favorite ? 0 : 1;
      db.updateCipher(cipherId, session.userId, { favorite: newFavorite });

      return sendJson(res, 200, { success: true, favorite: newFavorite });
    }

    // DELETE /api/ciphers/:id - Move para lixeira
    if (req.method === 'DELETE' && pathname.startsWith('/api/ciphers/') && !pathname.endsWith('/permanent')) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const cipherId = pathname.split('/')[3];
      const updated = db.updateCipher(cipherId, session.userId, { deleted_at: Date.now() });
      if (!updated) return sendError(res, 404, 'Item não encontrado');

      return sendJson(res, 200, { success: true, message: 'Item movido para a lixeira' });
    }

    // POST /api/ciphers/:id/restore - Restaura da lixeira
    if (req.method === 'POST' && pathname.match(/^\/api\/ciphers\/[^/]+\/restore$/)) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const cipherId = pathname.split('/')[3];
      const updated = db.updateCipher(cipherId, session.userId, { deleted_at: null });
      if (!updated) return sendError(res, 404, 'Item não encontrado');

      return sendJson(res, 200, { success: true, message: 'Item restaurado' });
    }

    // DELETE /api/ciphers/:id/permanent - Exclusão permanente
    if (req.method === 'DELETE' && pathname.match(/^\/api\/ciphers\/[^/]+\/permanent$/)) {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const cipherId = pathname.split('/')[3];
      const deleted = db.deleteCipherPermanently(cipherId, session.userId);
      if (!deleted) return sendError(res, 404, 'Item não encontrado');

      return sendJson(res, 200, { success: true, message: 'Item excluído permanentemente' });
    }

    // POST /api/ciphers/purge - Esvaziar lixeira
    if (req.method === 'POST' && pathname === '/api/ciphers/purge') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const count = db.purgeTrash(session.userId);
      return sendJson(res, 200, { success: true, count, message: `${count} itens removidos da lixeira` });
    }

    // POST /api/import - Importação em lote
    if (req.method === 'POST' && pathname === '/api/import') {
      const session = authenticate(req);
      if (!session) return sendError(res, 401, 'Não autenticado');

      const { folders = [], ciphers = [] } = await parseBody(req);
      const folderMap = new Map();

      // Cria pastas importadas
      for (const f of folders) {
        const newFolder = {
          id: crypto.randomUUID(),
          user_id: session.userId,
          encrypted_name: f.encryptedName,
          created_at: Date.now()
        };
        db.createFolder(newFolder);
        if (f.tempId) folderMap.set(f.tempId, newFolder.id);
      }

      // Cria ciphers importados
      let importedCount = 0;
      for (const c of ciphers) {
        const cipher = {
          id: crypto.randomUUID(),
          user_id: session.userId,
          folder_id: (c.tempFolderId && folderMap.get(c.tempFolderId)) || c.folderId || null,
          type: Number(c.type) || 1,
          favorite: c.favorite ? 1 : 0,
          encrypted_name: c.encryptedName,
          encrypted_data: c.encryptedData,
          deleted_at: null,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        db.createCipher(cipher);
        importedCount++;
      }

      return sendJson(res, 200, { success: true, imported: importedCount });
    }

    // GET /api/status - Status do servidor
    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(res, 200, {
        status: 'online',
        app: 'Vaultwarden Clone',
        version: '1.0.0',
        dbType: db.type,
        timestamp: Date.now()
      });
    }

    // ==========================================
    // SERVIDOR DE ARQUIVOS ESTÁTICOS
    // ==========================================
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Normalização de segurança contra Path Traversal
    const safePath = path.normalize(filePath);
    if (!safePath.startsWith(PUBLIC_DIR)) {
      return sendError(res, 403, 'Acesso proibido');
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      fs.createReadStream(safePath).pipe(res);
      return;
    }

    // SPA Fallback: Se for uma rota de página sem extensão, serve index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath) && !path.extname(pathname)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN'
      });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    sendError(res, 404, 'Recurso não encontrado');

  } catch (error) {
    console.error('[SERVER ERROR]', error);
    sendError(res, 500, 'Erro interno do servidor: ' + error.message);
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  Vaultwarden Clone rodando com sucesso!`);
  console.log(`📡 URL Local: http://localhost:${PORT}`);
  console.log(`🔒 Criptografia: Zero-Knowledge E2E (PBKDF2 + AES-GCM)`);
  console.log(`💾 Banco de Dados: ${db.type.toUpperCase()}`);
  console.log(`=======================================================`);
});
