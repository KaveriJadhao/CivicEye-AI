// Haversine formula to calculate distance between two coordinates in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearby reports within maxRadiusMeters
function findNearbyReports(reports, lat, lon, maxRadiusMeters = 80, category = null) {
  const matches = [];
  for (const rep of reports) {
    if (rep.status === "RESOLVED" || rep.status === "REJECTED") continue;
    if (category && rep.category !== category) continue;

    const dist = haversineDistance(lat, lon, rep.latitude, rep.longitude);
    if (dist <= maxRadiusMeters) {
      matches.push({ report: rep, distanceMeters: Math.round(dist) });
    }
  }
  return matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

module.exports = {
  haversineDistance,
  findNearbyReports,
};
