const fs = require('fs');
const path = require('path');
const files = ['story.js', 'data.js', 'names.js', 'core.js', 'save.js', 'net.js', 'dream.js', 'quest.js', 'render.js', 'ui.js', 'main.js'];
const js = files.map(f => '/* ==== ' + f + ' ==== */\n' + fs.readFileSync(f, 'utf8')).join('\n');
const version = fs.readFileSync('VERSION', 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('VERSION must use MAJOR.MINOR.PATCH format');
const shell = fs.readFileSync('shell.html', 'utf8');
if (!shell.includes('<!--VERSION-->') || !shell.includes('<!--SCRIPT-->')) throw new Error('shell.html is missing a build placeholder');
const out = shell.replace('<!--VERSION-->', version).replace('<!--SCRIPT-->', '<script>\n' + js + '\n</script>');
const outPath = path.join(__dirname, 'tangping.html');
fs.writeFileSync(outPath, out);

// GitHub Pages 根路径需要 index.html，与其内容保持一致
const indexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(indexPath, out);

console.log('构建完成:', Math.round(out.length / 1024) + 'KB');
console.log('输出:', outPath);
console.log('输出:', indexPath);
