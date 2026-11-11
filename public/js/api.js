/**
 * public/js/api.js - Cliente de Comunicação com a API REST
 */

const VaultAPI = (() => {
  let authToken = localStorage.getItem('vw_token') || null;

  function setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem('vw_token', token);
    } else {
      localStorage.removeItem('vw_token');
    }
  }

  function getToken() {
    return authToken;
  }

  function clearToken() {
    authToken = null;
    localStorage.removeItem('vw_token');
  }

  async function request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
          clearToken();
          window.dispatchEvent(new CustomEvent('vault:unauthorized'));
        }
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  return {
    setToken,
    getToken,
    clearToken,

    // Autenticação
    prelogin: (email) => request('/api/auth/prelogin', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

    register: (payload) => request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    login: (payload) => request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    getMe: () => request('/api/auth/me'),

    updatePassword: (payload) => request('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    // Sincronização
    sync: () => request('/api/sync'),

    // Ciphers (Itens)
    createCipher: (payload) => request('/api/ciphers', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    updateCipher: (id, payload) => request('/api/ciphers/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

    deleteCipher: (id) => request('/api/ciphers/' + id, {
      method: 'DELETE'
    }),

    restoreCipher: (id) => request(`/api/ciphers/${id}/restore`, {
      method: 'POST'
    }),

    permanentDeleteCipher: (id) => request(`/api/ciphers/${id}/permanent`, {
      method: 'DELETE'
    }),

    toggleFavorite: (id) => request(`/api/ciphers/${id}/favorite`, {
      method: 'POST'
    }),

    purgeTrash: () => request('/api/ciphers/purge', {
      method: 'POST'
    }),

    // Pastas
    createFolder: (payload) => request('/api/folders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    updateFolder: (id, payload) => request('/api/folders/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

    deleteFolder: (id) => request('/api/folders/' + id, {
      method: 'DELETE'
    }),

    // Importação
    importBatch: (payload) => request('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

    // Status
    getStatus: () => request('/api/status')
  };
})();
