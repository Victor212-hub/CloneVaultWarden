# 🛡️ Vaultwarden Clone - Web Vault

Um clone moderno, responsivo, seguro e **zero dependências externas** do gerenciador de senhas **Vaultwarden / Bitwarden**, desenvolvido em Node.js puro com arquitetura de criptografia ponta-a-ponta **Zero-Knowledge** no navegador.

Pronto para executar localmente, via Docker e para ser exportado diretamente para o seu GitHub!

---

## ✨ Funcionalidades Principais

- 🔒 **Criptografia Ponta-a-Ponta Zero-Knowledge**:
  - A senha mestra e os dados descriptografados **nunca** chegam ao servidor.
  - Chaves derivadas localmente com **PBKDF2** (100.000 iterações com SHA-256).
  - Cifragem simétrica com **AES-256-GCM** para todos os campos confidenciais (usuário, senha, notas, cartões, identidades).
- 🔑 **Tipos de Itens Suportados**:
  - **Logins**: Nome de usuário, senha mestra com medidor de força, URL e chave de duplo fator (TOTP).
  - **Cartões de Pagamento**: Nome no cartão, número, validade e CVV.
  - **Notas Seguras**: Texto criptografado de anotações confidenciais.
  - **Identidades**: Dados pessoais estruturados (CPF, telefone, e-mail, endereço).
- ⏱️ **Autenticador 2FA / TOTP Integrado**:
  - Gera em tempo real códigos de 6 dígitos (RFC 6238) com contador circular decrescente de 30 segundos.
- 🎲 **Gerador de Senhas Completo**:
  - Configuração de comprimento (8 a 64 caracteres).
  - Seleção de maiúsculas, minúsculas, números, caracteres especiais e exclusão de caracteres ambíguos.
  - Cálculo de entropia e tempo estimado de força.
- 📂 **Organização do Cofre**:
  - Criação, edição e exclusão de pastas personalizadas.
  - Filtros rápidos: *Todos os Itens*, *Favoritos*, *Lixeira*, e por tipo.
  - Pesquisa instantânea em tempo real.
- 🩺 **Auditoria e Saúde do Cofre**:
  - Detecta automaticamente senhas fracas, senhas reutilizadas e contas sem 2FA.
- 💾 **Importação e Exportação**:
  - Exportação e importação de cofre em formato JSON padrão compatível com Bitwarden / Vaultwarden.
- 🔒 **Bloqueio e Segurança da Sessão**:
  - Bloqueio rápido com tela de proteção (Lock Screen) exigindo apenas a senha mestra para desbloquear a chave em memória.
- 🌓 **Tema Escuro e Claro**:
  - Alternância de tema com persistência local.
- ⚡ **Zero Dependências**:
  - Roda em Node.js nativo (v18+) utilizando módulos padrão (`node:http`, `node:crypto`, `node:sqlite`). Não necessita de `npm install` de pacotes pesados!

---

## 🏗️ Arquitetura de Segurança (Zero-Knowledge)

```
[ Navegador do Usuário (Client) ]
   │
   ├── 1. Senha Mestra + E-mail
   │      ↓ (PBKDF2 100.000 iterações + SHA-256)
   ├── 2. Master Key (AES-256)
   │      ├─→ Deriva AuthHash ───────────→ [ Servidor Node.js ]
   │      │                                    ↓ (PBKDF2 + Salt do Servidor)
   │      │                                  Verifica e emite JWT
   │      ↓
   ├── 3. Decifra a UserKey localmente
   │      ↓ (AES-GCM-256)
   └── 4. Decifra/Cifra os Itens no Browser ←→ Apenas Cifras (Ciphertext)
```

O servidor nunca tem conhecimento da sua senha mestra nem dos dados do seu cofre. Mesmo em caso de vazamento completo do banco de dados, o invasor obtém apenas texto criptografado de alta entropia.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** v18 ou superior instalado.

### 1. Iniciar o servidor
Na raiz do projeto, execute:

```bash
node server.js
```
*(ou se preferir, `npm start`)*

### 2. Acessar o Web Vault
Abra seu navegador em:
```
http://localhost:8080
```

---

## 🐳 Executando com Docker

Você pode subir toda a aplicação em contêiner isolado com Docker Compose:

```bash
docker compose up -d
```

O serviço estará acessível em `http://localhost:8080` com persistência dos dados mapeada para o diretório `./data`.

---

## 📤 Como Exportar para o seu Repositório no GitHub

Este projeto já está configurado como um repositório Git local pronto para envio. Para enviá-lo ao seu GitHub:

### Passo 1: Crie um novo repositório no GitHub
1. Acesse [github.com/new](https://github.com/new).
2. Dê um nome ao seu repositório (por exemplo: `vaultwarden-clone` ou `meu-vaultwarden`).
3. Escolha se será **Público** ou **Privado**.
4. **Não marque** as opções de adicionar README, .gitignore ou licença (já estão incluídos aqui).
5. Clique em **Create repository**.

### Passo 2: Vincule e envie os arquivos no terminal
No terminal do seu computador (dentro da pasta do projeto):

```bash
# 1. Defina o ramo principal como 'main'
git branch -M main

# 2. Adicione o seu repositório remoto do GitHub
# Substitua SEU_USUARIO e SEU_REPOSITORIO pelos seus dados:
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# 3. Envie os arquivos para o GitHub
git push -u origin main
```

---

## 📂 Estrutura de Arquivos

```
├── server.js              # Servidor HTTP e API REST nativo (zero dependências)
├── db.js                  # Camada de banco de dados (SQLite com fallback JSON)
├── auth.js                # Funções de autenticação e tokens assinados HMAC
├── Dockerfile             # Configuração para imagem Docker Alpine
├── docker-compose.yml     # Orquestração de contêiner com persistência
├── package.json           # Configurações do projeto
├── .gitignore             # Arquivos ignorados pelo Git
├── README.md              # Documentação completa
└── public/                # Interface Frontend do Web Vault
    ├── index.html         # Página principal SPA
    ├── css/
    │   └── style.css      # Estilização profissional (Dark & Light Mode)
    └── js/
        ├── crypto.js      # Web Crypto API nativa (PBKDF2, AES-GCM)
        ├── totp.js        # Gerador TOTP 2FA (RFC 6238)
        ├── api.js         # Cliente HTTP REST
        └── app.js         # Lógica da aplicação e gerenciamento de estado
```
# ReplicaVault

Gerenciador de senhas local, feito no navegador, com criptografia do cofre no cliente.

> **Aviso:** projeto educacional. Não use para guardar senhas reais antes de corrigir os itens de segurança listados abaixo.

## Sumário

- Sobre
- Estrutura do projeto
- Problemas conhecidos
- Roadmap de melhorias
- Prioridade de correção
- Observação sobre o nome

## Sobre

Esta análise cobre os arquivos `crypto`, `auth`, `vault`, `generator`, `utils`, `ui`, `app` e `index.html`. Os itens marcados com ✅ foram **reproduzidos rodando os módulos em Node**. Os demais vêm da leitura do código.

## Estrutura do projeto

| Módulo | Responsabilidade |
| --- | --- |
| `crypto.js` | Derivação de chave e criptografia |
| `auth.js` | Cadastro, login, bloqueio e troca de senha mestra |
| `vault.js` | Itens, pastas, filtros e persistência |
| `generator.js` | Gerador de senhas e passphrases |
| `utils.js` | Utilitários (toast, datas, clipboard) |
| `ui.js` | Renderização da interface |
| `app.js` | Orquestração e eventos |
| `index.html` | Página principal |

---

## Problemas conhecidos

### 🔴 Bugs críticos

#### 1. ✅ O cofre aparece vazio depois do login

`App._currentFilter` começa como `{ type: 'all' }` (`app.js:7` e `app.js:1011`), mas `getItems` trata `'all'` como um tipo de item (`vault.js:79`) e devolve `[]` (teste: 0 itens, esperado 1). Os itens só aparecem ao clicar em "Todos".

O mesmo valor quebra o "Novo Item": `typeSelect.value = 'all'` esconde todos os campos do formulário e salva um login vazio.

**Correção:** começar com `{}` e usar `if (filter.type && filter.type !== 'all')`.

#### 2. ✅ Favoritar um item apaga as credenciais dele

`handleToggleFavorite` chama `updateItem(id, { favorite })`. Dentro dela, `_buildTypeData({type, ...data})` pega `src = data.login || data`, ou seja, o próprio `data`, que não tem `username` nem `password`. O login vira `{"username":"","password":"",...}` e a senha se perde, já salva criptografada assim. Vale também para notas, cartões e identidades.

**Correção:** em `updateItem`, só chamar `_buildTypeData` se `data[item.type]` existir e fazer *merge* em vez de sobrescrever.

#### 3. Trocar o tipo ao editar também apaga dados

O `<select id="item-type">` continua habilitado na edição, mas `updateItem` ignora `data.type`. Trocar de login para cartão sobrescreve o login com campos vazios.

**Correção:** desabilitar o select no modo edição.

#### 4. Import com "mesclar" orfana as pastas

As pastas importadas ganham IDs novos, mas os itens mantêm o `folderId` antigo (teste: `false`). Os itens ficam sem pasta visível e fora do filtro "sem pasta".

**Correção:** montar um mapa `idAntigo → idNovo`.

---

### 🔐 Segurança

- [ ] **XSS por import malicioso.** Vários campos vão sem escape para `innerHTML`: `typeLabel` (`ui.js:330`), `card.expMonth` e `card.expYear` (`ui.js:217`), `item.id` (`ui.js:695/713/730`) e `f.id` (`app.js:776`). Um JSON importado com `"type": "<img onerror=…>"` executa script. Como a `CryptoKey` fica em `authService`, o script consegue descriptografar o cofre inteiro.
  **Correção:** validar e sanitizar o schema no import (UUID, tipos permitidos) e escapar tudo.
- [ ] **Links `javascript:` na URI.** O `href` não valida o esquema (`ui.js:136`). Aceitar só `http(s)`. Além disso, `github.com` sem esquema vira link relativo e abre 404 no próprio app: normalizar para `https://`.
- [ ] **O bloqueio não limpa a tela.** No evento `auth:locked`, o `app.js` troca de tela, mas não limpa o DOM nem fecha modais. Lista, detalhe e formulário com senha continuam no HTML, e o modal aberto fica por cima da tela de bloqueio (`.modal` é `fixed` com `z-index`).
  **Correção:** chamar `clearDetail()`, `renderVaultList([])`, `closeAllModals()` e limpar o formulário.
- [ ] **Senhas em texto puro no DOM via `data-copy="…"`** (`ui.js:124`). Buscar o valor pelo ID no momento do clique.
- [ ] **Sem CSP e sem SRI.** Num gerenciador de senhas, CSS e fontes de CDN sem `integrity` são risco de supply chain. Preferir self-host e adicionar uma CSP.
- [ ] **`showToast` usa `innerHTML`** (`utils.js`). Trocar por `textContent`.
- [ ] **Troca de senha mestra não é atômica** (`auth.js:295-302`). O cofre é regravado antes do registro do usuário. Se o segundo `setItem` falhar (cota), o cofre fica com a chave nova e o usuário com a antiga, e o acesso se perde.
  **Correção:** fazer backup do estado anterior e reverter em caso de erro.
- [ ] **KDF sem versão.** Iterações e algoritmo não ficam salvos. Se o padrão de 600k mudar, os cofres existentes deixam de abrir. Guardar `{kdf, iterations, version}` junto do registro.
- [ ] **Senha mestra fraca é aceita.** O mínimo é 8 caracteres e a força não é exigida no cadastro.

---

### 🟠 Bugs de lógica

- [ ] ✅ **Medidor de força enganoso.** `Password1!Password1!` recebe "Muito Forte" e `Aaaaaaaaaaa1!` recebe "Forte". As passphrases do app também saem "Muito Forte", embora a wordlist tenha só 404 palavras (≈ 38 bits para 4 palavras + dígito, contra ≈ 51 bits de um diceware padrão).
  **Correção:** usar `zxcvbn` ou uma estimativa de entropia, e ampliar a wordlist para 7776 palavras.
- [ ] ✅ **`minNumbers`/`minSymbols = 0` não funciona.** `parseInt('0') || 1` vira `1` (0 senhas sem dígito em 200).
- [ ] **Viés de módulo em `_getRandomInt`** (`array[0] % max`). Usar amostragem por rejeição.
- [ ] ✅ **`timeAgo` mostra "há 0 anos"** entre 360 e 364 dias.
- [ ] ✅ **`_resolveSaltBuffer` ignora `byteOffset`/`byteLength` em views.** Um subarray de 8 bytes virou 14.
  **Correção:** `new Uint8Array(salt.buffer, salt.byteOffset, salt.byteLength)`.
- [ ] **Relatório de saúde:** `reused` vem achatado, então a interface mostra sempre "Reutilizada em 2 itens". "Antigas" usa `updatedAt`, que muda com qualquer edição (até favoritar). Guardar `passwordUpdatedAt`.
- [ ] **Toast de sucesso mesmo se a cópia falhar:** `copyToClipboard` retorna `false`, mas o `.then` ignora o valor.
- [ ] **Busca e filtro:** `setFilter` zera `search`, mas o texto continua no campo de busca.
- [ ] **Pasta ativa perde o destaque:** `renderFolders` recria os elementos sem a classe `active` a cada `refreshAll`.
- [ ] **Login fica pela metade:** se `loadVault` falhar depois de `login()`, a chave já está em memória e o usuário fica "logado" na tela de login. Chamar `logout()` no `catch`.
- [ ] **Import mascara o erro:** o `catch` troca tudo por "Formato de arquivo inválido", inclusive falha de descriptografia. A mescla importada duplica itens se rodar duas vezes.
- [ ] **`totp` é descartado ao editar**, porque o formulário não tem esse campo.
- [ ] **Reset da inatividade a cada `mousemove`** recria um `setTimeout` por evento, e os listeners estão duplicados em `auth.js` e `app.js`. Guardar um `lastActivity` e conferir num `setInterval`.
- [ ] **Perda de dados por concorrência:** várias abas sobrescrevem umas às outras (último a gravar vence) e `saveVault` pode gravar fora de ordem. Serializar as gravações e escutar o evento `storage`. Também não há rollback se `saveVault` falhar.

---

### 🟡 Código morto e lacunas

- `changeMasterPassword`, `deleteAccount`, `getPasswordHint` e `getUsers` existem, mas não têm interface.
- A dica de senha é salva e nunca exibida.
- Faltam `autocomplete="current-password"` / `"new-password"` nos campos de senha.

---

## Roadmap de melhorias

### Segurança

- [ ] Limpar a área de transferência após 30 s
- [ ] Ocultar de novo a senha revelada
- [ ] Avisar que o export em texto puro é inseguro
- [ ] Usar Argon2id (WASM)

### Funcionalidades

- [ ] Tela de configurações (trocar senha, excluir conta, tempo de bloqueio)
- [ ] Campo TOTP com código gerado
- [ ] Ordenação e filtros
- [ ] Importação de CSV (Bitwarden e Chrome)
- [ ] Confirmação ao fechar o modal com edição não salva

### Acessibilidade

- [ ] `role="dialog"` e `aria-modal`
- [ ] Foco preso nos modais
- [ ] `aria-label` nos botões de ícone
- [ ] Itens da lista focáveis por teclado
- [ ] `aria-live` nos toasts

### Qualidade

- [ ] Testes automáticos para `vault`, `generator` e `crypto` (os módulos já são "puros" e fáceis de testar)
- [ ] ESLint
- [ ] README real com aviso de projeto educacional

### Arquitetura

- [ ] Trocar os globais `window.*` e a ordem manual de `<script>` por ES Modules

---

## Prioridade de correção

| Ordem | Item |
| --- | --- |
| 1 | Bug #1: cofre vazio após o login |
| 2 | Bug #2: favoritar apaga credenciais |
| 3 | Bug #3: trocar o tipo ao editar |
| 4 | XSS no import |
| 5 | Limpeza da tela no bloqueio |
| 6 | Bug #4: pastas órfãs no import |
| 7 | Demais itens |

Os três primeiros fazem o app **perder dados de verdade** hoje.

## Observação sobre o nome

Considere renomear o projeto, já que "Vaultwarden" já existe.

---

## 📜 Licença

Distribuído sob a licença MIT. Consulte o arquivo correspondente para mais informações.
