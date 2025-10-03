FROM node:alpine

LABEL org.opencontainers.image.source=https://github.com/deutschemodelunitednations/abrechnung
LABEL org.opencontainers.image.description="DMUN abrechnung backend"
LABEL org.opencontainers.image.licenses=AGPL-3.0-only

RUN mkdir /reports

WORKDIR /build

COPY common ../common
RUN npm install --prefix ../common
RUN npm run --prefix ../common build

COPY backend/package*.json ./

RUN npm install

COPY backend/ .

RUN npm run build

CMD ["npm", "run", "start"]
