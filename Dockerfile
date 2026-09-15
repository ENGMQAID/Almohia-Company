FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/data/group.sqlite
WORKDIR /app
COPY package.json ./
COPY index.html portal.html styles.css portal.css features.css public-updates.css app.js portal.js auth.js import.js features.js public-updates.js server-connect.js runtime-config.js ./
COPY assets ./assets
COPY server ./server
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8787
CMD ["node", "server/main.mjs"]
