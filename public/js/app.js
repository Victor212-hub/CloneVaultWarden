/**
 * public/js/app.js - Controlador Principal da Interface Web Vault
 * Gerencia o estado, decriptação em memória, interface reativa e ações do usuário.
 */

const App = (() => {
  // Estado Global da Aplicação (mantido em memória)
  const state = {
    user: null,
    masterKey: null,
    userKey: null,
    folders: [],
    ciphers: [],
    activeFilter: 'all', // 'all', 'favorites', 'trash', 'type_1', 'type_2', 'type_3', 'type_4', 'folder_ID'
    searchQuery: '',
    isLocked: false,
    selectedCipherId: null,
    totpTimers: {}
  };

  // Ícones SVG inline para performance e zero dependências
  const ICONS = {
    login: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`,
    note: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    card: `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>`,
    identity: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>`,
    folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    star: `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
  };

  // Notificações Toast
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Copiar para área de transferência
  async function copyToClipboard(text, label = 'Texto') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      showToast(`${label} copiado com sucesso!`, 'success');
    } catch (err) {
      showToast('Falha ao copiar para a área de transferência', 'error');
    }
  }

  // Medidor de entropia / força de senha
  function evaluatePasswordStrength(password) {
    if (!password) return { score: 0, text: 'Vazia', color: '#94a3b8', width: '0%' };
    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    if (score < 40) return { score, text: 'Muito Fraca', color: '#ef4444', width: '25%' };
    if (score < 60) return { score, text: 'Fraca', color: '#f97316', width: '50%' };
    if (score < 80) return { score, text: 'Boa', color: '#eab308', width: '75%' };
    return { score, text: 'Muito Forte', color: '#10b981', width: '100%' };
  }

  // Gerador de Senhas
  function generatePassword(options = {}) {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      special = true,
      avoidAmbiguous = true
    } = options;

    let chars = '';
    if (uppercase) chars += avoidAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) chars += avoidAmbiguous ? 'abcdefghijkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) chars += avoidAmbiguous ? '23456789' : '0123456789';
    if (special) chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[randomValues[i] % chars.length];
    }
    return password;
  }

  // Alternador de Temas (Claro / Escuro)
  function initTheme() {
    const savedTheme = localStorage.getItem('vw_theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('vw_theme', isDark ? 'dark' : 'light');
    showToast(`Modo ${isDark ? 'Escuro' : 'Claro'} ativado`, 'info');
  }

  // Inicialização e Renderização do Vault
  async function syncAndDecryptVault() {
    try {
      const data = await VaultAPI.sync();
      state.folders = [];
      state.ciphers = [];

      // Decifra as pastas
      for (const f of data.folders) {
        const decryptedName = await VaultCrypto.decryptData(f.encrypted_name, state.userKey);
        state.folders.push({
          id: f.id,
          name: decryptedName,
          created_at: f.created_at
        });
      }

      // Decifra os itens (ciphers)
      for (const c of data.ciphers) {
        const decryptedName = await VaultCrypto.decryptData(c.encrypted_name, state.userKey);
        let decryptedData = {};
        try {
          const jsonStr = await VaultCrypto.decryptData(c.encrypted_data, state.userKey);
          decryptedData = JSON.parse(jsonStr);
        } catch {
          decryptedData = {};
        }

        state.ciphers.push({
          id: c.id,
          folder_id: c.folder_id,
          type: c.type,
          favorite: !!c.favorite,
          deleted_at: c.deleted_at,
          name: decryptedName,
          data: decryptedData,
          created_at: c.created_at,
          updated_at: c.updated_at
        });
      }

      renderSidebar();
      renderItems();
    } catch (err) {
      showToast('Erro ao sincronizar cofre: ' + err.message, 'error');
    }
  }

  // Renderiza Sidebar
  function renderSidebar() {
    // Contadores
    const activeCiphers = state.ciphers.filter(c => !c.deleted_at);
    const totalCount = activeCiphers.length;
    const favCount = activeCiphers.filter(c => c.favorite).length;
    const trashCount = state.ciphers.filter(c => c.deleted_at).length;

    const countLogins = activeCiphers.filter(c => c.type === 1).length;
    const countCards = activeCiphers.filter(c => c.type === 3).length;
    const countNotes = activeCiphers.filter(c => c.type === 2).length;
    const countIdentities = activeCiphers.filter(c => c.type === 4).length;

    document.getElementById('badge-all').textContent = totalCount;
    document.getElementById('badge-favorites').textContent = favCount;
    document.getElementById('badge-trash').textContent = trashCount;
    document.getElementById('badge-type-1').textContent = countLogins;
    document.getElementById('badge-type-3').textContent = countCards;
    document.getElementById('badge-type-2').textContent = countNotes;
    document.getElementById('badge-type-4').textContent = countIdentities;

    // Pastas
    const folderListEl = document.getElementById('sidebar-folder-list');
    folderListEl.innerHTML = '';

    state.folders.forEach(folder => {
      const folderItemCount = activeCiphers.filter(c => c.folder_id === folder.id).length;
      const el = document.createElement('div');
      el.className = `sidebar-nav-item ${state.activeFilter === `folder_${folder.id}` ? 'active' : ''}`;
      el.innerHTML = `
        ${ICONS.folder}
        <span class="folder-name-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(folder.name)}</span>
        <span class="sidebar-badge">${folderItemCount}</span>
      `;
      el.onclick = () => {
        state.activeFilter = `folder_${folder.id}`;
        renderSidebar();
        renderItems();
      };
      folderListEl.appendChild(el);
    });

    // Atualiza classe ativa dos itens fixos
    document.querySelectorAll('.sidebar-nav-item[data-filter]').forEach(item => {
      if (item.dataset.filter === state.activeFilter) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Atualiza info do usuário na barra
    if (state.user) {
      document.getElementById('user-email-display').textContent = state.user.email;
      const initial = state.user.email.charAt(0).toUpperCase();
      document.getElementById('user-avatar-initial').textContent = initial;
    }
  }

  // Renderiza Lista Principal de Itens
  function renderItems() {
    const listEl = document.getElementById('items-list-container');
    const headerTitleEl = document.getElementById('content-filter-title');
    const headerCountEl = document.getElementById('content-filter-count');
    
    // Determina itens filtrados
    let items = [...state.ciphers];

    if (state.activeFilter === 'trash') {
      items = items.filter(c => c.deleted_at);
      headerTitleEl.textContent = 'Lixeira';
    } else {
      items = items.filter(c => !c.deleted_at);
      if (state.activeFilter === 'all') {
        headerTitleEl.textContent = 'Todos os Itens';
      } else if (state.activeFilter === 'favorites') {
        items = items.filter(c => c.favorite);
        headerTitleEl.textContent = 'Favoritos';
      } else if (state.activeFilter === 'type_1') {
        items = items.filter(c => c.type === 1);
        headerTitleEl.textContent = 'Logins';
      } else if (state.activeFilter === 'type_2') {
        items = items.filter(c => c.type === 2);
        headerTitleEl.textContent = 'Notas Seguras';
      } else if (state.activeFilter === 'type_3') {
        items = items.filter(c => c.type === 3);
        headerTitleEl.textContent = 'Cartões';
      } else if (state.activeFilter === 'type_4') {
        items = items.filter(c => c.type === 4);
        headerTitleEl.textContent = 'Identidades';
      } else if (state.activeFilter.startsWith('folder_')) {
        const folderId = state.activeFilter.replace('folder_', '');
        const folder = state.folders.find(f => f.id === folderId);
        items = items.filter(c => c.folder_id === folderId);
        headerTitleEl.textContent = folder ? folder.name : 'Pasta';
      }
    }

    // Filtro por texto de pesquisa
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      items = items.filter(c => {
        const inName = (c.name || '').toLowerCase().includes(q);
        const inUsername = (c.data?.username || '').toLowerCase().includes(q);
        const inUri = (c.data?.uri || '').toLowerCase().includes(q);
        const inNotes = (c.data?.notes || '').toLowerCase().includes(q);
        return inName || inUsername || inUri || inNotes;
      });
    }

    headerCountEl.textContent = items.length;

    // Exibe botão de esvaziar lixeira se estiver na aba de lixeira
    const purgeBtn = document.getElementById('btn-purge-trash');
    if (purgeBtn) {
      purgeBtn.style.display = state.activeFilter === 'trash' && items.length > 0 ? 'inline-flex' : 'none';
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <h3>Nenhum item encontrado</h3>
          <p>${state.searchQuery ? 'Tente buscar por outro termo ou limpe a pesquisa.' : 'Adicione seu primeiro login ou nota segura clicando em "+ Novo Item".'}</p>
        </div>
      `;
      return;
    }

    let html = `<div class="items-table">`;
    items.forEach(item => {
      let icon = ICONS.login;
      if (item.type === 2) icon = ICONS.note;
      if (item.type === 3) icon = ICONS.card;
      if (item.type === 4) icon = ICONS.identity;

      let subtitle = item.data?.username || '';
      if (item.type === 3) subtitle = item.data?.cardNumber ? `•••• ${item.data.cardNumber.slice(-4)}` : 'Cartão de Pagamento';
      if (item.type === 2) subtitle = 'Nota Segura Criptografada';
      if (item.type === 4) subtitle = item.data?.fullName || 'Identidade Pessoal';

      const folder = state.folders.find(f => f.id === item.folder_id);

      html += `
        <div class="item-row" data-id="${item.id}">
          <div class="item-icon-box">${icon}</div>
          <div class="item-info" onclick="App.openItemModal('${item.id}')">
            <div class="item-title">
              <span>${escapeHtml(item.name)}</span>
              ${folder ? `<span class="item-badge">${escapeHtml(folder.name)}</span>` : ''}
            </div>
            <div class="item-subtitle">${escapeHtml(subtitle)}</div>
          </div>
          <div class="item-actions">
            ${item.data?.username ? `
              <button class="btn-item-action" title="Copiar Usuário" onclick="event.stopPropagation(); App.copyUsername('${item.id}')">
                <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </button>
            ` : ''}
            ${item.data?.password ? `
              <button class="btn-item-action" title="Copiar Senha" onclick="event.stopPropagation(); App.copyPassword('${item.id}')">
                <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              </button>
            ` : ''}
            ${item.data?.totpSecret ? `
              <button class="btn-item-action" title="Copiar Código 2FA" onclick="event.stopPropagation(); App.copyTOTP('${item.id}')">
                <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              </button>
            ` : ''}
            ${!item.deleted_at ? `
              <button class="btn-item-action ${item.favorite ? 'favorite-active' : ''}" title="${item.favorite ? 'Desfavoritar' : 'Favoritar'}" onclick="event.stopPropagation(); App.toggleFavorite('${item.id}')">
                ${ICONS.star}
              </button>
              <button class="btn-item-action" title="Mover para lixeira" onclick="event.stopPropagation(); App.moveToTrash('${item.id}')">
                ${ICONS.trash}
              </button>
            ` : `
              <button class="btn-item-action" title="Restaurar item" onclick="event.stopPropagation(); App.restoreItem('${item.id}')">
                <svg viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              </button>
              <button class="btn-item-action" title="Excluir permanentemente" style="color: #ef4444;" onclick="event.stopPropagation(); App.permanentDeleteItem('${item.id}')">
                ${ICONS.trash}
              </button>
            `}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    listEl.innerHTML = html;
  }

  // Modais e Diálogos
  function openItemModal(cipherId = null) {
    state.selectedCipherId = cipherId;
    const modal = document.getElementById('item-modal');
    const titleEl = document.getElementById('item-modal-title');
    const form = document.getElementById('item-form');
    form.reset();

    // Popula seleção de pastas
    const folderSelect = document.getElementById('item-folder-select');
    folderSelect.innerHTML = `<option value="">Nenhuma pasta</option>`;
    state.folders.forEach(f => {
      folderSelect.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
    });

    if (cipherId) {
      const item = state.ciphers.find(c => c.id === cipherId);
      if (!item) return;

      titleEl.textContent = 'Editar Item';
      document.getElementById('item-type-select').value = item.type;
      document.getElementById('item-name').value = item.name;
      folderSelect.value = item.folder_id || '';
      document.getElementById('item-favorite').checked = item.favorite;

      // Campos específicos
      document.getElementById('item-username').value = item.data?.username || '';
      document.getElementById('item-password').value = item.data?.password || '';
      document.getElementById('item-uri').value = item.data?.uri || '';
      document.getElementById('item-notes').value = item.data?.notes || '';
      document.getElementById('item-totp').value = item.data?.totpSecret || '';

      // Cartão
      document.getElementById('item-card-holder').value = item.data?.cardHolder || '';
      document.getElementById('item-card-number').value = item.data?.cardNumber || '';
      document.getElementById('item-card-exp').value = item.data?.cardExp || '';
      document.getElementById('item-card-cvv').value = item.data?.cardCvv || '';

      // Identidade
      document.getElementById('item-id-name').value = item.data?.fullName || '';
      document.getElementById('item-id-doc').value = item.data?.document || '';
      document.getElementById('item-id-phone').value = item.data?.phone || '';
      document.getElementById('item-id-email').value = item.data?.email || '';

      updateItemTypeFields(item.type);
      updatePasswordMeter(item.data?.password || '');
      startModalTOTP(item.data?.totpSecret);
    } else {
      titleEl.textContent = 'Novo Item';
      document.getElementById('item-type-select').value = '1';
      updateItemTypeFields(1);
      updatePasswordMeter('');
      stopModalTOTP();
    }

    modal.classList.remove('hidden');
  }

  function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
    stopModalTOTP();
    state.selectedCipherId = null;
  }

  function updateItemTypeFields(type) {
    type = Number(type);
    document.getElementById('section-login').style.display = type === 1 ? 'block' : 'none';
    document.getElementById('section-card').style.display = type === 3 ? 'block' : 'none';
    document.getElementById('section-identity').style.display = type === 4 ? 'block' : 'none';
    document.getElementById('section-notes').style.display = 'block'; // Sempre visível
  }

  function updatePasswordMeter(pwd) {
    const res = evaluatePasswordStrength(pwd);
    const fill = document.getElementById('password-meter-fill');
    const text = document.getElementById('password-meter-text');
    if (fill && text) {
      fill.style.width = res.width;
      fill.style.backgroundColor = res.color;
      text.textContent = `Força: ${res.text}`;
      text.style.color = res.color;
    }
  }

  // Monitor de TOTP no modal
  let modalTotpInterval = null;
  function startModalTOTP(secret) {
    const container = document.getElementById('modal-totp-container');
    if (!secret) {
      container.style.display = 'none';
      stopModalTOTP();
      return;
    }
    container.style.display = 'flex';

    const update = async () => {
      const res = await VaultTOTP.generateTOTP(secret);
      if (res) {
        document.getElementById('modal-totp-code').textContent = res.code.slice(0, 3) + ' ' + res.code.slice(3);
        document.getElementById('modal-totp-timer').textContent = `${res.remainingSeconds}s`;
      }
    };

    update();
    stopModalTOTP();
    modalTotpInterval = setInterval(update, 1000);
  }

  function stopModalTOTP() {
    if (modalTotpInterval) {
      clearInterval(modalTotpInterval);
      modalTotpInterval = null;
    }
  }

  // Salvar Item (Criptografa com UserKey e envia à API)
  async function saveItem(e) {
    e.preventDefault();
    const type = Number(document.getElementById('item-type-select').value);
    const name = document.getElementById('item-name').value.trim();
    const folderId = document.getElementById('item-folder-select').value || null;
    const favorite = document.getElementById('item-favorite').checked;

    if (!name) {
      showToast('O nome do item é obrigatório', 'error');
      return;
    }

    const payloadData = {
      notes: document.getElementById('item-notes').value
    };

    if (type === 1) { // Login
      payloadData.username = document.getElementById('item-username').value;
      payloadData.password = document.getElementById('item-password').value;
      payloadData.uri = document.getElementById('item-uri').value;
      payloadData.totpSecret = document.getElementById('item-totp').value.trim();
    } else if (type === 3) { // Cartão
      payloadData.cardHolder = document.getElementById('item-card-holder').value;
      payloadData.cardNumber = document.getElementById('item-card-number').value;
      payloadData.cardExp = document.getElementById('item-card-exp').value;
      payloadData.cardCvv = document.getElementById('item-card-cvv').value;
    } else if (type === 4) { // Identidade
      payloadData.fullName = document.getElementById('item-id-name').value;
      payloadData.document = document.getElementById('item-id-doc').value;
      payloadData.phone = document.getElementById('item-id-phone').value;
      payloadData.email = document.getElementById('item-id-email').value;
    }

    try {
      // Criptografia local zero-knowledge
      const encryptedName = await VaultCrypto.encryptData(name, state.userKey);
      const encryptedData = await VaultCrypto.encryptData(payloadData, state.userKey);

      const requestBody = {
        type,
        folderId,
        favorite,
        encryptedName,
        encryptedData
      };

      if (state.selectedCipherId) {
        await VaultAPI.updateCipher(state.selectedCipherId, requestBody);
        showToast('Item atualizado com sucesso!', 'success');
      } else {
        await VaultAPI.createCipher(requestBody);
        showToast('Item adicionado ao cofre!', 'success');
      }

      closeItemModal();
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao salvar item: ' + err.message, 'error');
    }
  }

  // Ações Rápidas de Itens
  function copyUsername(cipherId) {
    const item = state.ciphers.find(c => c.id === cipherId);
    if (item?.data?.username) copyToClipboard(item.data.username, 'Nome de usuário');
  }

  function copyPassword(cipherId) {
    const item = state.ciphers.find(c => c.id === cipherId);
    if (item?.data?.password) copyToClipboard(item.data.password, 'Senha');
  }

  async function copyTOTP(cipherId) {
    const item = state.ciphers.find(c => c.id === cipherId);
    if (item?.data?.totpSecret) {
      const res = await VaultTOTP.generateTOTP(item.data.totpSecret);
      if (res) copyToClipboard(res.code, 'Código de Autenticação (2FA)');
    }
  }

  async function toggleFavorite(cipherId) {
    try {
      const res = await VaultAPI.toggleFavorite(cipherId);
      const item = state.ciphers.find(c => c.id === cipherId);
      if (item) item.favorite = !!res.favorite;
      renderSidebar();
      renderItems();
    } catch (err) {
      showToast('Erro ao atualizar favorito: ' + err.message, 'error');
    }
  }

  async function moveToTrash(cipherId) {
    if (!confirm('Deseja mover este item para a lixeira?')) return;
    try {
      await VaultAPI.deleteCipher(cipherId);
      showToast('Item movido para a lixeira', 'info');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao mover item: ' + err.message, 'error');
    }
  }

  async function restoreItem(cipherId) {
    try {
      await VaultAPI.restoreCipher(cipherId);
      showToast('Item restaurado com sucesso!', 'success');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao restaurar item: ' + err.message, 'error');
    }
  }

  async function permanentDeleteItem(cipherId) {
    if (!confirm('Esta ação é permanente e irreversível. Deseja realmente excluir este item?')) return;
    try {
      await VaultAPI.permanentDeleteCipher(cipherId);
      showToast('Item excluído permanentemente', 'info');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao excluir item: ' + err.message, 'error');
    }
  }

  async function purgeTrash() {
    if (!confirm('Deseja esvaziar a lixeira e apagar todos os itens permanentemente?')) return;
    try {
      const res = await VaultAPI.purgeTrash();
      showToast(`${res.count || 0} itens removidos permanentemente`, 'info');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao esvaziar lixeira: ' + err.message, 'error');
    }
  }

  // Gerenciamento de Pastas
  async function promptCreateFolder() {
    const name = prompt('Nome da nova pasta:');
    if (!name || !name.trim()) return;

    try {
      const encryptedName = await VaultCrypto.encryptData(name.trim(), state.userKey);
      await VaultAPI.createFolder({ encryptedName });
      showToast('Pasta criada!', 'success');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Erro ao criar pasta: ' + err.message, 'error');
    }
  }

  // Gerador de Senhas - Modal
  function openGeneratorModal() {
    const modal = document.getElementById('generator-modal');
    modal.classList.remove('hidden');
    refreshGenerator();
  }

  function refreshGenerator() {
    const length = Number(document.getElementById('gen-length').value);
    const uppercase = document.getElementById('gen-upper').checked;
    const lowercase = document.getElementById('gen-lower').checked;
    const numbers = document.getElementById('gen-num').checked;
    const special = document.getElementById('gen-special').checked;
    const avoidAmbiguous = document.getElementById('gen-ambiguous').checked;

    const pwd = generatePassword({ length, uppercase, lowercase, numbers, special, avoidAmbiguous });
    document.getElementById('gen-output').value = pwd;
    document.getElementById('gen-length-val').textContent = length;

    const res = evaluatePasswordStrength(pwd);
    const bar = document.getElementById('gen-meter-fill');
    const label = document.getElementById('gen-meter-text');
    bar.style.width = res.width;
    bar.style.backgroundColor = res.color;
    label.textContent = `Qualidade: ${res.text}`;
    label.style.color = res.color;
  }

  function copyGeneratedPassword() {
    const pwd = document.getElementById('gen-output').value;
    if (pwd) copyToClipboard(pwd, 'Senha gerada');
  }

  function useGeneratedPasswordInModal() {
    const pwd = document.getElementById('gen-output').value;
    if (pwd) {
      document.getElementById('item-password').value = pwd;
      updatePasswordMeter(pwd);
      document.getElementById('generator-modal').classList.add('hidden');
    }
  }

  // Auditoria de Segurança
  function openSecurityAuditModal() {
    const modal = document.getElementById('audit-modal');
    const active = state.ciphers.filter(c => !c.deleted_at && c.type === 1);

    const reusedMap = new Map();
    const weakList = [];
    const missing2FA = [];

    active.forEach(item => {
      const pwd = item.data?.password;
      if (pwd) {
        // Reutilizadas
        const count = reusedMap.get(pwd) || [];
        count.push(item);
        reusedMap.set(pwd, count);

        // Fracas
        const st = evaluatePasswordStrength(pwd);
        if (st.score < 60) weakList.push(item);
      }
      if (!item.data?.totpSecret) {
        missing2FA.push(item);
      }
    });

    const reusedEntries = [...reusedMap.entries()].filter(([_, list]) => list.length > 1);

    document.getElementById('audit-total-accounts').textContent = active.length;
    document.getElementById('audit-weak-count').textContent = weakList.length;
    document.getElementById('audit-reused-count').textContent = reusedEntries.length;
    document.getElementById('audit-2fa-count').textContent = missing2FA.length;

    modal.classList.remove('hidden');
  }

  // Importar & Exportar Cofre
  function openImportExportModal() {
    document.getElementById('import-export-modal').classList.remove('hidden');
  }

  function exportVaultJSON() {
    const exportData = {
      encrypted: false,
      exportedAt: new Date().toISOString(),
      folders: state.folders.map(f => ({ id: f.id, name: f.name })),
      items: state.ciphers.filter(c => !c.deleted_at).map(c => ({
        id: c.id,
        folderId: c.folder_id,
        type: c.type,
        name: c.name,
        favorite: c.favorite,
        data: c.data
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultwarden-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a);
    showToast('Cofre exportado com sucesso!', 'success');
  }

  async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.items && !Array.isArray(json)) {
        throw new Error('Formato de arquivo incompatível');
      }

      const rawItems = json.items || json;
      const foldersToCreate = [];
      const ciphersToCreate = [];

      for (const item of rawItems) {
        const encName = await VaultCrypto.encryptData(item.name || 'Sem título', state.userKey);
        const encData = await VaultCrypto.encryptData(item.data || {
          username: item.login?.username || '',
          password: item.login?.password || '',
          uri: item.login?.uris?.[0]?.uri || '',
          notes: item.notes || ''
        }, state.userKey);

        ciphersToCreate.push({
          type: item.type || 1,
          favorite: !!item.favorite,
          encryptedName: encName,
          encryptedData: encData
        });
      }

      await VaultAPI.importBatch({ folders: foldersToCreate, ciphers: ciphersToCreate });
      showToast(`${ciphersToCreate.length} itens importados com sucesso!`, 'success');
      document.getElementById('import-export-modal').classList.add('hidden');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Falha na importação: ' + err.message, 'error');
    }
  }

  // Bloqueio do Cofre (Lock Screen)
  function lockVault() {
    state.isLocked = true;
    state.userKey = null; // Remove a chave simétrica de decriptação da memória
    document.getElementById('lock-screen').classList.remove('hidden');
    document.getElementById('lock-master-password').value = '';
    document.getElementById('lock-master-password').focus();
  }

  async function unlockVault(e) {
    e.preventDefault();
    const pwd = document.getElementById('lock-master-password').value;
    if (!pwd) return;

    try {
      const pre = await VaultAPI.prelogin(state.user.email);
      const masterKey = await VaultCrypto.deriveMasterKey(pwd, state.user.email, pre.kdfIterations);
      state.userKey = await VaultCrypto.decryptUserKey(state.user.encryptedUserKey, masterKey);
      state.masterKey = masterKey;
      state.isLocked = false;
      document.getElementById('lock-screen').classList.add('hidden');
      showToast('Cofre desbloqueado com sucesso', 'success');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Senha mestra incorreta', 'error');
    }
  }

  // Desconectar (Logout)
  function logout() {
    VaultAPI.clearToken();
    state.user = null;
    state.masterKey = null;
    state.userKey = null;
    state.folders = [];
    state.ciphers = [];
    document.getElementById('vault-app-screen').classList.add('hidden');
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    showToast('Você foi desconectado.', 'info');
  }

  // Autenticação (Login e Registro)
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showToast('Preencha seu e-mail e senha mestra', 'error');
      return;
    }

    try {
      showToast('Derivando chave mestra com segurança...', 'info');
      const pre = await VaultAPI.prelogin(email);
      const masterKey = await VaultCrypto.deriveMasterKey(password, email, pre.kdfIterations);
      const authHash = await VaultCrypto.deriveAuthHash(masterKey, password);

      const res = await VaultAPI.login({ email, authHash });
      VaultAPI.setToken(res.token);
      state.user = res.user;
      state.masterKey = masterKey;
      state.userKey = await VaultCrypto.decryptUserKey(res.user.encryptedUserKey, masterKey);

      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('vault-app-screen').classList.remove('hidden');

      showToast('Conectado com sucesso!', 'success');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Falha no login: ' + err.message, 'error');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPwd = document.getElementById('reg-password-confirm').value;

    if (!email || !password) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    if (password !== confirmPwd) {
      showToast('As senhas não coincidem', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('A senha mestra deve conter ao menos 8 caracteres', 'error');
      return;
    }

    try {
      showToast('Gerando chaves de criptografia ponta-a-ponta...', 'info');
      const kdfIterations = 100000;
      const salt = VaultCrypto.bufferToBase64(window.crypto.getRandomValues(new Uint8Array(32)));
      
      const masterKey = await VaultCrypto.deriveMasterKey(password, email, kdfIterations);
      const authHash = await VaultCrypto.deriveAuthHash(masterKey, password);
      
      const userKey = await VaultCrypto.generateUserKey();
      const encryptedUserKey = await VaultCrypto.encryptUserKey(userKey, masterKey);

      const res = await VaultAPI.register({
        email,
        authHash,
        salt,
        encryptedUserKey,
        kdfIterations
      });

      VaultAPI.setToken(res.token);
      state.user = res.user;
      state.masterKey = masterKey;
      state.userKey = userKey;

      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('vault-app-screen').classList.remove('hidden');

      showToast('Conta criada com sucesso! Bem-vindo ao Vaultwarden Clone.', 'success');
      await syncAndDecryptVault();
    } catch (err) {
      showToast('Falha no cadastro: ' + err.message, 'error');
    }
  }

  // Escape HTML para proteção contra XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicialização Geral da Página
  function init() {
    initTheme();

    // Eventos de Autenticação
    document.getElementById('login-form').onsubmit = handleLogin;
    document.getElementById('register-form').onsubmit = handleRegister;
    document.getElementById('lock-form').onsubmit = unlockVault;
    document.getElementById('item-form').onsubmit = saveItem;

    // Alternar abas de Login / Registro
    document.getElementById('tab-btn-login').onclick = () => {
      document.getElementById('tab-btn-login').classList.add('active');
      document.getElementById('tab-btn-register').classList.remove('active');
      document.getElementById('login-form-wrapper').classList.remove('hidden');
      document.getElementById('register-form-wrapper').classList.add('hidden');
    };

    document.getElementById('tab-btn-register').onclick = () => {
      document.getElementById('tab-btn-register').classList.add('active');
      document.getElementById('tab-btn-login').classList.remove('active');
      document.getElementById('register-form-wrapper').classList.remove('hidden');
      document.getElementById('login-form-wrapper').classList.add('hidden');
    };

    // Filtros da barra lateral
    document.querySelectorAll('.sidebar-nav-item[data-filter]').forEach(item => {
      item.onclick = () => {
        state.activeFilter = item.dataset.filter;
        renderSidebar();
        renderItems();
      };
    });

    // Pesquisa em tempo real
    document.getElementById('search-input').oninput = (e) => {
      state.searchQuery = e.target.value;
      renderItems();
    };

    // Tipo de item alterado
    document.getElementById('item-type-select').onchange = (e) => {
      updateItemTypeFields(e.target.value);
    };

    // Monitor de força de senha no item
    document.getElementById('item-password').oninput = (e) => {
      updatePasswordMeter(e.target.value);
    };

    // Gerador de senhas listeners
    ['gen-length', 'gen-upper', 'gen-lower', 'gen-num', 'gen-special', 'gen-ambiguous'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = refreshGenerator;
    });

    // Sessão expirada listener
    window.addEventListener('vault:unauthorized', () => {
      logout();
    });

    // Se houver token mas a página foi recarregada, solicita a senha mestra para desbloqueio
    if (VaultAPI.getToken()) {
      VaultAPI.getMe().then(res => {
        state.user = res.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('vault-app-screen').classList.remove('hidden');
        lockVault();
      }).catch(() => {
        logout();
      });
    }
  }

  return {
    init,
    toggleTheme,
    openItemModal,
    closeItemModal,
    saveItem,
    copyUsername,
    copyPassword,
    copyTOTP,
    toggleFavorite,
    moveToTrash,
    restoreItem,
    permanentDeleteItem,
    purgeTrash,
    promptCreateFolder,
    openGeneratorModal,
    refreshGenerator,
    copyGeneratedPassword,
    useGeneratedPasswordInModal,
    openSecurityAuditModal,
    openImportExportModal,
    exportVaultJSON,
    handleFileImport,
    lockVault,
    logout
  };
})();

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.init);
