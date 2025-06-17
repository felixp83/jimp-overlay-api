# Nimm offiziellen Node.js LTS als Basis
FROM node:18-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# package.json und package-lock.json kopieren
COPY package.json ./

# Abhängigkeiten installieren
RUN npm install

# Restlichen Code kopieren
COPY . .

# Port freigeben
EXPOSE 3000

# Server starten
CMD ["npm", "start"]
