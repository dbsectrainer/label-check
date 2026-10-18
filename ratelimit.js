// Fixed-window, per-client rate limiter shared by server.js and api/extract.js.
// State is in memory, so on serverless hosts the limit applies per warm instance. That is
// enough to stop casual abuse of the API key; use a platform firewall for hard guarantees.
"use strict";

function createLimiter(limit, windowMs, now) {
  now = now || Date.now;
  var hits = new Map();
  return function allow(key) {
    var t = now();
    var entry = hits.get(key);
    if (!entry || t >= entry.resetAt) {
      // Drop expired entries before adding a new one so the map cannot grow without bound.
      if (hits.size > 5000) {
        hits.forEach(function (v, k) {
          if (t >= v.resetAt) hits.delete(k);
        });
      }
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}

module.exports = { createLimiter: createLimiter };
