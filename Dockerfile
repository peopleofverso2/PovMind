FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json server.js ./
COPY --chown=node:node index.html styles.css app.js sw.js manifest.json robots.txt sitemap.xml ./
COPY --chown=node:node assets ./assets

USER node
EXPOSE 8080

CMD ["node", "server.js"]
