const fs = require('fs');
const path = require('path');
// One canonical output on Windows/Linux, including when invoked outside the repo.
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n?/g, '\n');
const files = ['story.js', 'data.js', 'names.js', 'balance.js', 'combat.js', 'enemy-actions.js', 'core.js', 'campaign.js', 'save.js', 'net.js', 'dream.js', 'quest.js', 'scene-art.js', 'building-art.js', 'render.js', 'ui.js', 'main.js'];
const js = files.map(f => '/* ==== ' + f + ' ==== */\n' + read(f)).join('\n');
const version = read('VERSION').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('VERSION must use MAJOR.MINOR.PATCH format');
const shell = read('shell.html');
if (!shell.includes('<!--VERSION-->') || !shell.includes('<!--SCRIPT-->')) throw new Error('shell.html is missing a build placeholder');
const out = shell.replace('<!--VERSION-->', version).replace('<!--SCRIPT-->', '<script>\n' + js + '\n</script>');
const outPath = path.join(__dirname, 'shoudengren.html');
fs.writeFileSync(outPath, out);

// GitHub Pages 根路径需要 index.html，与其内容保持一致
const indexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(indexPath, out);

console.log('构建完成:', Math.round(out.length / 1024) + 'KB');
console.log('输出:', outPath);
console.log('输出:', indexPath);
