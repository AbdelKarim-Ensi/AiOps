FROM node:20-alpine AS build

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build


FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/prisma ./prisma

RUN npx prisma generate

COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]