/**
 * db.js - Camada de persistência para o Vaultwarden Clone
 * Suporta node:sqlite nativo (Node 22+) com fallback automático para JSON atômico.
 * Zero dependências externas.
 */

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'vault.db');
const JSON_DB_PATH = path.join(DATA_DIR, 'vault.json');

// Garante que o diretório data/ exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;
let useSqlite = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(DB_PATH);
  
  // Criação das tabelas
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      auth_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      encrypted_user_key TEXT NOT NULL,
      kdf_iterations INTEGER DEFAULT 100000,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      encrypted_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ciphers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder_id TEXT,
      type INTEGER NOT NULL,
      favorite INTEGER DEFAULT 0,
      encrypted_name TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ciphers_user ON ciphers(user_id);
    CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
  `);

  dbInstance = {
    type: 'sqlite',
    
    // Usuários
    createUser: (user) => {
      const stmt = sqlite.prepare(`
        INSERT INTO users (id, email, auth_hash, salt, encrypted_user_key, kdf_iterations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(user.id, user.email, user.auth_hash, user.salt, user.encrypted_user_key, user.kdf_iterations || 100000, user.created_at, user.updated_at);
      return user;
    },
    
    getUserByEmail: (email) => {
      const stmt = sqlite.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
      return stmt.get(email) || null;
    },
    
    getUserById: (id) => {
      const stmt = sqlite.prepare('SELECT id, email, salt, encrypted_user_key, kdf_iterations, created_at, updated_at FROM users WHERE id = ?');
      return stmt.get(id) || null;
    },

    updateMasterPassword: (userId, newAuthHash, newSalt, newEncryptedUserKey) => {
      const now = Date.now();
      const stmt = sqlite.prepare('UPDATE users SET auth_hash = ?, salt = ?, encrypted_user_key = ?, updated_at = ? WHERE id = ?');
      stmt.run(newAuthHash, newSalt, newEncryptedUserKey, now, userId);
      return true;
    },

    // Pastas
    createFolder: (folder) => {
      const stmt = sqlite.prepare('INSERT INTO folders (id, user_id, encrypted_name, created_at) VALUES (?, ?, ?, ?)');
      stmt.run(folder.id, folder.user_id, folder.encrypted_name, folder.created_at);
      return folder;
    },

    getFoldersByUser: (userId) => {
      const stmt = sqlite.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY created_at ASC');
      return stmt.all(userId);
    },

    updateFolder: (id, userId, encryptedName) => {
      const stmt = sqlite.prepare('UPDATE folders SET encrypted_name = ? WHERE id = ? AND user_id = ?');
      const res = stmt.run(encryptedName, id, userId);
      return res.changes > 0;
    },

    deleteFolder: (id, userId) => {
      // Remove a pasta e desvincula os ciphers vinculados a ela
      const unbindStmt = sqlite.prepare('UPDATE ciphers SET folder_id = NULL WHERE folder_id = ? AND user_id = ?');
      unbindStmt.run(id, userId);
      const stmt = sqlite.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?');
      const res = stmt.run(id, userId);
      return res.changes > 0;
    },

    // Ciphers (Itens do cofre)
    createCipher: (cipher) => {
      const stmt = sqlite.prepare(`
        INSERT INTO ciphers (id, user_id, folder_id, type, favorite, encrypted_name, encrypted_data, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        cipher.id,
        cipher.user_id,
        cipher.folder_id || null,
        cipher.type,
        cipher.favorite ? 1 : 0,
        cipher.encrypted_name,
        cipher.encrypted_data,
        cipher.deleted_at || null,
        cipher.created_at,
        cipher.updated_at
      );
      return cipher;
    },

    getCiphersByUser: (userId, includeDeleted = true) => {
      let query = 'SELECT * FROM ciphers WHERE user_id = ?';
      if (!includeDeleted) {
        query += ' AND deleted_at IS NULL';
      }
      query += ' ORDER BY favorite DESC, updated_at DESC';
      const stmt = sqlite.prepare(query);
      return stmt.all(userId);
    },

    getCipherById: (id, userId) => {
      const stmt = sqlite.prepare('SELECT * FROM ciphers WHERE id = ? AND user_id = ?');
      return stmt.get(id, userId) || null;
    },

    updateCipher: (id, userId, updates) => {
      const fields = [];
      const values = [];
      
      if (updates.folder_id !== undefined) {
        fields.push('folder_id = ?');
        values.push(updates.folder_id || null);
      }
      if (updates.type !== undefined) {
        fields.push('type = ?');
        values.push(updates.type);
      }
      if (updates.favorite !== undefined) {
        fields.push('favorite = ?');
        values.push(updates.favorite ? 1 : 0);
      }
      if (updates.encrypted_name !== undefined) {
        fields.push('encrypted_name = ?');
        values.push(updates.encrypted_name);
      }
      if (updates.encrypted_data !== undefined) {
        fields.push('encrypted_data = ?');
        values.push(updates.encrypted_data);
      }
      if (updates.deleted_at !== undefined) {
        fields.push('deleted_at = ?');
        values.push(updates.deleted_at);
      }

      fields.push('updated_at = ?');
      values.push(Date.now());

      values.push(id, userId);

      const sql = `UPDATE ciphers SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...values);
      return res.changes > 0;
    },

    deleteCipherPermanently: (id, userId) => {
      const stmt = sqlite.prepare('DELETE FROM ciphers WHERE id = ? AND user_id = ?');
      const res = stmt.run(id, userId);
      return res.changes > 0;
    },

    purgeTrash: (userId) => {
      const stmt = sqlite.prepare('DELETE FROM ciphers WHERE user_id = ? AND deleted_at IS NOT NULL');
      const res = stmt.run(userId);
      return res.changes;
    }
  };

  useSqlite = true;
  console.log('[DB] Armazenamento SQLite nativo inicializado em:', DB_PATH);
} catch (err) {
  console.warn('[DB] node:sqlite indisponível ou falhou. Inicializando fallback JSON atômico.', err.message);
  
  // Fallback para arquivo JSON com escrita atômica
  let store = { users: [], folders: [], ciphers: [] };
  if (fs.existsSync(JSON_DB_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
    } catch {
      store = { users: [], folders: [], ciphers: [] };
    }
  }

  const saveJson = () => {
    const tmpPath = JSON_DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, JSON_DB_PATH);
  };

  dbInstance = {
    type: 'json',
    createUser: (user) => {
      store.users.push(user);
      saveJson();
      return user;
    },
    getUserByEmail: (email) => {
      return store.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    getUserById: (id) => {
      const u = store.users.find(u => u.id === id);
      if (!u) return null;
      const { auth_hash, ...rest } = u;
      return rest;
    },
    updateMasterPassword: (userId, newAuthHash, newSalt, newEncryptedUserKey) => {
      const u = store.users.find(u => u.id === userId);
      if (!u) return false;
      u.auth_hash = newAuthHash;
      u.salt = newSalt;
      u.encrypted_user_key = newEncryptedUserKey;
      u.updated_at = Date.now();
      saveJson();
      return true;
    },
    createFolder: (folder) => {
      store.folders.push(folder);
      saveJson();
      return folder;
    },
    getFoldersByUser: (userId) => {
      return store.folders.filter(f => f.user_id === userId);
    },
    updateFolder: (id, userId, encryptedName) => {
      const f = store.folders.find(f => f.id === id && f.user_id === userId);
      if (!f) return false;
      f.encrypted_name = encryptedName;
      saveJson();
      return true;
    },
    deleteFolder: (id, userId) => {
      store.ciphers.forEach(c => {
        if (c.folder_id === id && c.user_id === userId) c.folder_id = null;
      });
      store.folders = store.folders.filter(f => !(f.id === id && f.user_id === userId));
      saveJson();
      return true;
    },
    createCipher: (cipher) => {
      store.ciphers.push(cipher);
      saveJson();
      return cipher;
    },
    getCiphersByUser: (userId, includeDeleted = true) => {
      return store.ciphers.filter(c => c.user_id === userId && (includeDeleted || !c.deleted_at));
    },
    getCipherById: (id, userId) => {
      return store.ciphers.find(c => c.id === id && c.user_id === userId) || null;
    },
    updateCipher: (id, userId, updates) => {
      const c = store.ciphers.find(c => c.id === id && c.user_id === userId);
      if (!c) return false;
      Object.assign(c, updates, { updated_at: Date.now() });
      saveJson();
      return true;
    },
    deleteCipherPermanently: (id, userId) => {
      const initialLen = store.ciphers.length;
      store.ciphers = store.ciphers.filter(c => !(c.id === id && c.user_id === userId));
      saveJson();
      return store.ciphers.length < initialLen;
    },
    purgeTrash: (userId) => {
      const count = store.ciphers.filter(c => c.user_id === userId && c.deleted_at).length;
      store.ciphers = store.ciphers.filter(c => !(c.user_id === userId && c.deleted_at));
      saveJson();
      return count;
    }
  };
}

module.exports = dbInstance;
