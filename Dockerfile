# Imagem base leve com Node.js Alpine
FROM node:22-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia metadados e arquivos do projeto
COPY package.json ./
COPY server.js ./
COPY db.js ./
COPY auth.js ./
COPY public ./public

# Cria diretório de dados persistentes
RUN mkdir -p /app/data

# Volume para dados persistentes (SQLite / JSON)
VOLUME ["/app/data"]

# Expõe a porta do servidor
EXPOSE 8080

# Variáveis de ambiente padrão
ENV PORT=8080 \
    NODE_ENV=production

# Usuário não-root para máxima segurança
USER node

# Comando de inicialização
CMD ["node", "server.js"]
