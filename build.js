const fs = require('fs');
const path = require('path');
const files = ['story.js', 'data.js', 'names.js', 'core.js', 'dream.js', 'render.js', 'ui.js', 'main.js'];
const js = files.map(f => '/* ==== ' + f + ' ==== */\n' + fs.readFileSync(f, 'utf8')).join('\n');
const out = fs.readFileSync('shell.html', 'utf8').replace('<!--SCRIPT-->', '<script>\n' + js + '\n</script>');
const outPath = path.join(__dirname, 'tangping.html');
fs.writeFileSync(outPath, out);

// GitHub Pages 根路径需要 index.html，与其内容保持一致
const indexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(indexPath, out);

console.log('构建完成:', Math.round(out.length / 1024) + 'KB');
console.log('输出:', outPath);
console.log('输出:', indexPath);