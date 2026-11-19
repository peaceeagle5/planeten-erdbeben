// Builds a USGS catalog query from the inject payload {start, end, minmag}.
// USGS returns at most 20000 events per request - keep the range small enough (e.g. 1 year at M5+).
const { start, end, minmag } = msg.payload;
msg.url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=earthquake' +
  `&orderby=time-asc&starttime=${encodeURIComponent(start)}&endtime=${encodeURIComponent(end)}` +
  `&minmagnitude=${encodeURIComponent(minmag)}`;
delete msg.payload;
return msg;
