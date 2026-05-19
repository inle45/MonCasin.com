FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY public ./public

RUN mkdir -p src/uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/server.js"]
