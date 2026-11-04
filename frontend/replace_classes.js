const fs = require('fs');
const path = require('path');

const dir = './src';

function processDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
        const fullPath = path.join(currentPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Backgrounds
            content = content.replace(/bg-\[\#0F172A\]/g, 'bg-surface');
            content = content.replace(/bg-\[\#080C14\]/g, 'bg-bg'); // darker bg
            
            // Borders
            content = content.replace(/border-slate-800\/80/g, 'border-border');
            content = content.replace(/border-slate-800/g, 'border-border');
            content = content.replace(/border-slate-700/g, 'border-border-hover');
            
            // Texts
            content = content.replace(/text-slate-100/g, 'text-text');
            content = content.replace(/text-slate-200/g, 'text-text');
            content = content.replace(/text-slate-300/g, 'text-text-muted');
            content = content.replace(/text-slate-400/g, 'text-text-muted');
            content = content.replace(/text-slate-500/g, 'text-text-muted');
            content = content.replace(/text-white/g, 'text-text'); // This might break explicit white text on colored buttons!
            
            fs.writeFileSync(fullPath, content);
        }
    }
}

processDir(dir);
console.log('Done replacing classes');
