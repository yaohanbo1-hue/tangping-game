require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto('file:///'+path.join(root,'index.html').replace(/\\/g,'/'));
    const result=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=180;
      const c=canvas.getContext('2d');c.translate(300,90);
      const random=Math.random;Math.random=()=>{throw Error('text renderer consumed combat RNG');};
      try{
        for(const quality of ['low','medium','high'])for(let i=0;i<160;i++)FloatingTextArt.draw(c,'元素反应 '+i,'#ffd166',i%2===0,quality);
        const bounded=FloatingTextArt.stats();
        FloatingTextArt.draw(c,'护盾破碎 1/3','#d6d3d1',true,'high');const warm=FloatingTextArt.stats();
        for(let i=0;i<40;i++)FloatingTextArt.draw(c,'护盾破碎 1/3','#d6d3d1',true,'high');
        const visible=c.getImageData(0,0,600,180).data.some((v,i)=>i%4===3 && v>0),hot=FloatingTextArt.stats();
        const arena=document.createElement('canvas');arena.width=1280;arena.height=720;const a=arena.getContext('2d'),edges=[];
        for(const quality of ['low','high']){
          a.resetTransform();a.clearRect(0,0,1280,720);a.translate(2,-60);a.scale(1.75,1.75);
          FloatingTextArt.draw(a,'阶段突破：请保持铁门完整，及时使用控制技能。👩🏽‍🚀'.repeat(8),'#ffd166',true,quality,{left:0,top:66,right:1280,bottom:556});
          const pixels=a.getImageData(0,0,1280,720).data;let minX=1280,minY=720,maxX=0,maxY=0;
          for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0){const n=(i-3)/4,x=n%1280,y=Math.floor(n/1280);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
          edges.push({quality,minX,minY,maxX,maxY});
        }
        return {bounded,warm,hot,visible,edges};
      }finally{Math.random=random;}
    });
    assert.ok(result.bounded.entries<=128 && result.bounded.bytes<=8*1024*1024,'bounded texture memory');
    assert.equal(result.hot.builds,result.warm.builds,'warm text animation never rasterizes glyphs again');
    assert.equal(result.hot.hits-result.warm.hits,40);assert.ok(result.visible,'cached text actually draws pixels');
    for(const edge of result.edges)assert.ok(edge.minY>=66&&edge.maxY<556&&edge.minX>=0&&edge.maxX<1280,'long scaled event remains inside the phone-visible battlefield: '+JSON.stringify(edge));
    console.log('Floating text: bounded cache, visible glyphs, warm reuse and RNG isolation passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
