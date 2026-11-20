FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./package.json
RUN npm install --omit=dev
COPY driiveme-sync.cjs ./driiveme-sync.cjs
COPY driiveme-vendor ./driiveme-vendor
EXPOSE 8080
CMD ["node", "driiveme-sync.cjs"]
