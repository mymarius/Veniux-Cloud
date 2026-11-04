const pool = require('../config/database');

/**
 * TEB (Türk Eczacıları Birliği) Majistral Fiyat Tarifesi & Laboratuvar Hesaplayıcı
 */

// TEB 2026 Standart Laboratuvar İşçilik Katsayıları (TL)
const TEB_LABOR_RATES = {
  merhem: 65.00,       // Pomad, Merhem, Pasta
  solusyon: 45.00,     // Haricen / Dahilen Solüsyonlar
  damla: 50.00,        // Kulak, Burun, Göz Damlası
  kase: 85.00,         // Toz, Kaşe, Kapsül Hazırlama
  supozituvar: 110.00, // Fitil / Ovül
  emulsiyon: 70.00     // Emülsiyon ve Süspansiyon
};

// Calculate Majistral Price according to TEB Tariff
const calculateMajistralPrice = async (req, res) => {
  try {
    const {
      preparation_type = 'merhem',
      ingredients = [], // [{ name: 'Salisilik Asit', amount: 5, unit: 'g', unit_price_per_gram: 4.50 }, ...]
      packaging_type = 'cam_sise_50ml',
      packaging_cost = 18.00,
      custom_labor = null
    } = req.body;

    // 1. Calculate raw materials cost
    let rawMaterialsCost = 0;
    const detailedIngredients = ingredients.map(ing => {
      const amount = parseFloat(ing.amount) || 0;
      const unitPrice = parseFloat(ing.unit_price) || parseFloat(ing.unit_price_per_gram) || 0;
      const totalIngCost = amount * unitPrice;
      rawMaterialsCost += totalIngCost;
      return {
        ...ing,
        amount,
        unitPrice,
        totalIngCost: parseFloat(totalIngCost.toFixed(2))
      };
    });

    // 2. Determine labor cost from TEB Tariff
    const prepTypeKey = (preparation_type || 'merhem').toLowerCase();
    const laborCost = custom_labor !== null ? parseFloat(custom_labor) : (TEB_LABOR_RATES[prepTypeKey] || 50.00);

    // 3. Packaging cost
    const packCost = parseFloat(packaging_cost) || 15.00;

    // 4. Subtotal & Pharmacist Profit (TEB %25 margin)
    const baseCost = rawMaterialsCost + packCost + laborCost;
    const pharmacistProfit = baseCost * 0.25; // %25 Eczacı Kârı
    const preTaxTotal = baseCost + pharmacistProfit;

    // 5. VAT / KDV (%10)
    const kdvRate = 10;
    const kdvAmount = preTaxTotal * 0.10;
    const finalPrice = preTaxTotal + kdvAmount;

    res.json({
      preparation_type,
      ingredients: detailedIngredients,
      raw_materials_cost: parseFloat(rawMaterialsCost.toFixed(2)),
      labor_cost: parseFloat(laborCost.toFixed(2)),
      packaging_cost: parseFloat(packCost.toFixed(2)),
      pharmacist_profit: parseFloat(pharmacistProfit.toFixed(2)),
      pre_tax_total: parseFloat(preTaxTotal.toFixed(2)),
      kdv_rate: kdvRate,
      kdv_amount: parseFloat(kdvAmount.toFixed(2)),
      final_price: parseFloat(finalPrice.toFixed(2))
    });
  } catch (error) {
    console.error('Calculate majistral price error:', error);
    res.status(500).json({ error: 'Majistral fiyat hesaplanamadı.' });
  }
};

// Save a formula
const saveMajistralFormula = async (req, res) => {
  try {
    const {
      formula_name,
      preparation_type = 'merhem',
      ingredients = [],
      packaging_cost = 0,
      labor_cost = 0,
      total_price,
      pharmacist_notes
    } = req.body;

    if (!formula_name || !total_price) {
      return res.status(400).json({ error: 'Formül adı ve toplam fiyat zorunludur.' });
    }

    const result = await pool.query(`
      INSERT INTO majistral_formulas (
        tenant_id, formula_name, preparation_type, ingredients_json,
        packaging_cost, labor_cost, total_price, pharmacist_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      req.user.tenantId,
      formula_name.trim(),
      preparation_type,
      JSON.stringify(ingredients),
      parseFloat(packaging_cost) || 0,
      parseFloat(labor_cost) || 0,
      parseFloat(total_price) || 0,
      pharmacist_notes || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Save majistral formula error:', error);
    res.status(500).json({ error: 'Majistral formül kaydedilemedi.' });
  }
};

// Get saved formulas
const getMajistralFormulas = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM majistral_formulas WHERE tenant_id = $1 ORDER BY created_at DESC', [req.user.tenantId]);
    const parsed = result.rows.map(r => {
      let ingredients = [];
      try {
        ingredients = JSON.parse(r.ingredients_json || '[]');
      } catch (e) {}
      return {
        ...r,
        ingredients
      };
    });
    res.json(parsed);
  } catch (error) {
    console.error('Get majistral formulas error:', error);
    res.status(500).json({ error: 'Formüller listelenemedi.' });
  }
};

module.exports = {
  calculateMajistralPrice,
  saveMajistralFormula,
  getMajistralFormulas
};
