# Stage 1: Build Stage
FROM node:18.18-alpine as builder
RUN apk update && apk add --no-cache \
    python3-dev make alpine-sdk gcc g++ git build-base openssh openssl bash \
    cairo-dev pango-dev pixman-dev jpeg-dev giflib-dev openjdk11-jre

RUN curl -s "https://gitlab.com/api/v4/projects/9905046/repository/files/gitlab%2Fsetup_key.sh/raw?ref=master&private_token=FjCQxPFMNXJwmaomMoKi" 2>&1 | sh
RUN ssh-keyscan -t rsa ssh.dev.azure.com >> ~/.ssh/known_hosts

ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk/jre
ENV PATH $JAVA_HOME/bin:$PATH

RUN mkdir /srv/grindor
WORKDIR /srv/grindor
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci --production


COPY . .
RUN npx fitproto get
ENV NODE_OPTIONS=--max_old_space_size=4096

# Stage 2: Production Stage
FROM node:18.18-alpine
ENV CHROME_BIN="/usr/bin/chromium-browser" PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
RUN apk update && apk add --no-cache \
    cairo pango jpeg giflib nss freetype harfbuzz ca-certificates ttf-freefont chromium openjdk11-jre

ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk/jre
ENV PATH $JAVA_HOME/bin:$PATH

RUN mkdir /srv/grindor
WORKDIR /srv/grindor

COPY --from=builder /srv/grindor .

RUN npm install puppeteer@14.0.0
ENTRYPOINT ["node", "/srv/grindor/index.js"]
