FROM node:20-alpine
WORKDIR /app
# Backend is plain JavaScript (src/*.js), not compiled TypeScript — `node src/index.js` is correct.
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "src/index.js"]
