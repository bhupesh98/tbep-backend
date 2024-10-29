# Stage 1: Build
FROM node:22.1-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Copy *.graphql files to dist folder
COPY src/*.graphql dist/
# Stage 2: Run
FROM node:22.1-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./
ENV NODE_ENV=production
RUN npm install --only=production
CMD ["node", "dist/main.js"]
