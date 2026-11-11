const { randomUUID } = require('crypto');
module.exports = (req, res, next) => {
  // Generate locally: client-provided IDs must not forge another request's identity.
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  // Tanılama kaydı en iyi çabadır: kaydın kendisindeki bir hata (ör. kapanan ortam) isteği veya süreci asla düşürmemeli.
  res.on('finish',()=>{try{require('../services/platformDiagnostics').record(req,res.statusCode);}catch{/* tanılama yazılamadı */}});
  next();
};
