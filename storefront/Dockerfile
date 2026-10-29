FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# API_URL is baked into the /api rewrites at build time.
ARG API_URL=http://api:8080
ARG NEXT_PUBLIC_CASHFREE_MODE=sandbox
ENV API_URL=$API_URL NEXT_PUBLIC_CASHFREE_MODE=$NEXT_PUBLIC_CASHFREE_MODE
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
