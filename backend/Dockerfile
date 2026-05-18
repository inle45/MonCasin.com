FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY public ./public 2>/dev/null || true

RUN mkdir -p src/uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && node src/server.js"]
