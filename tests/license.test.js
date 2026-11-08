const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const license=read('LICENSE'),notice=read('NOTICE'),legacy=read('LICENSES/MIT-legacy.txt');
assert.match(license,/Apache License[\s\S]+Version 2\.0, January 2004/);
for(const section of ['Grant of Copyright License','Grant of Patent License','Redistribution','Disclaimer of Warranty','END OF TERMS AND CONDITIONS'])assert.ok(license.includes(section),section+' is preserved in the full license');
assert.ok(notice.includes('Copyright 2026 yaohanbo1-hue')&&notice.includes('Apache License, Version 2.0'));
assert.ok(legacy.startsWith('MIT License')&&legacy.includes('Copyright (c) 2026 yaohanbo1-hue'));
assert.equal(JSON.parse(read('package.json')).license,'Apache-2.0');
for(const file of ['manifest','buildings','enemies','ui'])assert.ok(JSON.parse(read('assets/art/'+file+'.json')).source.license.startsWith('Apache-2.0'));
for(const file of ['index.html','shoudengren.html']){
  const text=read(file),header=text.slice(0,text.indexOf('<html'));
  assert.ok(header.includes('SPDX-License-Identifier: Apache-2.0'));
  assert.ok(header.includes(license.replace(/\r\n?/g,'\n'))&&header.includes(notice.replace(/\r\n?/g,'\n')),'standalone artifact retains full license and notices');
  assert.ok(header.includes('Historic MIT notice')&&header.includes('MIT License'),'historical attribution travels with standalone HTML');
  assert.ok(!text.includes('<!--LICENSE-->'));
}
console.log('Apache-2.0 metadata, full license, attribution and both standalone distributions passed');
