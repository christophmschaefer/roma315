/* 3D-Modus für "Roma 315" – three.js r147 (lokal in vendor/) */
(function(){
const R=window.R2D, D3=window.ROMA3D;
const cv2=document.getElementById('map'), cv3=document.getElementById('map3d');
const btn=document.getElementById('z3d'), hint=document.getElementById('hint3d'), loading=document.getElementById('load3d');
const labEl=document.getElementById('labels3d');
const API={active:false};window.R3D=API;
let renderer,scene,camera,controls,THREE,built=false,needs=true;
const groups={};const pick=[];let labelCands=[];let extraLabels=[];let routeObjs=[];let markerObjs=[];let gpsMesh=null;let pantheonC=null;

function load(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Konnte '+src+' nicht laden'));document.head.appendChild(s);});}
async function libs(){if(!window.THREE)await load('vendor/three.min.js');if(!window.THREE.MapControls)await load('vendor/OrbitControls.js');if(!window.THREE.BufferGeometryUtils)await load('vendor/BufferGeometryUtils.js');THREE=window.THREE;}

// world: x = east (m), y = up, z = -north
const shapeFrom=(outer,holes)=>{const sh=new THREE.Shape(outer.map(p=>new THREE.Vector2(p[0],p[1])));for(const h of holes||[])sh.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],p[1]))));return sh;};
function prism(outer,holes,h,base=0){
  let g;
  if(h<1){g=new THREE.ShapeGeometry(shapeFrom(outer,holes));g=g.toNonIndexed();g.rotateX(-Math.PI/2);g.translate(0,base,0);}
  else{g=new THREE.ExtrudeGeometry(shapeFrom(outer,holes),{depth:h,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,base,0);}
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  return g;
}
// thick wall / aqueduct along a polyline
function wallGeom(pts,w,h){const pos=[];const q=(a,b,c,d)=>pos.push(...a,...b,...c,...a,...c,...d);
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];const dx=x1-x0,dy=y1-y0,l=Math.hypot(dx,dy);if(l<0.01)continue;
    const nx=-dy/l*w/2,ny=dx/l*w/2;const ex=dx/l*w/2,ey=dy/l*w/2;
    const A=[x0-ex+nx,y0-ey+ny],B=[x1+ex+nx,y1+ey+ny],C=[x1+ex-nx,y1+ey-ny],Dd=[x0-ex-nx,y0-ey-ny];
    const v=(p,z)=>[p[0],z,-p[1]];
    q(v(A,0),v(B,0),v(B,h),v(A,h));q(v(C,0),v(Dd,0),v(Dd,h),v(C,h));q(v(B,0),v(C,0),v(C,h),v(B,h));q(v(Dd,0),v(A,0),v(A,h),v(Dd,h));q(v(A,h),v(B,h),v(C,h),v(Dd,h));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(pos.length/3*2),2));return g;}
// flat ribbon (streets)
function ribbon(lines,wOf,y){const pos=[];for(const L of lines){const w=wOf(L);const pts=L.g;
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];const dx=x1-x0,dy=y1-y0,l=Math.hypot(dx,dy);if(l<0.01)continue;
    const nx=-dy/l*w/2,ny=dx/l*w/2,ex=dx/l*w/2,ey=dy/l*w/2;
    const a=[x0-ex+nx,y,-(y0-ey+ny)],b=[x1+ex+nx,y,-(y1+ey+ny)],c=[x1+ex-nx,y,-(y1+ey-ny)],d=[x0-ex-nx,y,-(y0-ey-ny)];
    pos.push(...a,...c,...b,...a,...d,...c);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g;}

function addMerged(key,geoms,refs,mat,opts={}){
  if(!geoms.length)return;
  const starts=[];let acc=0;for(const g of geoms){starts.push(acc);acc+=g.attributes.position.count/3;}
  const m=new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geoms,false),mat);
  geoms.forEach(g=>g.dispose());
  m.userData={starts,refs};Object.assign(m,opts);scene.add(m);(groups[key]=groups[key]||[]).push(m);if(refs)pick.push(m);return m;}
const off=(mat,f)=>{mat.polygonOffset=true;mat.polygonOffsetFactor=f;mat.polygonOffsetUnits=f;return mat;};

function build(){
  const Wc=window.innerWidth,Hc=window.innerHeight;
  renderer=new THREE.WebGLRenderer({canvas:cv3,antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  scene=new THREE.Scene();scene.background=new THREE.Color('#dcd8cc');scene.fog=new THREE.Fog('#dcd8cc',4500,14000);
  camera=new THREE.PerspectiveCamera(45,1,2,20000);
  scene.add(new THREE.HemisphereLight('#fff7ea','#8d7c66',0.62));
  const sun=new THREE.DirectionalLight('#fff3dc',0.55);sun.position.set(-1200,1800,900);scene.add(sun);

  // ground
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30000,30000),off(new THREE.MeshBasicMaterial({color:'#e9e6dc'}),6));ground.rotateX(-Math.PI/2);ground.position.set(3500,0,-3500);scene.add(ground);

  const M={
    water:off(new THREE.MeshBasicMaterial({color:'#9fb6b2'}),4),
    site:off(new THREE.MeshBasicMaterial({color:'#e8cf9f'}),3),
    ruin:new THREE.MeshLambertMaterial({color:'#c98a3c'}),
    wall:new THREE.MeshLambertMaterial({color:'#8e2f22'}),
    aque:new THREE.MeshLambertMaterial({color:'#7a5230'}),
    rec:new THREE.MeshLambertMaterial({color:'#d98b67',transparent:true,opacity:0.86}),
    recEdge:new THREE.LineBasicMaterial({color:'#8e2f22',transparent:true,opacity:0.7}),
    road:off(new THREE.MeshBasicMaterial({color:'#151515'}),1),
    street:off(new THREE.MeshBasicMaterial({color:'#c62a1f'}),-2),
    streetX:new THREE.MeshBasicMaterial({color:'#c62a1f',transparent:true,opacity:0.3,depthTest:false,depthWrite:false}),
  };

  // water
  const wg=[];for(const f of R.D.A){if(f.c!=='water')continue;const o=f.o.map(R.dec),i=(f.i||[]).map(R.dec);for(const r of o)wg.push(prism(r,i,0,0.05));}
  addMerged('water',wg,null,M.water);

  // ancient remains
  const gR=[],rR=[],gS=[],rS=[],gW=[],rW=[],gA=[],rA=[];
  for(const it of D3.A){const a=R.ancByIdx[it.a];if(!a)continue;
    if(it.line){const pts=R.dec(a.o[0]);const g=wallGeom(pts,it.w,it.h);if(a.c==='aqueduct'){gA.push(g);rA.push(a);}else{gW.push(g);rW.push(a);}continue;}
    const parts=it.g?it.g.map(p=>[R.dec(p.o),p.i.map(R.dec)]):[[R.dec(a.o[0]),(a.i||[]).map(R.dec)]];
    for(const [o,ho] of parts){const g=prism(o,ho,it.h,it.h<1?0.1:0);if(it.h<1){gS.push(g);rS.push(a);}else{gR.push(g);rR.push(a);}}
    if(it.extra)for(const p of it.extra){const g=prism(R.dec(p.o),p.i.map(R.dec),it.eh,it.eh<1?0.1:0);if(it.eh<1){gS.push(g);rS.push(a);}else{gR.push(g);rR.push(a);}}
    if(it.h>=1)labelCands.push({t:a.n,tl:a.la||a.n,x:a.cen[0],y:a.cen[1],z:it.h+3,pri:(a.area||0),cls:'mo',grp:'anc'});
  }
  addMerged('anc',gS,rS,M.site);addMerged('anc',gR,rR,M.ruin);addMerged('anc',gW,rW,M.wall);addMerged('anc',gA,rA,M.aque);
  for(const a of R.anc)if(a.n&&!a.line&&a.area>2500&&!labelCands.some(l=>l.t===a.n))labelCands.push({t:a.n,tl:a.la||a.n,x:a.cen[0],y:a.cen[1],z:2,pri:a.area*0.5,cls:'mo',grp:'anc'});

  // reconstructions
  const gC=[],rC=[],gL=[],rL=[];
  for(const it of D3.R){const r=R.rec[it.r];
    if(it.line){gL.push(wallGeom(r.rings[0],it.w,it.h));rL.push(r);continue;}
    if(r.n==='Pantheon'){const c=R.ll2m(41.89861,12.47687);pantheonC=c;
      const cyl=new THREE.CylinderGeometry(29,29,30,48,1,false).toNonIndexed();cyl.translate(c[0],15,-c[1]);
      const dome=new THREE.SphereGeometry(29,48,12,0,Math.PI*2,0,Math.PI/2).toNonIndexed();dome.scale(1,0.62,1);dome.translate(c[0],30,-c[1]);
      const por=new THREE.BoxGeometry(34,25,25).toNonIndexed();por.translate(c[0],12.5,-(c[1]+34.5));
      for(const g of [cyl,dome,por]){gC.push(g);rC.push(r);}labelCands.push({t:r.n,tl:r.la,x:c[0],y:c[1],z:52,pri:r.area*3,cls:'mo',grp:'rec'});continue;}
    const parts=it.g?it.g.map(p=>[R.dec(p.o),p.i.map(R.dec)]):[[r.rings[0],[]]];
    for(const [o,ho] of parts){gC.push(prism(o,ho,it.h,it.h<1?0.12:0));rC.push(r);}
    if(it.extra)for(const p of it.extra){gC.push(prism(R.dec(p.o),p.i.map(R.dec),it.eh,0.12));rC.push(r);}
    labelCands.push({t:r.n,tl:r.la,x:r.cen[0],y:r.cen[1],z:Math.max(it.h,1)+3,pri:(r.area||0)*1.2,cls:'mo',grp:'rec'});
  }
  const recMesh=addMerged('rec',gC,rC,M.rec);
  if(recMesh){const e=new THREE.LineSegments(new THREE.EdgesGeometry(recMesh.geometry,30),M.recEdge);scene.add(e);groups.rec.push(e);}
  addMerged('rec',gL,rL,new THREE.MeshLambertMaterial({color:'#b5523f',transparent:true,opacity:0.7}));

  // ancient roads & modern streets
  addMerged('roads',[ribbon(R.roads,()=>14,0.2)],null,M.road);
  const W={1:9,2:7.5,3:5,4:3.2,5:1.8};
  const lines=R.streets.filter(s=>!s.area);
  // streets without names are not in R.streets: rebuild from raw data
  const all=[];for(const s of R.D.S){if(s[3])continue;const g=R.dec(s[4]);if(g.length<2)continue;all.push({g,cls:s[0],area:!!s[2]});}
  const geoS=ribbon(all,s=>s.area?1.6:W[s.cls],0.4);
  const sm=new THREE.Mesh(geoS,M.street);scene.add(sm);groups.str=[sm];
  const sx=new THREE.Mesh(geoS,M.streetX);sx.renderOrder=50;scene.add(sx);groups.strx=[sx];

  // street label candidates: one per way, longest straight run
  for(const s of lines){if(s.cls>4)continue;let best=0,bi=1;for(let i=1;i<s.g.length;i++){const l=Math.hypot(s.g[i][0]-s.g[i-1][0],s.g[i][1]-s.g[i-1][1]);if(l>best){best=l;bi=i;}}
    if(best<25)continue;const p0=s.g[bi-1],p1=s.g[bi];labelCands.push({t:s.name,x:(p0[0]+p1[0])/2,y:(p0[1]+p1[1])/2,z:1,pri:-s.cls*1e6+best,cls:'st',grp:'str'});}
  for(const h of R.D.L)labelCands.push({t:h.n,tl:h.la,x:h.u[1]*R.KX,y:h.u[0]*R.KY,z:60,pri:1e9,cls:'hi',grp:'hill'});
  labelCands.sort((a,b)=>b.pri-a.pri);

  controls=new THREE.MapControls(camera,cv3);controls.enableDamping=true;controls.dampingFactor=0.12;controls.maxPolarAngle=Math.PI*0.47;controls.minDistance=40;controls.maxDistance=9000;controls.screenSpacePanning=false;
  controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};
  controls.addEventListener('change',()=>{needs=true;});
  // click picking
  let down=null;cv3.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  cv3.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const H=window.R2DHOOKS;if(H.click){const g=groundPoint(e.clientX,e.clientY);if(g&&H.click(g[0],g[1]))return;}doPick(e.clientX,e.clientY);});
  window.addEventListener('resize',()=>{if(API.active){size();needs=true;}});
  built=true;API.sync();if(API.onBuilt)API.onBuilt();
}

function groundPoint(cx,cy){const r=cv3.getBoundingClientRect();const v=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);const rc=new THREE.Raycaster();rc.setFromCamera(v,camera);const pl=new THREE.Plane(new THREE.Vector3(0,1,0),0);const p=new THREE.Vector3();if(!rc.ray.intersectPlane(pl,p))return null;return [p.x,-p.z];}
API.follow=(x,y,head)=>{if(!controls)return;const d=380,pol=0.95;const hd=d*Math.sin(pol),h=d*Math.cos(pol);controls.target.set(x,0,-y);
  if(head==null){const off=camera.position.clone().sub(controls.target);off.y=0;const L=off.length()||1;camera.position.set(x+off.x/L*hd,h,-y+off.z/L*hd);}
  else camera.position.set(x-Math.cos(head)*hd,h,-y+Math.sin(head)*hd);controls.update();needs=true;};
API.getAzimuth=()=>controls?controls.getAzimuthalAngle():0;
API.northUp=()=>{if(!controls)return;const t=controls.target,p=camera.position;const d=p.distanceTo(t);const pol=controls.getPolarAngle();camera.position.set(t.x,t.y+d*Math.cos(pol),t.z+d*Math.sin(pol));controls.update();needs=true;};
API.setRoute=(pts)=>{if(!built)return;for(const o of routeObjs){scene.remove(o);o.geometry.dispose();}routeObjs=[];
  if(pts&&pts.length>1){const g=ribbon([{g:pts}],()=>9,0.9);const m1=new THREE.Mesh(g,off(new THREE.MeshBasicMaterial({color:'#1b5fd1'}),-6));const m2=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#1b5fd1',transparent:true,opacity:0.45,depthTest:false,depthWrite:false}));m2.renderOrder=60;
    const mk=(p,c)=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(7,7,3,24),new THREE.MeshBasicMaterial({color:c}));s.position.set(p[0],1.5,-p[1]);return s;};
    routeObjs=[m1,m2,mk(pts[0],'#2e8540'),mk(pts[pts.length-1],'#c62a1f')];routeObjs.forEach(o=>scene.add(o));}
  needs=true;};
API.setMarkers=(list)=>{if(!built)return;for(const o of markerObjs){scene.remove(o);}markerObjs=[];extraLabels=[];
  const mat=new THREE.MeshLambertMaterial({color:'#7b2fbf'});
  for(const m of list){const grp=new THREE.Group();const st=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,30,8),mat);st.position.y=15;const hd=new THREE.Mesh(new THREE.SphereGeometry(5,16,10),mat);hd.position.y=32;grp.add(st,hd);grp.position.set(m.x,0,-m.y);scene.add(grp);markerObjs.push(grp);
    extraLabels.push({t:m.name,x:m.x,y:m.y,z:42,pri:2e9,cls:'mk',grp:'mk'});}
  needs=true;};
const ray=()=>new THREE.Raycaster();
function doPick(cx,cy){const r=cv3.getBoundingClientRect();const v=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);const rc=ray();rc.setFromCamera(v,camera);
  const hits=rc.intersectObjects(pick.filter(m=>m.visible),false);
  for(const h of hits){const st=h.object.userData.starts;let lo=0,hi=st.length-1;const f=h.faceIndex;while(lo<hi){const mid=(lo+hi+1)>>1;if(st[mid]<=f)lo=mid;else hi=mid-1;}const ref=h.object.userData.refs[lo];if(ref&&(ref.n||ref.la||ref.k)){R.showInfo(ref);return;}}
  document.getElementById('info').style.display='none';}

function size(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}

// labels
const pool=[];function span(i){let s=pool[i];if(!s){s=document.createElement('span');labEl.appendChild(s);pool[i]=s;}return s;}
function labels(){const w=window.innerWidth,h=window.innerHeight;const L=R.L;const cell=new Map();const v=new THREE.Vector3();let n=0;const camPos=camera.position;
  const free=(b)=>{for(let x=Math.floor(b[0]/50);x<=Math.floor(b[2]/50);x++)for(let y=Math.floor(b[1]/30);y<=Math.floor(b[3]/30);y++){const l=cell.get(x+','+y);if(l)for(const q of l)if(!(b[2]<q[0]||b[0]>q[2]||b[3]<q[1]||b[1]>q[3]))return false;}return true;};
  const add=(b)=>{for(let x=Math.floor(b[0]/50);x<=Math.floor(b[2]/50);x++)for(let y=Math.floor(b[1]/30);y<=Math.floor(b[3]/30);y++){const k=x+','+y;(cell.get(k)||cell.set(k,[]).get(k)).push(b);}};
  const seen=new Map();
  for(const c of extraLabels.concat(labelCands)){if(n>=170)break;
    if(c.grp==='str'&&!(L.str&&L.strlab))continue;if(c.grp==='anc'&&!L.anc)continue;if(c.grp==='rec'&&!L.rec)continue;
    const dist=Math.hypot(c.x-camPos.x,c.y+camPos.z,camPos.y-c.z);
    if(c.grp==='str'&&dist>(c.pri>-2e6?2600:c.pri>-3e6?1700:900))continue;
    if(c.cls==='mo'&&dist>Math.max(900,Math.sqrt(Math.max(c.pri,1))*30))continue;
    v.set(c.x,c.z,-c.y).project(camera);if(v.z>1||v.x<-1.05||v.x>1.05||v.y<-1.05||v.y>1.05)continue;
    const x=(v.x+1)/2*w,y=(1-v.y)/2*h;const txt=(L.latin&&c.tl)?c.tl:c.t;
    const cw=c.cls==='st'?6.3:c.cls==='hi'?13:7.4;const bw=txt.length*cw/2+4,bh=c.cls==='st'?8:10;
    if(c.grp==='str'){const p=seen.get(txt);if(p&&p.some(q=>Math.hypot(q[0]-x,q[1]-y)<260))continue;}
    const b=[x-bw,y-bh,x+bw,y+bh];if(!free(b))continue;add(b);
    if(c.grp==='str')(seen.get(txt)||seen.set(txt,[]).get(txt)).push([x,y]);
    const s=span(n++);if(s.textContent!==txt)s.textContent=txt;s.className=c.cls;s.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;s.style.left='0';s.style.top='0';s.style.display='';}
  for(let i=n;i<pool.length;i++)pool[i].style.display='none';}

function loop(){if(!API.active)return;requestAnimationFrame(loop);const ch=controls.update();if(ch||needs){needs=false;renderer.render(scene,camera);labels();if(API.onRender)API.onRender();}}

function placeFromView(){const [Wc,Hc]=R.getSize();const v=R.view;const fov=camera.fov*Math.PI/180;const dist=Math.min(7000,Math.max(150,(Math.min(Hc,Wc*1.3)/v.k)/(2*Math.tan(fov/2))*0.85));
  const tilt=55*Math.PI/180;controls.target.set(v.x,0,-v.y);camera.position.set(v.x,dist*Math.cos(tilt),-v.y+dist*Math.sin(tilt));controls.update();}
function viewFromCamera(){const [Wc,Hc]=R.getSize();const t=controls.target;const dist=camera.position.distanceTo(t);const fov=camera.fov*Math.PI/180;R.fromView(t.x,-t.z,Math.min(Hc,Wc*1.3)/(2*Math.tan(fov/2)*dist*0.85));}

API.sync=()=>{if(!built)return;const L=R.L;const vis=(k,on)=>(groups[k]||[]).forEach(m=>m.visible=on);
  vis('anc',L.anc);vis('rec',L.rec);vis('roads',L.roads);vis('str',L.str);vis('strx',L.str);needs=true;};
API.zoom=f=>{const t=controls.target,p=camera.position;p.sub(t).multiplyScalar(f).add(t);controls.update();needs=true;};
API.home=()=>{const a=R.ll2m(41.8935,12.4860);controls.target.set(a[0],0,-a[1]);camera.position.set(a[0]-600,1700,-a[1]+2300);controls.update();needs=true;};
API.flyTo=b=>{const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;const r=Math.max(120,Math.hypot(b[2]-b[0],b[3]-b[1]));const d=camera.position.clone().sub(controls.target).normalize().multiplyScalar(r*1.6);controls.target.set(cx,0,-cy);camera.position.copy(controls.target).add(d);controls.update();needs=true;};
API.gps=()=>{if(!built)return;const me=R.getMe();if(!me)return;if(!gpsMesh){gpsMesh=new THREE.Group();const s=new THREE.Mesh(new THREE.SphereGeometry(5,20,12),new THREE.MeshBasicMaterial({color:'#1b5fd1'}));s.position.y=40;const c=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,40,8),new THREE.MeshBasicMaterial({color:'#1b5fd1'}));c.position.y=20;gpsMesh.add(s,c);scene.add(gpsMesh);}gpsMesh.position.set(me.x,0,-me.y);needs=true;};

async function enter(){
  btn.disabled=true;loading.hidden=false;
  try{await libs();if(!built){await new Promise(r=>setTimeout(r,30));build();}}
  catch(err){loading.textContent='3D konnte nicht geladen werden: '+err.message+'. WebGL wird von diesem Browser eventuell nicht unterstützt.';btn.disabled=false;setTimeout(()=>{loading.hidden=true;loading.textContent='3D-Modell wird gebaut …';},5000);return;}
  loading.hidden=true;btn.disabled=false;
  API.active=true;cv2.hidden=true;cv3.hidden=false;labEl.hidden=false;hint.hidden=false;setTimeout(()=>{hint.hidden=true;},7000);
  document.getElementById('scale').style.display='none';
  btn.textContent='2D';btn.setAttribute('aria-pressed','true');
  size();placeFromView();API.gps();needs=true;loop();
}
function leave(){API.active=false;viewFromCamera();cv3.hidden=true;cv2.hidden=false;labEl.hidden=true;hint.hidden=true;document.getElementById('scale').style.display='';
  btn.textContent='3D';btn.setAttribute('aria-pressed','false');R.req();}
btn.addEventListener('click',()=>{API.active?leave():enter();});
})();
