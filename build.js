const fs = require('fs');
const path = require('path');
// One canonical output on Windows/Linux, including when invoked outside the repo.
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n?/g, '\n');
const files = ['story.js', 'data.js', 'names.js', 'balance.js', 'combat.js', 'enemy-actions.js', 'presentation.js', 'audio.js', 'telemetry.js', 'boss-encounters.js', 'lottery-rewards.js', 'core.js', 'campaign.js', 'save.js', 'net.js', 'dream.js', 'quest.js', 'night-watch.js', 'hidden-secrets.js', 'scene-art.js', 'building-art.js', 'enemy-art.js', 'ui-art.js', 'text-art.js', 'render.js', 'ui.js', 'mobile-controls.js', 'watch-ui.js', 'main.js'];
const js = files.map(f => '/* ==== ' + f + ' ==== */\n' + read(f)).join('\n');
const version = read('VERSION').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('VERSION must use MAJOR.MINOR.PATCH format');
const metadata = JSON.parse(read('package.json'));
if (metadata.version !== version) throw new Error('package.json version must match VERSION');
if (metadata.license !== 'Apache-2.0') throw new Error('package.json license must be Apache-2.0');
const shell = read('shell.html');
if (['<!--LICENSE-->','<!--THEME-->','<!--VERSION-->','<!--SCRIPT-->'].some(marker => !shell.includes(marker))) throw new Error('shell.html is missing a build placeholder');
const license='<!--\nSPDX-License-Identifier: Apache-2.0\n'+read('LICENSE')+'\nNOTICE\n'+read('NOTICE')+'\nHistoric MIT notice\n'+read('LICENSES/MIT-legacy.txt')+'\n-->';
// Replacement strings interpret $&, $` and $' inside ordinary source text.
// Functions insert exact bytes, including regular expressions and quotations.
const out = shell.replace('<!--LICENSE-->', () => license).replace('<!--THEME-->', () => read('theme.css')+'\n'+read('mobile.css')+'\n'+read('watch-ui.css')).replace('<!--VERSION-->', () => version).replace('<!--SCRIPT-->', () => '<script>\n' + js + '\n</script>');
const outPath = path.join(__dirname, 'shoudengren.html');
fs.writeFileSync(outPath, out);

// GitHub Pages 根路径需要 index.html，与其内容保持一致
const indexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(indexPath, out);

console.log('构建完成:', Math.round(Buffer.byteLength(out,'utf8') / 1024) + 'KiB');
console.log('输出:', outPath);
console.log('输出:', indexPath);
