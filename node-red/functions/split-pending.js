// Input: rows from "SELECT ... FROM events WHERE sky_computed = 0".
// Output: one message per event (msg.event = the row).
const out = (msg.payload || []).map((row) => ({ event: row }));
node.status({ text: `${out.length} pending` });
return [out];
