import { build } from 'esbuild';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { deflateSync } from 'node:zlib';

const dir = await mkdtemp(join(tmpdir(),'rf-'));
const entry = join(dir,'e.ts');
await writeFile(entry, `export { SimulationEngine } from ${JSON.stringify(process.cwd()+'/src/sim/engine.ts')};
export { blendScent, scentAura } from ${JSON.stringify(process.cwd()+'/src/sim/palette.ts')};`);
const outfile = join(dir,'b.mjs');
await build({entryPoints:[entry],bundle:true,format:'esm',platform:'neutral',outfile,logLevel:'silent'});
const { SimulationEngine, blendScent, scentAura } = await import(outfile);

const E = new SimulationEngine({ worldWidth: 795, worldHeight: 1720, maxPopulation: 600, brushRadius: 31 });
E.loadPreset('double_bridge');
for (let s=0;s<3600;s++) E.step(1/60);

const W = E.gridWidth, H = E.gridHeight, S = 3; // supersample
const px = Buffer.alloc((W*S)*(H*S)*3);
const put = (x,y,r,g,b) => { const o=(y*W*S+x)*3; px[o]=r; px[o+1]=g; px[o+2]=b; };
const add = (x,y,r,g,b,a) => { const o=(y*W*S+x)*3; px[o]=Math.min(255,px[o]+r*a); px[o+1]=Math.min(255,px[o+1]+g*a); px[o+2]=Math.min(255,px[o+2]+b*a); };

for (let y=0;y<H;y++) for (let x=0;x<W;x++){
  const i=y*W+x;
  const wall=E.wallGrid[i]===1;
  const baseR=wall?18:3, baseG=wall?25:6, baseB=wall?38:12;
  for (let sy=0;sy<S;sy++) for (let sx=0;sx<S;sx++){
    const o=((y*S+sy)*W*S + (x*S+sx))*3;
    px[o]=baseR; px[o+1]=baseG; px[o+2]=baseB;
  }
  const f=E.foodTrail[i], h=E.homeGuide[i], al=E.alarm[i];
  if (f+h+al < 0.25) continue;
  const au=scentAura(f,h);
  const c=blendScent(f,h,al,false);
  for (let sy=0;sy<S;sy++) for (let sx=0;sx<S;sx++){
    add(x*S+sx, y*S+sy, au.r,au.g,au.b, au.a/255*0.55);
    add(x*S+sx, y*S+sy, c.r,c.g,c.b, c.a/255);
  }
}
// ants
for (let i=0;i<E.activeCount;i++){
  const gx=Math.floor(E.x[i]/6), gy=Math.floor(E.y[i]/6);
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
    const X=gx*S+S/2+dx, Y=gy*S+S/2+dy;
    if (X<0||Y<0||X>=W*S||Y>=H*S) continue;
    const o=(Y*W*S+X)*3;
    px[o]=Math.min(255,px[o]+210); px[o+1]=Math.min(255,px[o+1]+180); px[o+2]=Math.min(255,px[o+2]+120);
  }
}

// minimal PNG encoder
const Wpx=W*S, Hpx=H*S;
const raw=Buffer.alloc((Wpx*3+1)*Hpx);
for (let y=0;y<Hpx;y++){ raw[y*(Wpx*3+1)]=0; px.copy(raw, y*(Wpx*3+1)+1, y*Wpx*3, (y+1)*Wpx*3); }
const crcTable=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
const crc=(buf)=>{let c=-1;for(const b of buf)c=crcTable[(c^b)&0xff]^(c>>>8);return (c^-1)>>>0;};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc(td));return Buffer.concat([len,td,cr]);};
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(Wpx,0); ihdr.writeUInt32BE(Hpx,4); ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ihdr), chunk('IDAT',deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]);
const out=process.argv[2]||'../dist/scent-field.png';
await writeFile(out,png);
console.log('wrote',out, png.length,'B', Wpx+'x'+Hpx, 'famine',E.famine.toFixed(2),'pop',E.activeCount);
