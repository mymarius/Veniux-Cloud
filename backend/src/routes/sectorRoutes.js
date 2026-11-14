const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const packs = require('../services/sectorPacks');
const hardware = require('../services/hardwareService');
const tableware = require('../services/tablewareService');
const restaurant = require('../services/restaurantService');
const router = express.Router();
const run = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { next(e); } };
const created = fn => async (req, res, next) => { try { res.status(201).json(await fn(req)); } catch (e) { next(e); } };
const staff = requireRole('admin', 'manager', 'cashier');
const boss = requireRole('admin', 'manager');

router.use(authMiddleware);

// Hangi sektör paketleri bu hesapta açık.
router.get('/packs/me', run(async req => ({ packs: await packs.mine(req.user, req.centralLicense), labels: packs.LABELS })));
router.get('/packs/admin', run(req => packs.listAll(req.user)));
router.put('/packs/admin/:tenant', run(req => packs.setForTenant(req.user, req.params.tenant, req.body && req.body.packs)));

// Hırdavat
const hw = express.Router(); hw.use(packs.require('hardware'), staff);
hw.get('/search', run(req => hardware.search(req.user, req.query)));
hw.get('/facets', run(req => hardware.facets(req.user, req.query)));
hw.post('/prices/bulk', boss, run(req => hardware.bulkPrice(req.user, req.body)));
hw.post('/critical/order', boss, created(req => hardware.criticalOrder(req.user, req.body, req.get('Idempotency-Key'))));
hw.get('/critical', run(req => hardware.critical(req.user)));
hw.get('/products/:id/units', run(req => require('../services/productUnits').list(req.user, req.params.id)));
hw.put('/products/:id/units', boss, run(req => require('../services/productUnits').save(req.user, req.params.id, req.body)));
hw.put('/products/:id/attributes', run(req => hardware.setAttributes(req.user, req.params.id, req.body)));
router.use('/hardware', hw);

// Züccaciye
const tw = express.Router(); tw.use(packs.require('tableware'), staff);
tw.get('/sets', run(req => tableware.listSets(req.user, req.query)));
tw.post('/sets', boss, created(req => tableware.saveSet(req.user, null, req.body)));
tw.put('/sets/:id', boss, run(req => tableware.saveSet(req.user, req.params.id, req.body)));
tw.delete('/sets/:id', boss, run(req => tableware.deleteSet(req.user, req.params.id)));
tw.get('/tags', run(() => ({ presets: tableware.PRESET_TAGS })));
tw.get('/locations', run(req => tableware.locations(req.user, req.query)));
tw.put('/locations/:id/tags', boss, run(req => tableware.setTags(req.user, req.params.id, req.body && req.body.tags)));
tw.get('/placement-check', run(req => tableware.placementCheck(req.user, req.query)));
tw.post('/price-label', boss, run(req => tableware.priceLabel(req.user, req.body, req.get('Idempotency-Key'))));
tw.put('/sets/:id/sale', boss, run(req => tableware.setSale(req.user, req.params.id, req.body)));
const twx = require('../services/tablewareExtras');
tw.post('/breakage', created(req => twx.breakage(req.user, req.body)));
tw.get('/breakage', boss, run(req => twx.breakageReport(req.user, req.query)));
tw.get('/registries', run(req => twx.registries(req.user, req.query)));
tw.post('/registries', boss, created(req => twx.saveRegistry(req.user, null, req.body)));
tw.get('/registries/:id', run(req => twx.registry(req.user, req.params.id)));
tw.put('/registries/:id', boss, run(req => twx.saveRegistry(req.user, req.params.id, req.body)));
tw.post('/registries/:id/items', boss, created(req => twx.addRegistryItem(req.user, req.params.id, req.body)));
tw.post('/registries/:id/items/:itemId/bought', run(req => twx.markBought(req.user, req.params.id, req.params.itemId, req.body)));
tw.delete('/registries/:id/items/:itemId', boss, run(req => twx.removeRegistryItem(req.user, req.params.id, req.params.itemId)));
router.use('/tableware', tw);

// Pide / restoran
const rs = express.Router(); rs.use(packs.require('restaurant'), staff);
rs.get('/tables', run(req => restaurant.tables(req.user)));
rs.post('/tables', boss, created(req => restaurant.saveTable(req.user, null, req.body)));
rs.put('/tables/:id', boss, run(req => restaurant.saveTable(req.user, req.params.id, req.body)));
rs.get('/menu', run(req => restaurant.menu(req.user)));
rs.put('/menu/:productId', boss, run(req => restaurant.setMenu(req.user, req.params.productId, req.body)));
rs.put('/menu/:productId/options', boss, run(req => restaurant.setMenuOptions(req.user, req.params.productId, req.body)));
rs.get('/recipes', boss, run(req => restaurant.recipes(req.user)));
rs.put('/recipes/:productId', boss, run(req => restaurant.setRecipe(req.user, req.params.productId, req.body)));
rs.post('/orders', created(req => restaurant.createOrder(req.user, req.body)));
rs.get('/orders', run(req => restaurant.orders(req.user, req.query)));
rs.patch('/orders/:id/items/:itemId', run(req => restaurant.setItemStatus(req.user, req.params.id, req.params.itemId, req.body)));
rs.post('/orders/:id/close', run(req => restaurant.closeOrder(req.user, req.params.id, req.body)));
rs.post('/orders/:id/move', run(req => restaurant.moveOrder(req.user, req.params.id, req.body)));
rs.post('/orders/:id/merge', run(req => restaurant.mergeOrders(req.user, req.params.id, req.body)));
rs.post('/orders/:id/pay-items', run(req => restaurant.payItems(req.user, req.params.id, req.body)));
rs.post('/orders/:id/adjustments', boss, created(req => restaurant.addAdjustment(req.user, req.params.id, req.body)));
rs.delete('/orders/:id/adjustments/:adjustmentId', boss, run(req => restaurant.removeAdjustment(req.user, req.params.id, req.params.adjustmentId)));
rs.put('/orders/:id/delivery', run(req => restaurant.setDelivery(req.user, req.params.id, req.body)));
rs.post('/orders/:id/refund', boss, created(req => restaurant.refundOrder(req.user, req.params.id, req.body)));
rs.get('/closed-today', boss, run(req => restaurant.closedToday(req.user)));
rs.get('/deliveries', run(req => restaurant.deliveries(req.user)));
rs.get('/feed', run(req => restaurant.feed(req.user, req.query)));
rs.get('/summary', boss, run(req => restaurant.summary(req.user, req.query)));
router.use('/restaurant', rs);

module.exports = router;
