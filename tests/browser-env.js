// Keep browser profiles on the same writable volume as this task's artifacts.
// This only changes child test processes; it does not alter user OS settings.
const fs=require('node:fs'),path=require('node:path');
const artifacts=path.join(__dirname,'..','artifacts');fs.mkdirSync(artifacts,{recursive:true});
const temp=path.join(fs.realpathSync(artifacts),'browser-temp');fs.mkdirSync(temp,{recursive:true});
process.env.TEMP=temp;process.env.TMP=temp;process.env.TMPDIR=temp;
