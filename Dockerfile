FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install runtime deps (pg) — package.json + package-lock.json must come first
# so the npm install layer is cached when only static files change.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server.js ./
COPY --chown=node:node index.html styles.css app.js sw.js manifest.json robots.txt sitemap.xml sync.html sync.js ./
COPY --chown=node:node assets ./assets

USER node
EXPOSE 8080

CMD ["node", "server.js"]
