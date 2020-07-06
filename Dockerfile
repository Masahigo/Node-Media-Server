FROM node:10.20.1-alpine as install-npm

RUN mkdir -p /app
WORKDIR /app

# install deps
COPY package*.json /app/
RUN npm install

FROM node:10.20.1-alpine

RUN apk update && \
    apk upgrade && \
    apk add 'ffmpeg>4.0.0'

RUN mkdir -p /app
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ENV MEDIA_ROOT='./media' FFMPEG_PATH='/usr/bin/ffmpeg'

# Copy deps
COPY --from=install-npm /app/node_modules /app/node_modules
# Setup workdir
COPY . /app

EXPOSE 1935

CMD ["node","app.js"]
