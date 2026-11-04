const { randomUUID } = require('crypto');
module.exports = (req, res, next) => {
  // Generate locally: client-provided IDs must not forge another request's identity.
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  res.on('finish',()=>require('../services/platformDiagnostics').record(req,res.statusCode));
  next();
};
