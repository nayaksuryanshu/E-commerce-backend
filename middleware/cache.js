const NodeCache = require('node-cache');

// Create cache instance (TTL in seconds)
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes default

const cacheMiddleware = (duration = 600) => {
  return (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authenticated requests (optional)
    if (req.headers.authorization) {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Store original json method
    const originalJson = res.json;

    // Override json method to cache response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data.success) {
        cache.set(key, data, duration);
      }
      
      // Call original json method
      originalJson.call(this, data);
    };

    next();
  };
};

module.exports = { cacheMiddleware }; // Export cacheMiddleware;