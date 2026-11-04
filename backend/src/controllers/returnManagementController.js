const returnManagementService = require('../services/returnManagementService');

const createReturn = async (req, res) => {
  try {
    const newReturn = await returnManagementService.createReturn({...req.body,tenant_id:req.user.tenantId});
    res.status(201).json(newReturn);
  } catch (error) {
    console.error('Error in createReturn:', error);
    res.status(500).json({ error: 'İade kaydı oluşturulamadı.' });
  }
};

const getReturns = async (req, res) => {
  try {
    const returns = await returnManagementService.getReturns({...req.query,tenant_id:req.user.tenantId});
    res.status(200).json(returns);
  } catch (error) {
    console.error('Error in getReturns:', error);
    res.status(500).json({ error: 'İadeler getirilemedi.' });
  }
};

const getReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const returnRecord = await returnManagementService.getReturnById(id,req.user.tenantId);
    if (!returnRecord) {
      return res.status(404).json({ error: 'İade kaydı bulunamadı.' });
    }
    res.status(200).json(returnRecord);
  } catch (error) {
    console.error('Error in getReturnById:', error);
    res.status(500).json({ error: 'İade detayı getirilemedi.' });
  }
};

const updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, credit_note_no, credit_amount } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Durum (status) bilgisi gereklidir.' });
    }
    
    const updatedReturn = await returnManagementService.updateReturnStatus(id, status, { credit_note_no, credit_amount },req.user.tenantId);
    res.status(200).json(updatedReturn);
  } catch (error) {
    console.error('Error in updateReturnStatus:', error);
    res.status(500).json({ error: 'İade durumu güncellenemedi.' });
  }
};

const getReturnSummary = async (req, res) => {
  try {
    const summary = await returnManagementService.getReturnSummary(req.user.tenantId);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error in getReturnSummary:', error);
    res.status(500).json({ error: 'İade özeti getirilemedi.' });
  }
};

module.exports = {
  createReturn,
  getReturns,
  getReturnById,
  updateReturnStatus,
  getReturnSummary
};
