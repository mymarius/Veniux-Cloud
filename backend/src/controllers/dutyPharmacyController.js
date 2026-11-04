const dutyPharmacyService = require('../services/dutyPharmacyService');

const getStaff = async (req, res) => {
  try {
    const staff = await dutyPharmacyService.getStaffList(req.user.tenantId);
    res.status(200).json(staff);
  } catch (error) {
    console.error('Error in getStaff:', error);
    res.status(500).json({ error: 'Nöbetçi personel listesi getirilemedi.' });
  }
};

const addStaff = async (req, res) => {
  try {
    const newStaff = await dutyPharmacyService.addStaff(req.body, req.user.tenantId);
    res.status(201).json(newStaff);
  } catch (error) {
    console.error('Error in addStaff:', error);
    res.status(500).json({ error: 'Personel eklenemedi.' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedStaff = await dutyPharmacyService.updateStaff(id, req.body, req.user.tenantId);
    if (!updatedStaff) {
      return res.status(404).json({ error: 'Personel bulunamadı.' });
    }
    res.status(200).json(updatedStaff);
  } catch (error) {
    console.error('Error in updateStaff:', error);
    res.status(500).json({ error: 'Personel güncellenemedi.' });
  }
};

const getDutySchedule = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Ay ve yıl bilgisi gereklidir.' });
    }
    const schedule = await dutyPharmacyService.getDutySchedule(month, year, req.user.tenantId);
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error in getDutySchedule:', error);
    res.status(500).json({ error: 'Nöbet takvimi getirilemedi.' });
  }
};

const createDutyEntry = async (req, res) => {
  try {
    const newEntry = await dutyPharmacyService.createDutyEntry(req.body, req.user.tenantId);
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('Error in createDutyEntry:', error);
    res.status(500).json({ error: 'Nöbet kaydı oluşturulamadı.' });
  }
};

const deleteDutyEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEntry = await dutyPharmacyService.deleteDutyEntry(id, req.user.tenantId);
    if (!deletedEntry) {
      return res.status(404).json({ error: 'Nöbet kaydı bulunamadı.' });
    }
    res.status(200).json({ message: 'Nöbet kaydı silindi.' });
  } catch (error) {
    console.error('Error in deleteDutyEntry:', error);
    res.status(500).json({ error: 'Nöbet kaydı silinemedi.' });
  }
};

const getDutySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Ay ve yıl bilgisi gereklidir.' });
    }
    const summary = await dutyPharmacyService.getMonthlyDutySummary(month, year, req.user.tenantId);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error in getDutySummary:', error);
    res.status(500).json({ error: 'Nöbet özeti getirilemedi.' });
  }
};

module.exports = {
  getStaff,
  addStaff,
  updateStaff,
  getDutySchedule,
  createDutyEntry,
  deleteDutyEntry,
  getDutySummary
};
