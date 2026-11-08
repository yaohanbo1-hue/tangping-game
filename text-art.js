// Cache the rasterized lettering, not the whole moving battlefield. Re-stroking
// dozens of scaled Chinese glyphs every frame is costly in software compositors.
const FloatingTextArt = (() => {
  const cache=new Map(),LIMIT=128,BYTES=8*1024*1024;
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
  const closing=/^[，。！？；：、）》】!?;:,.]$/u,MAX_LINES=6;
  let bytes=0,builds=0,hits=0;
  function layout(text,c,maxWidth) {
    const letters=segmenter?Array.from(segmenter.segment(text),part=>part.segment):Array.from(text),lines=[];
    let line=[];
    for(let i=0;i<letters.length;i++) {
      const letter=letters[i];
      if(letter==='\n') {lines.push(line.join(''));line=[];}
      else if(line.length && c.measureText(line.join('')+letter).width>maxWidth) {
        // Carry the preceding glyph with a closing mark instead of leaving a comma
        // or bracket orphaned at the start of the next Chinese line.
        if(closing.test(letter) && line.length>1){const carry=line.pop();lines.push(line.join(''));line=[carry,letter];}
        else {lines.push(line.join(''));line=[letter];}
      } else line.push(letter);
      if(lines.length===MAX_LINES-1 && i<letters.length-1) {
        const tail=[...line,...letters.slice(i+1)].map(s=>s==='\n'?' ':s);
        while(tail.length && c.measureText(tail.join('')+'…').width>maxWidth)tail.pop();
        lines.push(tail.join('')+'…');return lines;
      }
    }
    if(line.length || !lines.length)lines.push(line.join(''));
    return lines;
  }
  function plaque(c,width,height,color) {
    c.beginPath();c.moveTo(5,1);c.lineTo(width-5,1);c.lineTo(width-1,5);c.lineTo(width-1,height-5);
    c.lineTo(width-5,height-1);c.lineTo(5,height-1);c.lineTo(1,height-5);c.lineTo(1,5);c.closePath();
    c.fillStyle='rgba(7,22,30,.8)';c.fill();c.lineWidth=1;c.strokeStyle='rgba(195,178,129,.38)';c.stroke();
    c.fillStyle=color;c.fillRect(3,8,2,Math.max(4,height-16));
  }
  function sprite(text,color,big,quality,availableWidth) {
    text=String(text).replace(/\r\n?/g,'\n');
    const numeric=/^[+\-−]?\d[\d,.]*(?:K|M|B|T|Qa|Qi)?$/u.test(text),font=big?22:15,lineHeight=font+(big?8:5),padding=big?9:6;
    // Reserve the 1.75x pop from drawTexts without baking a new layout for every
    // animation scale. Only a different backing-canvas width changes this bucket.
    const maxWidth=Math.max(font,Math.min(big?360:280,Math.floor(((availableWidth-12)/1.8-padding*2)/32)*32));
    const key=JSON.stringify([text,color,big,quality,maxWidth]);
    if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);hits++;return value;}
    const image=document.createElement('canvas'),c=image.getContext('2d');
    const family=numeric?'ui-monospace,Consolas,monospace':'"Noto Sans SC","Microsoft YaHei",sans-serif',face='700 '+font+'px '+family;
    c.font=face;
    const lines=layout(text,c,maxWidth),event=big&&!numeric;
    const width=Math.ceil(Math.max(...lines.map(s=>c.measureText(s).width)))+padding*2,height=lines.length*lineHeight+padding*2,dpr=quality==='high'?2:quality==='low'?1:1.5;
    image.width=Math.ceil(width*dpr);image.height=Math.ceil(height*dpr);c.scale(dpr,dpr);
    c.font=face;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
    if(event)plaque(c,width,height,color);
    lines.forEach((line,i)=>{
      const x=width/2,y=padding+lineHeight*(i+.5);
      c.lineWidth=event?3:4;c.strokeStyle='#06121b';c.strokeText(line,x,y);
      if(quality==='high'){const gradient=c.createLinearGradient(0,y-font*.55,0,y+font*.4);gradient.addColorStop(0,'#fff5de');gradient.addColorStop(.25,color);gradient.addColorStop(1,color);c.fillStyle=gradient;}
      else c.fillStyle=color;
      c.fillText(line,x,y);
    });
    const value={image,width,height,keepInside:event||width>180,bytes:image.width*image.height*4};
    while(cache.size && (cache.size>=LIMIT || bytes+value.bytes>BYTES)){const first=cache.keys().next().value;bytes-=cache.get(first).bytes;cache.delete(first);}
    if(value.bytes<=BYTES){cache.set(key,value);bytes+=value.bytes;}builds++;return value;
  }
  return {
    draw(c,text,color,big,quality,bounds){
      const item=sprite(text,color,big,quality,c.canvas.width);let x=0,y=0;
      if(item.keepInside){
        const m=c.getTransform(),det=m.a*m.d-m.b*m.c;
        if(Math.abs(det)>1e-8){
          const hw=(Math.abs(m.a)*item.width+Math.abs(m.c)*item.height)/2,hh=(Math.abs(m.b)*item.width+Math.abs(m.d)*item.height)/2;
          const box=bounds||{left:0,top:0,right:c.canvas.width,bottom:c.canvas.height};
          const px=Math.min((box.right-box.left)/2,hw+5),py=Math.min((box.bottom-box.top)/2,hh+5);
          const dx=Math.max(box.left+px,Math.min(box.right-px,m.e))-m.e,dy=Math.max(box.top+py,Math.min(box.bottom-py,m.f))-m.f;
          x=(m.d*dx-m.c*dy)/det;y=(-m.b*dx+m.a*dy)/det;
        }
      }
      c.drawImage(item.image,x-item.width/2,y-item.height/2,item.width,item.height);
    },
    stats:()=>({entries:cache.size,bytes,builds,hits,limit:LIMIT,byteLimit:BYTES}),
  };
})();
