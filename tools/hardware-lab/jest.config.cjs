const path=require('node:path');
module.exports={...require('../../backend/jest.config.js'),rootDir:path.resolve(__dirname,'../../backend'),testMatch:['**/tests/**/*.test.js','**/tests/hardwareLab.proof.cjs'],testTimeout:30000};
