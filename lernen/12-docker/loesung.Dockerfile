# Einheit 12 – Musterlösung: Dockerfile für die Planeten-API
# Bauen (im Projektordner): docker build -f lernen/12-docker/loesung.Dockerfile -t planeten-api .
# Starten:                  docker run --rm -p 127.0.0.1:3001:3001 planeten-api
FROM node:24-alpine
WORKDIR /app

# Erst die Paketlisten: Diese Schicht wird wiederverwendet, solange sich die Pakete nicht ändern.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY app.js ./

ENV PORT=3001
EXPOSE 3001

# Das node-Image bringt einen Benutzer "node" mit: nicht als root laufen.
USER node
CMD ["node", "app.js"]
