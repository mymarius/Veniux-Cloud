const { BaseMedicineProvider } = require('./BaseMedicineProvider');

// Yönetici tarafından elle eklenen kayıtların kaynağı. Dışarıdan veri çekmez;
// senkronizasyon bu kayıtları hiçbir zaman güncellemez veya pasife almaz.
class ManualProvider extends BaseMedicineProvider {
  static key = 'manual';
  static label = 'Manuel kayıt';
  static description = 'Yönetici panelinden elle eklenen ilaçlar.';

  async status() { return { available: true, message: 'Elle eklenen kayıtlar; senkronizasyon gerektirmez.' }; }

  async *fetchBatches() { /* dış kaynak yok */ }
}

module.exports = ManualProvider;
