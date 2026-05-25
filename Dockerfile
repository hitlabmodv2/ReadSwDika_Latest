FROM node:24-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN mkdir -p tmp sessions jadibot data

CMD ["node", "index.js"]