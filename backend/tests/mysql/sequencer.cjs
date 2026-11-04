// Bu testler ortak hedefleri sırayla kurar; Jest'in "önce düşenler" sıralaması realAppFlows'u kurulmamış hedefle çalıştırır.
const Sequencer = require('@jest/test-sequencer').default;
module.exports = class extends Sequencer {
  sort(tests) { return [...tests].sort((a, b) => a.path.localeCompare(b.path)); }
};
