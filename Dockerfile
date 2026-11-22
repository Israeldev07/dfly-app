# syntax=docker/dockerfile:1
# Imagen de producción de Dfly. Etapas:
#   deps     → node_modules completos
#   builder  → cliente Prisma + `next build` (salida standalone)
#   tools    → CLI de Prisma y tsx: migraciones, seed e importación del catálogo
#   runner   → solo lo necesario para `node server.js` (la que se publica)

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# Sin scripts: el `postinstall` (prisma generate) necesita el esquema y se corre en el builder.
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma.config.ts` exige DIRECT_URL aunque generar el cliente no se conecta a la BD.
RUN DIRECT_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

FROM builder AS tools
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
