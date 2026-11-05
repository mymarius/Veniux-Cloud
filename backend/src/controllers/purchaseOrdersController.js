const service = require('../services/procurementService');
const wrap = work => async (req, res) => {
  try {
    await work(req, res);
  } catch (error) {
    res.status(error.status || 400).json({
      error: error.message,
      ...(error.excess ? {
        excess: error.excess
      } : {})
    });
  }
};
const getAllPurchaseOrders = wrap(async (req, res) => res.json(await service.list(req.user, req.query.status)));
const getPurchaseOrderById = wrap(async (req, res) => res.json(await service.detail(req.user, req.params.id)));
const createPurchaseOrder = wrap(async (req, res) => res.status(201).json(await service.create(req.user, req.body, req.get('Idempotency-Key'))));
const createFromForecast = wrap(async (req, res) => res.status(201).json(await service.draftsFromForecast(req.user, req.body, req.get('Idempotency-Key'))));
const receivePurchaseOrder = wrap(async (req, res) => res.json(await service.receive(req.user, req.params.id, req.body, req.get('Idempotency-Key'))));
const transitionPurchaseOrder = wrap(async (req, res) => res.json(await service.transition(req.user, req.params.id, req.body)));
const returnPurchaseOrder = wrap(async (req, res) => {
  const order = await service.detail(req.user, req.params.id);
  res.json(await service.supplierReturn(req.user, order.supplier_id, order.id, req.body, req.get('Idempotency-Key')));
});
module.exports = {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  createFromForecast,
  receivePurchaseOrder,
  transitionPurchaseOrder,
  returnPurchaseOrder
};
