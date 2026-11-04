// Keep the exact installed production dependency tree, including native binaries.
const fs = require('fs');
const path = require('path');

function copyProductionDependencies(backend, destination) {
  const lock = JSON.parse(fs.readFileSync(path.join(backend, 'package-lock.json'), 'utf8'));
  if (!lock.packages) throw Error('Production packaging requires a package lock with package entries.');
  const source = path.join(backend, 'node_modules');
  const excluded = Object.entries(lock.packages)
    .filter(([name, entry]) => name.startsWith('node_modules/') && entry.dev === true)
    .map(([name]) => path.resolve(backend, name));
  fs.cpSync(source, destination, {
    recursive: true,
    filter(file) {
      if (['.cache', '.bin'].includes(path.basename(file))) return false;
      return !excluded.some(directory => file === directory || file.startsWith(directory + path.sep));
    },
  });
}

module.exports = { copyProductionDependencies };
