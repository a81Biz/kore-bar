FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8000

CMD ["node",  "--inspect=0.0.0.0:9229", "src/index.js"]
