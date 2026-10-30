FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# API_URL is baked into the /api rewrites at build time.
ARG API_URL=http://api:8080
# Firebase web config (public identifiers, not secrets). NEXT_PUBLIC_* values are inlined by `next build`, so they
# must be passed as build args — setting them only at runtime has no effect. See FIREBASE_SETUP.md.
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
# Only for a local demo against the mock API: NEXT_PUBLIC_AUTH_MODE=otp. Never set in production.
ARG NEXT_PUBLIC_AUTH_MODE=""
ENV API_URL=$API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_AUTH_MODE=$NEXT_PUBLIC_AUTH_MODE
# Fail the image build instead of shipping a site whose login can't work.
RUN if [ "$NEXT_PUBLIC_AUTH_MODE" != "otp" ] && { [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ] || [ -z "$NEXT_PUBLIC_FIREBASE_PROJECT_ID" ] || [ -z "$NEXT_PUBLIC_FIREBASE_APP_ID" ]; }; then \
      echo "ERROR: NEXT_PUBLIC_FIREBASE_* build args are missing - phone login would not work. See FIREBASE_SETUP.md." && exit 1; fi
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
