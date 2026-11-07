# Lonca sunucusu. Anahtarlar imaja girmez: .env, docker-compose'daki env_file ile çalışma anında verilir.
FROM node:22-bookworm-slim

# Dalış kalfası için ffmpeg/ffprobe ve python3 + Pillow
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pil ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .
# Çalışırken yazılan klasörler (compose bunları volume olarak bağlar)
RUN mkdir -p data public/medya && chown -R node:node data public/medya

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/merhaba').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.js"]
