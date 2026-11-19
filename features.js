/* Roma 315 – Markierungen, Kompass, Fußwege-Routing */
(function(){
const R=window.R2D,H=R.hooks;const $=id=>document.getElementById(id);
const esc=R.esc;

/* ---------- Klick-Modi (Markierung setzen, Start/Ziel wählen) ---------- */
let mode=null;const hint=$('modeHint');
function closeMobile(){const p=$('panel');if(window.innerWidth<=520&&!p.classList.contains('collapsed'))$('collapse').click();}
function setMode(m,text){mode=m;if(m)closeMobile();hint.hidden=!m;$('modeHintT').textContent=text||'';
  $('mAdd').setAttribute('aria-pressed',String(m==='marker'));$('rFromPick').setAttribute('aria-pressed',String(m==='from'));$('rToPick').setAttribute('aria-pressed',String(m==='to'));}
$('modeHintX').onclick=()=>setMode(null);
H.click=(x,y)=>{if(!mode)return false;const m=mode;setMode(null);
  if(m==='marker')openDlg({x,y});
  else{const lab=nearestLabel(x,y);setPoint(m==='from'?'from':'to',{x,y,label:lab});}
  return true;};

/* ---------- Markierungen ---------- */
const KEY='roma315.markers.v1';let markers=[];
try{markers=JSON.parse(localStorage.getItem(KEY)||'[]')||[];}catch(e){markers=[];}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(markers));}catch(e){}};
let editing=null;
function openDlg(m){editing=m;$('mdName').value=m.name||'';$('mdNote').value=m.note||'';$('markDlg').hidden=false;setTimeout(()=>$('mdName').focus(),30);}
$('mdCancel').onclick=()=>{$('markDlg').hidden=true;editing=null;};
$('markDlg').addEventListener('submit',e=>{e.preventDefault();if(!editing)return;const name=$('mdName').value.trim();if(!name)return;
  editing.name=name;editing.note=$('mdNote').value.trim();if(!editing.id){editing.id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);markers.push(editing);}
  save();$('markDlg').hidden=true;editing=null;renderMarkers();});
$('mAdd').onclick=()=>{if(mode==='marker')return setMode(null);setMode('marker','Tippe auf die Stelle, an der die Markierung sitzen soll.');};
function renderMarkers(){const ul=$('mList');ul.innerHTML='';$('mCount').textContent=markers.length?`(${markers.length})`:'';
  for(const m of markers){const li=document.createElement('li');li.innerHTML=`<span class="dot"></span><span class="mn" title="${esc(m.note||'')}">${esc(m.name)}</span><button type="button" data-a="route" title="Route hierhin">Route</button><button type="button" data-a="edit" title="Umbenennen">✎</button><button type="button" data-a="del" title="Löschen" aria-label="Markierung ${esc(m.name)} löschen">✕</button>`;
    li.querySelector('.mn').onclick=()=>goTo([m.x-80,m.y-80,m.x+80,m.y+80]);
    li.querySelector('[data-a=route]').onclick=()=>routeTo({x:m.x,y:m.y,label:m.name});
    li.querySelector('[data-a=edit]').onclick=()=>openDlg(m);
    li.querySelector('[data-a=del]').onclick=()=>{if(li.dataset.c!=='1'){li.dataset.c='1';li.querySelector('[data-a=del]').textContent='Sicher?';setTimeout(()=>{if(li.isConnected){li.dataset.c='';li.querySelector('[data-a=del]').textContent='✕';}},3000);return;}
      markers=markers.filter(q=>q!==m);save();renderMarkers();};
    ul.appendChild(li);}
  updateNames();if(window.R3D&&R3D.setMarkers)R3D.setMarkers(markers);R.req();}
$('mExport').onclick=async()=>{const t=JSON.stringify(markers.map(m=>{const [lat,lon]=toLL(m.x,m.y);return {name:m.name,note:m.note||'',lat:+lat.toFixed(6),lon:+lon.toFixed(6)};}));
  const ta=$('mText');ta.hidden=false;ta.value=t;ta.select();try{await navigator.clipboard.writeText(t);$('msg').textContent='Markierungen in die Zwischenablage kopiert.';}catch(e){$('msg').textContent='Text unten markieren und kopieren.';}};
$('mImport').onclick=()=>{const ta=$('mText');if(ta.hidden||!ta.value.trim()){ta.hidden=false;ta.value='';ta.placeholder='Kopierte Liste hier einfügen, dann nochmal „Liste einfügen“ drücken';ta.focus();return;}
  try{const arr=JSON.parse(ta.value);let n=0;for(const q of arr){if(!q.name||typeof q.lat!=='number')continue;const [x,y]=R.ll2m(q.lat,q.lon);if(markers.some(m=>m.name===q.name&&Math.hypot(m.x-x,m.y-y)<2))continue;markers.push({id:Date.now().toString(36)+n,name:q.name,note:q.note||'',x,y});n++;}
    save();renderMarkers();$('msg').textContent=n+' Markierung(en) übernommen.';ta.hidden=true;ta.value='';}catch(e){$('msg').textContent='Das ist keine gültige Markierungsliste.';}};
const toLL=(x,y)=>[41.86+y/R.KY/1e5,12.44+x/R.KX/1e5];

/* ---------- Zeichnen in 2D ---------- */
let route=null;
H.draw.push(ctx=>{
  // route
  if(route){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';const p=new Path2D();route.pts.forEach((q,i)=>{const s=R.w2s(q[0],q[1]);i?p.lineTo(s[0],s[1]):p.moveTo(s[0],s[1]);});
    ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=10;ctx.stroke(p);ctx.strokeStyle='#1b5fd1';ctx.lineWidth=6;ctx.stroke(p);
    if(route.hl){const h=new Path2D();route.hl.forEach((q,i)=>{const s=R.w2s(q[0],q[1]);i?h.lineTo(s[0],s[1]):h.moveTo(s[0],s[1]);});ctx.strokeStyle='#ffd23f';ctx.lineWidth=4;ctx.stroke(h);}
    ctx.restore();}
  for(const k of ['from','to']){const P=pts[k];if(!P)continue;const [sx,sy]=R.w2s(P.x,P.y);ctx.beginPath();ctx.arc(sx,sy,9,0,7);ctx.fillStyle=k==='from'?'#2e8540':'#c62a1f';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#fff';ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='700 11px "IBM Plex Sans", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(k==='from'?'A':'B',sx,sy+0.5);}
  if(NAV.on){const me=R.getMe();if(me){const [sx,sy]=R.w2s(me.x,me.y);const h=NAV.heading||0;ctx.save();ctx.translate(sx,sy);ctx.beginPath();ctx.arc(0,0,13,0,7);ctx.fillStyle='rgba(27,95,209,.18)';ctx.fill();ctx.rotate(-h);
    ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,8);ctx.lineTo(-4,0);ctx.lineTo(-8,-8);ctx.closePath();ctx.fillStyle='#1b5fd1';ctx.fill();ctx.lineWidth=2.2;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}}
  // markers (pins)
  for(const m of markers){const [sx,sy]=R.w2s(m.x,m.y);ctx.save();ctx.translate(sx,sy);
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-3,-7,-10,-12,-10,-20);ctx.arc(0,-20,10,Math.PI,0);ctx.bezierCurveTo(10,-12,3,-7,0,0);ctx.closePath();
    ctx.fillStyle='#7b2fbf';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();ctx.beginPath();ctx.arc(0,-20,3.5,0,7);ctx.fillStyle='#fff';ctx.fill();
    ctx.font='700 12.5px "IBM Plex Sans", sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3.5;ctx.strokeStyle='#fff';ctx.strokeText(m.name,13,-20);ctx.fillStyle='#4b1677';ctx.fillText(m.name,13,-20);ctx.restore();}
});

/* ---------- Kompass ---------- */
const comp=$('compSvg');
function updCompass(){const a=(window.R3D&&R3D.active&&R3D.getAzimuth)?R3D.getAzimuth():0;comp.style.transform=`rotate(${a*180/Math.PI}deg)`;}
$('zcomp').onclick=()=>{if(window.R3D&&R3D.active){R3D.northUp();}else{$('msg').textContent='Die 2D-Karte ist immer genordet: oben ist Norden.';}};

/* ---------- Routing: Graph ---------- */
let G=null,gLoading=null;
function loadGraph(){if(G)return Promise.resolve(G);if(gLoading)return gLoading;
  gLoading=new Promise((res,rej)=>{const s=document.createElement('script');s.src='route.js';s.onload=()=>{try{G=buildGraph(window.ROUTEG);window.ROUTEG=null;res(G);}catch(e){rej(e);}};s.onerror=()=>rej(new Error('Wegenetz konnte nicht geladen werden'));document.head.appendChild(s);});return gLoading;}
function buildGraph(raw){const KX=R.KX,KY=R.KY;const nv=raw.N.split(',').map(Number);const n=nv.length/2;const X=new Float64Array(n),Y=new Float64Array(n);let a=0,b=0;
  for(let i=0;i<n;i++){a+=nv[2*i];b+=nv[2*i+1];Y[i]=a*KY;X[i]=b*KX;}
  const es=raw.E.split(';');const E=[];const adj=Array.from({length:n},()=>[]);
  for(const s of es){const v=s.split(',').map(Number);const u=v[0],w=v[1];const g=[[X[u],Y[u]]];let pa=Math.round(Y[u]/KY),pb=Math.round(X[u]/KX);
    for(let i=5;i<v.length;i+=2){pa+=v[i];pb+=v[i+1];g.push([pb*KX,pa*KY]);}g.push([X[w],Y[w]]);
    let len=0;for(let i=1;i<g.length;i++)len+=Math.hypot(g[i][0]-g[i-1][0],g[i][1]-g[i-1][1]);
    const e={u,w,name:v[2]>=0?raw.names[v[2]]:'',cls:v[3],fl:v[4],g,len};const id=E.length;E.push(e);adj[u].push(id);adj[w].push(id);}
  // segment grid
  const C=60,grid=new Map();E.forEach((e,id)=>{for(let i=1;i<e.g.length;i++){const p=e.g[i-1],q=e.g[i];const x0=Math.floor(Math.min(p[0],q[0])/C),x1=Math.floor(Math.max(p[0],q[0])/C),y0=Math.floor(Math.min(p[1],q[1])/C),y1=Math.floor(Math.max(p[1],q[1])/C);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=x+','+y;let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(id,i);}}});
  return {X,Y,E,adj,grid,C};}
const COST={1:1.2,2:1.1,3:1.0,4:0.95,5:1.0,6:1.25,7:1.05};
function snap(G,x,y){let best=null;for(let r=0;r<=5&&!best;r++){const cx=Math.floor(x/G.C),cy=Math.floor(y/G.C);
  for(let i=cx-r;i<=cx+r;i++)for(let j=cy-r;j<=cy+r;j++){if(r&&Math.abs(i-cx)<r&&Math.abs(j-cy)<r)continue;const l=G.grid.get(i+','+j);if(!l)continue;
    for(let k=0;k<l.length;k+=2){const e=G.E[l[k]],si=l[k+1];const p=e.g[si-1],q=e.g[si];const dx=q[0]-p[0],dy=q[1]-p[1];const L2=dx*dx+dy*dy||1;let t=((x-p[0])*dx+(y-p[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const px=p[0]+t*dx,py=p[1]+t*dy;const d=Math.hypot(x-px,y-py);
      if(!best||d<best.d)best={d,e:l[k],si,t,px,py};}}
  if(best&&r>=1&&best.d>r*G.C)best=best;}
  return best;}
// split helpers: geometry along edge from start node to snap point
function along(e,sn){const pre=e.g.slice(0,sn.si);pre.push([sn.px,sn.py]);const post=[[sn.px,sn.py]].concat(e.g.slice(sn.si));const l=g=>{let s=0;for(let i=1;i<g.length;i++)s+=Math.hypot(g[i][0]-g[i-1][0],g[i][1]-g[i-1][1]);return s;};return {pre,post,lpre:l(pre),lpost:l(post)};}
function astar(G,A,B){ // A,B snaps
  const n=G.X.length;const S=n,T=n+1;const dist=new Float64Array(n+2).fill(Infinity),prev=new Int32Array(n+2).fill(-1),pe=new Int32Array(n+2).fill(-1);
  const ea=G.E[A.e],eb=G.E[B.e],sa=along(ea,A),sb=along(eb,B);
  // virtual edges: -2 = from S along A edge, -3 = into T along B edge; store info
  const virt={};
  const heap=[];const push=(v,f)=>{heap.push([f,v]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const top=heap[0];const last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
  const hx=B.px,hy=B.py;const h=v=>Math.hypot(G.X[v]-hx,G.Y[v]-hy)*0.95;
  const c=COST[ea.cls]||1;
  dist[S]=0;
  // same edge shortcut
  let direct=null;if(A.e===B.e){const posA=sa.lpre,posB=sb.lpre;const g=posA<=posB?sliceEdge(ea,A,B):sliceEdge(ea,B,A).reverse();direct={len:Math.abs(posB-posA)*c,g};}
  const relax=(v,d,from,eid)=>{if(d<dist[v]){dist[v]=d;prev[v]=from;pe[v]=eid;push(v,d+(v<n?h(v):0));}};
  relax(ea.u,sa.lpre*c,S,-2);relax(ea.w,sa.lpost*c,S,-3);
  const cb=COST[eb.cls]||1;
  const done=new Uint8Array(n);
  while(heap.length){const [f,v]=pop();if(v===T)break;if(v>=n)continue;if(done[v])continue;done[v]=1;
    if(v===eb.u)relax(T,dist[v]+sb.lpre*cb,v,-4);if(v===eb.w)relax(T,dist[v]+sb.lpost*cb,v,-5);
    for(const id of G.adj[v]){const e=G.E[id];const u=e.u===v?e.w:e.u;relax(u,dist[v]+e.len*(COST[e.cls]||1),v,id);}}
  if(direct&&direct.len<=dist[T])return {pts:direct.g,legs:[{e:ea,g:direct.g}]};
  if(!isFinite(dist[T]))return null;
  // reconstruct
  const legs=[];let v=T;while(v!==S){const p=prev[v],id=pe[v];let g,e;
    if(id===-4){e=eb;g=sb.pre.slice();}else if(id===-5){e=eb;g=sb.post.slice().reverse();}
    else if(id===-2){e=ea;g=sa.pre.slice().reverse();}else if(id===-3){e=ea;g=sa.post.slice();}
    else{e=G.E[id];g=e.u===p?e.g.slice():e.g.slice().reverse();}
    legs.push({e,g});v=p;}
  legs.reverse();const pts=[];for(const l of legs){for(const q of l.g){const last=pts[pts.length-1];if(!last||Math.hypot(last[0]-q[0],last[1]-q[1])>0.01)pts.push(q);}}
  return {pts,legs};}
function sliceEdge(e,A,B){const g=[[A.px,A.py]];for(let i=A.si;i<B.si;i++)g.push(e.g[i]);g.push([B.px,B.py]);return g;}

/* ---------- Wegbeschreibung ---------- */
const UNN={4:'Fußgängerzone / Platz',5:'Fußweg',6:'Treppe',7:'Zufahrt',3:'Gasse',2:'Straße',1:'Hauptstraße'};
const bearing=(p,q)=>Math.atan2(q[1]-p[1],q[0]-p[0]);
const CARD=a=>{const d=((90-a*180/Math.PI)+360)%360;return ['Norden','Nordosten','Osten','Südosten','Süden','Südwesten','Westen','Nordwesten'][Math.round(d/45)%8];};
function turnText(d){const a=d*180/Math.PI;const s=Math.abs(a);if(s<22)return 'geradeaus weiter';const side=a>0?'links':'rechts';if(s<60)return 'leicht '+side+' halten';if(s<150)return side+' abbiegen';return 'wenden';}
const fmtD=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1).replace('.',',')+' km';
let ancPts=null;function ancList(){if(ancPts)return ancPts;ancPts=[];for(const a of R.anc){if(a.n&&!a.line&&a.area>400)ancPts.push({n:a.n,x:a.cen[0],y:a.cen[1],r:Math.sqrt(a.area/Math.PI)});}for(const r of R.rec){if(r.p)ancPts.push({n:r.n,x:r.cen[0],y:r.cen[1],r:Math.sqrt((r.area||400)/Math.PI),rec:/^gut/.test(r.acc||'')?0:1});}return ancPts;}
function passing(g){const out=[];for(const a of ancList()){for(const q of g){if(Math.hypot(q[0]-a.x,q[1]-a.y)<a.r+30){out.push(a);break;}}}return out;}
function instructions(res){const legs=res.legs;const groups=[];
  const near=(g)=>{const m=g[Math.floor(g.length/2)],m2=g[Math.max(0,Math.floor(g.length/2)-1)];const mx=(m[0]+m2[0])/2,my=(m[1]+m2[1])/2;let bs=null;const cx=Math.floor(mx/G.C),cy=Math.floor(my/G.C);
    for(let i=cx-1;i<=cx+1;i++)for(let j=cy-1;j<=cy+1;j++){const l=G.grid.get(i+','+j);if(!l)continue;for(let k=0;k<l.length;k+=2){const e=G.E[l[k]];if(!e.name||e.cls===5||e.cls===6)continue;const p=e.g[l[k+1]-1],q=e.g[l[k+1]];const dx=q[0]-p[0],dy=q[1]-p[1];const L2=dx*dx+dy*dy||1;let t=((mx-p[0])*dx+(my-p[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const d=Math.hypot(mx-p[0]-t*dx,my-p[1]-t*dy);if(!bs||d<bs.d)bs={d,n:e.name};}}
    return bs&&bs.d<25?bs.n:null;};
  for(const l of legs){const name=l.e.name||((l.e.cls===5||l.e.cls===4||l.e.cls===7)&&near(l.g))||UNN[l.e.cls]||'Weg';const last=groups[groups.length-1];let len=0;for(let i=1;i<l.g.length;i++)len+=Math.hypot(l.g[i][0]-l.g[i-1][0],l.g[i][1]-l.g[i-1][1]);
    if(last&&last.name===name){last.g=last.g.concat(l.g.slice(1));last.len+=len;}else groups.push({name,named:!!l.e.name,g:l.g.slice(),len,cls:l.e.cls});}
  // merge tiny unnamed bits
  for(let pass=0;pass<3;pass++){
    for(let i=groups.length-1;i>0;i--){if(groups[i].len<20){groups[i-1].g=groups[i-1].g.concat(groups[i].g.slice(1));groups[i-1].len+=groups[i].len;groups.splice(i,1);}}
    for(let i=1;i<groups.length;i++){if(groups[i].name===groups[i-1].name){groups[i-1].g=groups[i-1].g.concat(groups[i].g.slice(1));groups[i-1].len+=groups[i].len;groups.splice(i,1);i--;}}}
  if(groups.length>1&&groups[0].len<20){groups[1].g=groups[0].g.concat(groups[1].g.slice(1));groups[1].len+=groups[0].len;groups.shift();}
  const steps=[];const seen=new Set();
  groups.forEach((gr,i)=>{let txt,ang=0;const g=gr.g;
    if(i===0){const b=bearing(g[0],g[Math.min(g.length-1,1)]);txt=`Starte auf <b>${esc(gr.name)}</b> Richtung ${CARD(b)}`;}
    else{const pg=groups[i-1].g;const back=(arr)=>{const e=arr[arr.length-1];for(let j=arr.length-2;j>=0;j--)if(Math.hypot(arr[j][0]-e[0],arr[j][1]-e[1])>12)return arr[j];return arr[0];};const fwd=(arr)=>{const s0=arr[0];for(let j=1;j<arr.length;j++)if(Math.hypot(arr[j][0]-s0[0],arr[j][1]-s0[1])>12)return arr[j];return arr[arr.length-1];};const b1=bearing(back(pg),pg[pg.length-1]);const b2=bearing(g[0],fwd(g));let d=b2-b1;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;ang=d;
      const t=turnText(d);txt=t==='geradeaus weiter'?`Geradeaus weiter auf <b>${esc(gr.name)}</b>`:`${t[0].toUpperCase()+t.slice(1)} auf <b>${esc(gr.name)}</b>`;}
    const pa=passing(g).filter(a=>!seen.has(a.n)).slice(0,3);pa.forEach(a=>seen.add(a.n));
    steps.push({html:txt,text:txt.replace(/<[^>]+>/g,''),len:gr.len,g,anc:pa,ang,first:i===0,name:gr.name});});
  return steps;}

/* ---------- Routing: UI ---------- */
const pts={from:null,to:null};
function setPoint(k,p){pts[k]=p;$(k==='from'?'rFrom':'rTo').value=p?p.label:'';R.req();if(pts.from&&pts.to)compute();}
function nearestLabel(x,y){let best=null;for(const a of ancList()){const d=Math.hypot(a.x-x,a.y-y)-a.r;if(d<15&&(!best||d<best.d))best={d,n:a.n};}if(best)return best.n;
  let bs=null;for(const s of R.streets){const b=s.bbox;if(x<b[0]-30||x>b[2]+30||y<b[1]-30||y>b[3]+30)continue;for(let i=1;i<s.g.length;i++){const p=s.g[i-1],q=s.g[i];const dx=q[0]-p[0],dy=q[1]-p[1];const L2=dx*dx+dy*dy||1;let t=((x-p[0])*dx+(y-p[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const d=Math.hypot(x-p[0]-t*dx,y-p[1]-t*dy);if(!bs||d<bs.d)bs={d,n:s.name};}}
  return bs&&bs.d<40?bs.n:'Punkt auf der Karte';}
function updateNames(){const dl=$('rnames');dl.innerHTML='';const add=v=>{const o=document.createElement('option');o.value=v;dl.appendChild(o);};add('Mein Standort');markers.forEach(m=>add(m.name));for(const k of R.index.keys())add(k);}
function resolve(text){const t=text.trim();if(!t)return null;
  if(/^mein standort$/i.test(t)){const me=R.getMe();if(!me){$('zgps').click();return {wait:true};}return {x:me.x,y:me.y,label:'Mein Standort'};}
  const m=markers.find(q=>q.name.toLowerCase()===t.toLowerCase());if(m)return {x:m.x,y:m.y,label:m.name};
  const keys=[...R.index.keys()];const key=keys.find(n=>n.toLowerCase()===t.toLowerCase())||keys.find(n=>n.toLowerCase().includes(t.toLowerCase()));if(!key)return null;
  const f=R.rec.find(r=>r.n===key||r.la===key)||R.anc.find(a=>(a.n===key||a.it===key)&&!a.line);
  if(f&&f.cen)return {x:f.cen[0],y:f.cen[1],label:key};
  const s=R.streets.filter(q=>q.name===key);if(s.length){const g=s.sort((a,b)=>b.g.length-a.g.length)[0].g;const p=g[Math.floor(g.length/2)];return {x:p[0],y:p[1],label:key};}
  const b=R.index.get(key);return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,label:key};}
async function compute(){const sum=$('rSum'),ol=$('rSteps');
  for(const k of ['from','to']){const inp=$(k==='from'?'rFrom':'rTo');if(!pts[k]||pts[k].label!==inp.value){const r=resolve(inp.value);if(!r){sum.textContent=inp.value?`„${inp.value}“ nicht gefunden.`:(k==='from'?'Bitte einen Start angeben.':'Bitte ein Ziel angeben.');return;}if(r.wait){sum.textContent='Standort wird gesucht … danach nochmal „Route berechnen“.';return;}pts[k]=r;}}
  sum.textContent='Wegenetz wird geladen …';ol.innerHTML='';
  let g;try{g=await loadGraph();}catch(e){sum.textContent=e.message;return;}
  const A=snap(g,pts.from.x,pts.from.y),B=snap(g,pts.to.x,pts.to.y);
  if(!A||!B||A.d>350||B.d>350){sum.textContent='Start oder Ziel liegt außerhalb des Wegenetzes (Rom innerhalb der Mauern).';return;}
  const res=astar(g,A,B);if(!res){sum.textContent='Keine Route gefunden.';return;}
  const pl=[[pts.from.x,pts.from.y]].concat(res.pts,[[pts.to.x,pts.to.y]]);
  let len=0;for(let i=1;i<pl.length;i++)len+=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1]);
  const steps=instructions(res);route={pts:pl,steps,hl:null};
  const min=Math.max(1,Math.round(len/75));sum.innerHTML=`${fmtD(len)} · etwa ${min} Min. zu Fuß`;
  steps.forEach((st,i)=>{const li=document.createElement('li');li.innerHTML=`${st.html} <span class="dist">${fmtD(st.len)}</span>`+(st.anc.length?`<span class="anc">vorbei an: ${st.anc.map(a=>esc(a.n)+(a.rec?' (verschwunden)':'')).join(', ')}</span>`:'');
    li.onclick=()=>{route.hl=st.g;const xs=st.g.map(q=>q[0]),ys=st.g.map(q=>q[1]);goTo([Math.min(...xs)-40,Math.min(...ys)-40,Math.max(...xs)+40,Math.max(...ys)+40]);R.req();};ol.appendChild(li);});
  const li=document.createElement('li');li.innerHTML=`<b>Ziel erreicht:</b> ${esc(pts.to.label)}`;ol.appendChild(li);
  const xs=pl.map(q=>q[0]),ys=pl.map(q=>q[1]);goTo([Math.min(...xs)-60,Math.min(...ys)-60,Math.max(...xs)+60,Math.max(...ys)+60]);
  if(window.R3D&&R3D.setRoute)R3D.setRoute(pl);$('rNav').hidden=false;$('rSim').hidden=false;if(!NAV.on)closeMobile();R.req();if(NAV.on)NAV.onReroute();}
function goTo(b){if(R.is3d()){R3D.flyTo(b);return;}const p=$('panel');const pw=(!p.classList.contains('collapsed')&&window.innerWidth>700)?p.offsetWidth+24:0;
  if(pw){const w=b[2]-b[0];const k=Math.min(6,(window.innerWidth-pw-80)/Math.max(w,30),(window.innerHeight-120)/Math.max(b[3]-b[1],30));R.fitBox(b,60,6);R.view.k=Math.min(R.view.k,k);R.view.x-=pw/2/R.view.k;}else R.fitBox(b,60,6);R.req();}
function routeTo(p){$('routeBox').open=true;openPanel();setPoint('to',p);if(!pts.from){const me=R.getMe();if(me)setPoint('from',{x:me.x,y:me.y,label:'Mein Standort'});else{$('rSum').textContent='Jetzt einen Start wählen: Feld A ausfüllen, ⌖ tippen oder „Mein Standort“.';}}}
function openPanel(){const p=$('panel');if(p.classList.contains('collapsed'))$('collapse').click();}
$('rGo').onclick=()=>{pts.from=null;pts.to=null;compute();};
$('rFrom').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('rGo').click();}});
$('rTo').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('rGo').click();}});
$('rSwap').onclick=()=>{const a=$('rFrom').value;$('rFrom').value=$('rTo').value;$('rTo').value=a;const t=pts.from;pts.from=pts.to;pts.to=t;if(route)compute();};
$('rClear').onclick=()=>{$('rNav').hidden=true;$('rSim').hidden=true;pts.from=pts.to=null;route=null;$('rFrom').value=$('rTo').value='';$('rSum').textContent='';$('rSteps').innerHTML='';if(window.R3D&&R3D.setRoute)R3D.setRoute(null);R.req();};
$('rFromPick').onclick=()=>{if(mode==='from')return setMode(null);setMode('from','Tippe auf den Startpunkt.');};
$('rToPick').onclick=()=>{if(mode==='to')return setMode(null);setMode('to','Tippe auf das Ziel.');};


/* ---------- Navigation ---------- */
const NAV={on:false,sim:false,watch:null,timer:null,s:0,lastIdx:0,off:0,said:new Set(),mute:false,follow3d:false,heading:null,last:null,wake:null,reroutes:0,lastReroute:0};
function routeGeom(){const pl=route.pts;const cum=[0];for(let i=1;i<pl.length;i++)cum.push(cum[i-1]+Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1]));
  // maneuver positions: find each step's first point on polyline
  let j=0;const man=[];for(const st of route.steps){const p=st.g[0];let best=j,bd=1e9;for(let k=j;k<Math.min(pl.length,j+4000);k++){const d=Math.hypot(pl[k][0]-p[0],pl[k][1]-p[1]);if(d<bd){bd=d;best=k;}if(d<0.05)break;}j=best;man.push({pos:cum[best],st});}
  // ancient features along route with position + side
  const anc=[];for(const st of route.steps)for(const a of st.anc){let bk=0,bd=1e9;for(let k=0;k<pl.length;k++){const d=Math.hypot(pl[k][0]-a.x,pl[k][1]-a.y);if(d<bd){bd=d;bk=k;}}const k2=Math.min(pl.length-1,bk+1),k1=Math.max(0,k2-1);const cr=(pl[k2][0]-pl[k1][0])*(a.y-pl[k1][1])-(pl[k2][1]-pl[k1][1])*(a.x-pl[k1][0]);anc.push({a,pos:cum[bk],side:cr>0?'links':'rechts'});}
  return {pl,cum,total:cum[cum.length-1],man,anc};}
let RG=null;
NAV.onReroute=()=>{RG=routeGeom();NAV.s=0;NAV.lastIdx=0;NAV.off=0;NAV.said=new Set();speak('Route neu berechnet.');};
function project(x,y){const {pl,cum}=RG;let best=null;const from=Math.max(0,NAV.lastIdx-30),to=pl.length-1;
  for(let i=from;i<to;i++){const p=pl[i],q=pl[i+1];const dx=q[0]-p[0],dy=q[1]-p[1];const L2=dx*dx+dy*dy||1e-9;let t=((x-p[0])*dx+(y-p[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const px=p[0]+t*dx,py=p[1]+t*dy;const d=Math.hypot(x-px,y-py);
    const s=cum[i]+t*Math.sqrt(L2);const pen=d+Math.max(0,NAV.s-s-25)*0.5;if(!best||pen<best.pen)best={pen,d,s,i,px,py,b:Math.atan2(dy,dx)};}
  return best;}
function speak(t){if(NAV.mute||!('speechSynthesis' in window))return;try{const u=new SpeechSynthesisUtterance(t);u.lang='de-DE';u.rate=1.0;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
function arrowSvg(ang,first,arrive){const svg=$('navArr');let path;
  if(arrive)path='<circle r="9" fill="none" stroke="#fff" stroke-width="4"/><circle r="3" fill="#fff"/>';
  else{const a=first?0:Math.max(-2.6,Math.min(2.6,ang));const deg=-a*180/Math.PI;const uturn=Math.abs(ang)>2.6;
    path=uturn?'<path d="M6,14 V-4 A6,6 0 0 0 -6,-4 V6" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="M-12,2 L-6,10 L0,2" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>'
    :`<path d="M0,16 V2" stroke="#fff" stroke-width="5" stroke-linecap="round"/><g transform="rotate(${deg})"><path d="M0,2 V-12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M-8,-6 L0,-15 L8,-6" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></g>`;}
  svg.innerHTML=path;}
const shortTurn=st=>{const t=st.first?'':turnText(st.ang);if(st.first)return `Weiter auf ${st.name}`;if(t==='geradeaus weiter')return `geradeaus weiter auf ${st.name}`;return `${t} auf ${st.name}`;};
function update(x,y,acc,heading,speed){if(!RG)return;const pr=project(x,y);if(!pr)return;
  const rem=RG.total-pr.s;
  // off-route?
  if(pr.d>Math.max(35,Math.min(acc||0,60))){NAV.off++;}else{NAV.off=0;NAV.s=Math.max(NAV.s-15,pr.s);NAV.lastIdx=pr.i;}
  $('navGps').textContent=acc?`GPS-Genauigkeit ± ${Math.round(acc)} m`+(pr.d>25?` · ${Math.round(pr.d)} m neben der Route`:''):'';
  if(NAV.off>=3&&Date.now()-NAV.lastReroute>8000&&!NAV.sim){NAV.lastReroute=Date.now();NAV.off=0;pts.from={x,y,label:'Mein Standort'};$('rFrom').value='Mein Standort';speak('Du hast die Route verlassen. Neue Route wird berechnet.');compute();return;}
  // arrival
  if(rem<20){arrowSvg(0,false,true);$('navDist').textContent='Ziel erreicht';$('navText').textContent=pts.to?pts.to.label:'';$('navAnc').textContent='';$('navRem').textContent='0 m';$('navEta').textContent='angekommen';
    if(!NAV.said.has('arrive')){NAV.said.add('arrive');speak('Du hast dein Ziel erreicht'+(pts.to?': '+pts.to.label:'')+'.');setTimeout(()=>{if(NAV.on&&NAV.sim)stopNav();},4000);}return;}
  // next maneuver
  const s=NAV.s;let next=null,ni=-1;for(let i=0;i<RG.man.length;i++){if(RG.man[i].pos>s+8){next=RG.man[i];ni=i;break;}}
  let dist,txt,ang=0,first=false;
  if(next){dist=next.pos-s;txt=shortTurn(next.st);ang=next.st.ang;}else{dist=rem;txt='Zum Ziel: '+(pts.to?pts.to.label:'');first=true;}
  arrowSvg(ang,first,false);$('navDist').textContent=fmtD(dist);$('navText').textContent=txt[0].toUpperCase()+txt.slice(1);
  // speech
  if(next){const k=ni;if(dist<=160&&dist>60&&!NAV.said.has('a'+k)){NAV.said.add('a'+k);speak(`In ${Math.round(dist/10)*10} Metern ${shortTurn(next.st)}.`);}
    if(dist<=35&&!NAV.said.has('b'+k)){NAV.said.add('b'+k);NAV.said.add('a'+k);speak(`Jetzt ${shortTurn(next.st)}.`);}}
  // ancient sites ahead
  let aTxt='';for(const q of RG.anc){const dd=q.pos-s;if(dd<60&&dd>-30){aTxt=`${q.side==='links'?'Links':'Rechts'}: ${q.a.n}${q.a.rec?' (verschwunden)':''}`;if(!NAV.said.has('x'+q.a.n)&&dd<40){NAV.said.add('x'+q.a.n);setTimeout(()=>speak(`${q.side==='links'?'Links':'Rechts'} von dir ${q.a.rec?'stand einst':'liegt'}: ${q.a.n}.`),1800);}break;}}
  $('navAnc').textContent=aTxt;
  $('navRem').textContent=fmtD(rem);const eta=new Date(Date.now()+rem/1.25*1000);$('navEta').textContent=`${Math.max(1,Math.round(rem/75))} Min. · an ${eta.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
  // camera
  let head=heading;if(head==null||!(speed>0.6))head=pr.b;NAV.heading=head;
  if(R.is3d()){if(NAV.follow3d)R3D.follow(x,y,head);}else{R.view.x=x;R.view.y=y;if(R.view.k<2.5)R.view.k=2.5;R.req();}}
async function wake(){try{if('wakeLock' in navigator){NAV.wake=await navigator.wakeLock.request('screen');}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(NAV.on&&document.visibilityState==='visible')wake();});
function startNav(sim){if(!route)return;RG=routeGeom();Object.assign(NAV,{on:true,sim,s:0,lastIdx:0,off:0,said:new Set(),lastReroute:Date.now()});
  $('navBar').hidden=false;$('navFoot').hidden=false;$('info').style.display='none';const p=$('panel');if(!p.classList.contains('collapsed'))$('collapse').click();
  document.querySelector('.zoombtns').style.top='96px';wake();
  if(sim){let s=0;const sp=1.4*4;NAV.timer=setInterval(()=>{s+=sp*0.5;const {pl,cum}=RG;let i=0;while(i<cum.length-2&&cum[i+1]<s)i++;const t=Math.min(1,(s-cum[i])/((cum[i+1]-cum[i])||1));const x=pl[i][0]+(pl[i+1][0]-pl[i][0])*t,y=pl[i][1]+(pl[i+1][1]-pl[i][1])*t;
      R.setMe({x,y,acc:5});update(x,y,5,Math.atan2(pl[i+1][1]-pl[i][1],pl[i+1][0]-pl[i][0]),sp);if(s>RG.total+10){clearInterval(NAV.timer);NAV.timer=null;}},500);
    speak('Probelauf gestartet. '+(route.steps[0]?route.steps[0].text:''));}
  else{if(!navigator.geolocation){$('navGps').textContent='Dieser Browser kann den Standort nicht bestimmen.';return;}
    $('navGps').textContent='GPS wird gesucht …';speak('Navigation gestartet. '+(route.steps[0]?route.steps[0].text:''));
    NAV.watch=navigator.geolocation.watchPosition(p=>{const [x,y]=R.ll2m(p.coords.latitude,p.coords.longitude);R.setMe({x,y,acc:p.coords.accuracy||20});
        const h=(p.coords.heading!=null&&!isNaN(p.coords.heading))?(90-p.coords.heading)*Math.PI/180:null;update(x,y,p.coords.accuracy,h,p.coords.speed);},
      e=>{$('navGps').textContent=e.code===1?'Standortzugriff abgelehnt. Bitte im Browser erlauben (nur über https möglich).':'Kein GPS-Signal.';},{enableHighAccuracy:true,maximumAge:2000,timeout:20000});}}
function stopNav(){NAV.on=false;if(NAV.watch!=null)navigator.geolocation.clearWatch(NAV.watch);NAV.watch=null;if(NAV.timer)clearInterval(NAV.timer);NAV.timer=null;
  $('navBar').hidden=true;$('navFoot').hidden=true;document.querySelector('.zoombtns').style.top='';try{NAV.wake&&NAV.wake.release();}catch(e){}NAV.wake=null;try{speechSynthesis.cancel();}catch(e){}}
$('rNav').onclick=()=>startNav(false);$('rSim').onclick=()=>startNav(true);$('navEnd').onclick=stopNav;
$('navMute').onclick=()=>{NAV.mute=!NAV.mute;$('navMute').textContent=NAV.mute?'🔇 Ton aus':'🔊 Ton an';$('navMute').setAttribute('aria-pressed',String(NAV.mute));if(NAV.mute)try{speechSynthesis.cancel();}catch(e){}};
$('navView').onclick=async()=>{if(!R.is3d()){$('z3d').click();NAV.follow3d=true;$('navView').textContent='2D-Karte';const me=R.getMe();setTimeout(()=>{if(me&&R.is3d())R3D.follow(me.x,me.y,NAV.heading);},1500);}else{NAV.follow3d=false;$('z3d').click();$('navView').textContent='3D folgen';}};

/* ---------- Info-Karte: Aktionen ---------- */
H.info=f=>{const card=$('info');let acts=card.querySelector('.acts');if(!acts){acts=document.createElement('div');acts.className='acts';card.appendChild(acts);}
  const c=f.cen||(f.rings&&f.rings[0]&&f.rings[0][0]);if(!c){acts.innerHTML='';return;}const name=f.n||f.it||f.la||'Antiker Rest';
  acts.innerHTML='<button type="button" data-a="to">Route hierhin</button><button type="button" data-a="from">Route von hier</button><button type="button" data-a="mk">Markieren</button>';
  acts.querySelector('[data-a=to]').onclick=()=>routeTo({x:c[0],y:c[1],label:name});
  acts.querySelector('[data-a=from]').onclick=()=>{$('routeBox').open=true;openPanel();setPoint('from',{x:c[0],y:c[1],label:name});};
  acts.querySelector('[data-a=mk]').onclick=()=>openDlg({x:c[0],y:c[1],name});};

/* ---------- 3D-Anbindung ---------- */
function wire3D(){if(!window.R3D)return;R3D.onBuilt=()=>{R3D.setMarkers(markers);if(route)R3D.setRoute(route.pts);};R3D.onRender=updCompass;}
wire3D();
const btn3=$('z3d');btn3.addEventListener('click',()=>setTimeout(updCompass,50));
renderMarkers();updCompass();
})();
