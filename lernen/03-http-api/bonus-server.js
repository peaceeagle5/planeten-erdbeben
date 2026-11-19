// Einheit 03 – Bonus: deine eigene Lebensmittel-API
// Start:  node lernen/03-http-api/bonus-server.js
// Test:   curl "http://localhost:3002/foods"
//         curl "http://localhost:3002/foods?maxCalories=60"
//         curl -i "http://localhost:3002/gibtsnicht"
const http = require('node:http');

const foodMarket = [
  { name: 'Apple', calories: 52, protein: 0.3 },
  { name: 'Banana', calories: 89, protein: 1.1 },
  { name: 'Orange', calories: 47, protein: 0.9 },
];

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/foods') {
    // TODO 1: Wenn ?maxCalories=... angegeben ist, nur Lebensmittel mit weniger Kalorien zurückgeben
    //         (filter). Achtung: der Parameter ist ein Text, Number() benutzen.
    // TODO 2: Wenn maxCalories keine Zahl ist, mit 400 und einer Fehlermeldung antworten.
    return send(res, 200, foodMarket);
  }

  // TODO 3: GET /foods/average soll { average: <Durchschnitt der Kalorien> } liefern (reduce).

  send(res, 404, { error: 'Not found' });
});

server.listen(3002, () => console.log('Lebensmittel-API läuft auf http://localhost:3002/foods'));
