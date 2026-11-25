// Business Charts panel (Apache ECharts): the solar system at the selected earthquake, seen from above.
// This is the BODY of a function: Business Charts runs it as new Function('context', <this code>)
// and draws the object it returns (an ECharts "option"). dashboard-builder.js puts it into the panel.
//
// context.panel.data.series = the query results (refId A = planets, B = the quake for the title)
// context.grafana           = theme, replaceVariables('$body'), locationService (change variables)
// context.panel.chart       = the ECharts instance (for click events)
//
// Angle  = heliocentric ecliptic longitude (0° = direction of the vernal equinox, counterclockwise).
// Radius = NOT to scale: every orbit gets its own evenly spaced ring (Mercury = 1 ... Pluto = 9),
//          otherwise Mercury to Mars would vanish in the middle next to Neptune. A planet between two
//          mean orbits (e.g. Pluto on its oval orbit) is placed between the rings. Real distances: tooltip.

const byRef = (id) => context.panel.data.series.find((s) => s.refId === id);
const col = (s, name) => {
  const f = s && s.fields.find((x) => x.name === name);
  return f ? Array.from(f.values) : [];
};
const A = byRef('A');
const B = byRef('B');
const bodies = col(A, 'body');
const lon = col(A, 'lon');
const dist = col(A, 'dist');
const selected = context.grafana.replaceVariables('$body');
const theme = context.grafana.theme;
const text = theme.colors.text.primary;
const muted = theme.colors.text.secondary;
const faint = theme.isDark ? 'rgba(204,204,220,0.15)' : 'rgba(36,41,46,0.15)';

const ORBIT = { Mercury: 0.387, Venus: 0.723, Earth: 1, Mars: 1.524, Jupiter: 5.203, Saturn: 9.537, Uranus: 19.19, Neptune: 30.07, Pluto: 39.48 };
const STEPS = [0, ...Object.values(ORBIT)];
const r = (au) => {
  for (let k = 1; k < STEPS.length; k++) if (au <= STEPS[k]) return k - 1 + (au - STEPS[k - 1]) / (STEPS[k] - STEPS[k - 1]);
  return 9 + (au - STEPS[9]) / 9.41;
};
const COLOR = { Earth: '#5794f2', Mars: '#ff7383', Jupiter: '#e0b27a', Saturn: '#e8d18b' };
const SIZE = { Earth: 13, Jupiter: 16, Saturn: 14 };

const orbits = Object.values(ORBIT).map((a) => ({
  type: 'line', coordinateSystem: 'polar', silent: true, showSymbol: false, z: 1,
  data: Array.from({ length: 121 }, (_, i) => [r(a), i * 3]),
  lineStyle: { color: faint, width: 1 },
}));

const planets = bodies.map((b, i) => ({
  name: b, value: [r(dist[i]), lon[i]], dist: dist[i], lon: lon[i],
  symbolSize: SIZE[b] || 9,
  itemStyle: { color: COLOR[b] || '#c7d0d9', borderColor: b === selected ? '#fade2a' : 'transparent', borderWidth: 3 },
  label: { show: true, position: 'right', formatter: b, color: b === 'Earth' || b === selected ? text : muted, fontSize: 11 },
}));

// Line of sight: from the Earth to the selected body = the direction in which we see it.
// The Moon is right next to the Earth, so it gets no line.
const ei = bodies.indexOf('Earth');
const si = bodies.indexOf(selected);
const sight = [];
if (ei >= 0 && selected === 'Sun') sight.push([r(dist[ei]), lon[ei]], [0, 0]);
else if (ei >= 0 && si >= 0 && si !== ei) sight.push([r(dist[ei]), lon[ei]], [r(dist[si]), lon[si]]);

const t = col(B, 'time')[0];
const place = col(B, 'place')[0];
const mag = col(B, 'magnitude')[0];
const when = t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '';
const stillComputing = bodies.length > 0 && bodies.length < 9; // only the Earth: Node-RED has not reached this quake yet

// Click a planet: it becomes $body for the whole dashboard (no page reload).
const chart = context.panel.chart;
chart.off('click');
chart.on('click', (p) => {
  if (p.data && p.data.name && p.data.name !== 'Earth') context.grafana.locationService.partial({ 'var-body': p.data.name }, true);
});

return {
  backgroundColor: 'transparent',
  title: {
    text: place || 'No earthquake',
    subtext: stillComputing ? 'Positions seen from the Sun are still being computed (Node-RED) ...' : when + (mag ? '   ·   M ' + mag : ''),
    left: 'center', top: 4,
    textStyle: { color: text, fontSize: 14, fontWeight: 500 }, subtextStyle: { color: muted },
  },
  tooltip: {
    trigger: 'item',
    formatter: (p) => (p.data && p.data.dist !== undefined
      ? '<b>' + p.data.name + '</b><br>' + p.data.dist.toFixed(3) + ' AU from the Sun<br>longitude ' + p.data.lon.toFixed(1) + '°'
      : p.seriesName === 'Sun' ? '<b>Sun</b>' : ''),
  },
  polar: { radius: '78%', center: ['50%', '56%'] },
  angleAxis: {
    type: 'value', min: 0, max: 360, interval: 30, startAngle: 0, clockwise: false,
    axisLabel: { formatter: '{value}°', color: muted, fontSize: 10 }, splitLine: { show: false },
    axisLine: { lineStyle: { color: faint } },
  },
  radiusAxis: { type: 'value', min: 0, max: 9.6, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
  series: [
    ...orbits,
    { name: 'Sun', type: 'scatter', coordinateSystem: 'polar', z: 3, data: [[0, 0]], symbolSize: 16,
      itemStyle: { color: '#fade2a', shadowBlur: 20, shadowColor: '#fade2a' } },
    { name: 'Line of sight', type: 'line', coordinateSystem: 'polar', silent: true, showSymbol: false, z: 2,
      data: sight, lineStyle: { color: '#fade2a', width: 1.5, type: 'dashed' } },
    { name: 'Planets', type: 'scatter', coordinateSystem: 'polar', z: 4, data: planets, cursor: 'pointer' },
  ],
};
