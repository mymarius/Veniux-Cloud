import {defineConfig} from '../frontend/node_modules/vite/dist/node/index.js';
import tailwind from '../frontend/node_modules/@tailwindcss/vite/dist/index.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root,publicDir:false,plugins:[tailwind()],resolve:{alias:{sass:path.resolve(root,'../frontend/node_modules/sass')}},build:{outDir:'public/assets',emptyOutDir:false,lib:{entry:path.join(root,'src/panel.js'),formats:['es'],fileName:()=> 'panel.js',cssFileName:'panel'},cssCodeSplit:false}});
