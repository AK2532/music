const fs = require('fs');
const path = require('path');

const replacements = {
  'var(--ink-obsidian)': 'var(--text-main)',
  'var(--ink-charcoal)': 'var(--text-muted)',
  'var(--ink-stone)': 'var(--text-faint)',
  'var(--bg-alabaster)': 'var(--bg-main)',
  'var(--bg-sandstone)': 'var(--bg-main)',
  'var(--accent-terracotta)': 'var(--text-main)',
  'var(--accent-sage)': 'var(--text-muted)',
  'rgba(28,26,23,0.9)': 'rgba(0,0,0,0.9)',
  'rgba(28,26,23,0.3)': 'rgba(0,0,0,0.5)',
  'rgba(28, 26, 23, 0.15)': 'rgba(255, 255, 255, 0.15)'
};

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [oldStr, newStr] of Object.entries(replacements)) {
        if (content.includes(oldStr)) {
          content = content.split(oldStr).join(newStr);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

walk('./src');
