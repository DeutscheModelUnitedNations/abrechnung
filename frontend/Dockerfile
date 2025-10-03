FROM node:22-alpine

LABEL org.opencontainers.image.source=https://github.com/deutschemodelunitednations/abrechnung
LABEL org.opencontainers.image.description="DMUN abrechnung frontend"
LABEL org.opencontainers.image.licenses=AGPL-3.0-only

# install nginx
RUN apk add nginx

COPY frontend/nginx.conf /etc/nginx/nginx.conf

WORKDIR /app

COPY common ../common
RUN npm install --prefix ../common
RUN npm run --prefix ../common build

COPY frontend/package*.json ./

RUN npm install

COPY frontend/ .

RUN npm run build

ENTRYPOINT [ "/bin/sh", "-c" ]

CMD ["nginx -g 'daemon off;'"]

