# Stage 1: Build
FROM node:22.1-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Copy *.graphql files to dist folder
COPY src/*.graphql dist/

# Stage 2: Run
FROM node:22.1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
ENV NODE_ENV=production
RUN npm install --only=production
CMD ["npm", "run", "start:prod"]
