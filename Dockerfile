FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
CMD ["node", "index.js"]
