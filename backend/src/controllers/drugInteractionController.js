const drugInteractionService = require('../services/drugInteractionService');

class DrugInteractionController {
  async checkInteractions(req, res) {
    try {
      const { atc_codes } = req.body;
      if (!Array.isArray(atc_codes)) {
        return res.status(400).json({ error: 'atc_codes array is required' });
      }
      
      const result = await drugInteractionService.checkInteractions(atc_codes);
      res.json(result);
    } catch (error) {
      console.error('Check Interactions Error:', error);
      res.status(500).json({ error: 'Etkileşim kontrolü sırasında bir hata oluştu' });
    }
  }

  async checkPatientInteractions(req, res) {
    try {
      const { patientId } = req.params;
      const { atc_code } = req.query;
      
      if (!patientId || !atc_code) {
        return res.status(400).json({ error: 'patientId parameter and atc_code query are required' });
      }
      
      const interactions = await drugInteractionService.checkPatientInteractions(patientId, atc_code);
      res.json(interactions);
    } catch (error) {
      console.error('Check Patient Interactions Error:', error);
      res.status(500).json({ error: 'Hasta etkileşim kontrolü sırasında bir hata oluştu' });
    }
  }

  async getInteractionRules(req, res) {
    try {
      const rules = await drugInteractionService.getAllInteractions();
      res.json(rules);
    } catch (error) {
      console.error('Get Interaction Rules Error:', error);
      res.status(500).json({ error: 'Etkileşim kuralları alınırken bir hata oluştu' });
    }
  }

  async addInteractionRule(req, res) {
    try {
      const ruleData = req.body;
      if (!ruleData.atc_code_1 || !ruleData.atc_code_2 || !ruleData.interaction_level) {
        return res.status(400).json({ error: 'Gerekli alanlar eksik' });
      }
      
      const newRule = await drugInteractionService.addInteractionRule(ruleData);
      res.status(201).json(newRule);
    } catch (error) {
      console.error('Add Interaction Rule Error:', error);
      res.status(500).json({ error: 'Kural eklenirken bir hata oluştu' });
    }
  }
}

module.exports = new DrugInteractionController();
