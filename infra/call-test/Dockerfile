# Built on the Mac (linux/amd64) and shipped to the VPS; the runtime image has no npm packages.
# The bundle is plain JavaScript, so it is built natively on the build machine.
FROM --platform=$BUILDPLATFORM node:24.21.0-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24.21.0-alpine
WORKDIR /app
COPY server.mjs ./
COPY --from=build /build/public ./public
# The reports volume takes this folder's owner when Docker first creates it.
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server.mjs"]
