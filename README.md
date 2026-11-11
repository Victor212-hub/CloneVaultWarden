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

---

## 📜 Licença

Distribuído sob a licença MIT. Consulte o arquivo correspondente para mais informações.
