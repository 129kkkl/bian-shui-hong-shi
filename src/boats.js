import * as THREE from 'three';
import { Blocks,C,color,rnd,pot,crate,sack,basket,cubeGeometry } from './geometry.js';
import { addBoatActor } from './citizens.js';

export const fleet=[];
const river=new THREE.Group();river.name='汴水与舟运';
let rippleMesh,wakeMesh,mainBoat;
const rippleData=[],dummy=new THREE.Object3D();
const R=3.2,L=40,TOTAL=2*L+2*Math.PI*R,BOAT_SPEED=.78;
export function boatPath(distance){
  let s=((distance%TOTAL)+TOTAL)%TOTAL,x,z,dx,dz;
  if(s<L){x=-R;z=L/2-s;dx=0;dz=-1;}
  else if(s<L+Math.PI*R){const angle=Math.PI+(s-L)/R;x=R*Math.cos(angle);z=-L/2+R*Math.sin(angle);dx=-Math.sin(angle);dz=Math.cos(angle);}
  else if(s<2*L+Math.PI*R){x=R;z=-L/2+s-L-Math.PI*R;dx=0;dz=1;}
  else{const angle=(s-2*L-Math.PI*R)/R;x=R*Math.cos(angle);z=L/2+R*Math.sin(angle);dx=-Math.sin(angle);dz=Math.cos(angle);}
  return {x,z,dx,dz,yaw:Math.atan2(-dx,-dz)};
}
function hull(length,width,kind){
  const group=new THREE.Group(),b=new Blocks();
  for(let z=-length/2+.2;z<length/2;z+=.38){
    const ratio=Math.abs(z/(length/2));
    const w=width*(1-Math.pow(ratio,3)*.77);
    const rise=Math.pow(ratio,4)*.24;
    b.box(0,.16+rise,z,w*.69,.31,.39,'#5e5342');
    b.box(0,.37+rise,z,w*.9,.20,.39,C.wood);
    b.box(0,.52+rise,z,w,.13,.39,C.woodLight);
    b.box(0,.62+rise,z,w*.86,.08,.36,'#b39868');
    for(const s of [-1,1]){
      b.box(s*w*.47,.7+rise,z,.14,.32,.39,C.woodDark);
      b.box(s*w*.47,.88+rise,z,.18,.07,.40,C.woodLight);
    }
  }
  for(const z of [-length*.33,length*.33])b.box(0,.83,z,width*.84,.13,.28,C.woodDark);
  b.box(0,.91,-length*.46,width*.4,.16,.4,C.wood);
  b.box(0,.88,length*.47,width*.32,.2,.32,C.woodDark);
  b.box(0,.27,length*.53,.1,.95,.7,C.woodDark,.18);
  if(kind==='freight'){
    // A woven cabin canopy, stepped across the transverse arch.
    const canopyLength=3.5;
    for(const s of [-1,1])for(const zz of [-1.6,1.6])b.box(s*width*.35,1.35,zz,.12,1.55,.12,C.woodDark);
    for(let xx=-width*.4;xx<=width*.4;xx+=.22){
      const yy=1.62+.7*(1-Math.abs(xx)/(width*.44));
      b.box(xx,yy,0,.23,.11,canopyLength,(Math.round(xx/.22)%3===0)?'#c2b086':'#cbbd91');
      for(const zz of [-1.72,0,1.72])b.box(xx,yy+.08,zz,.24,.065,.07,C.wood);
    }
    for(let j=0;j<3;j++){
      crate(b,-.55,.68,2.1+j*.55,.52);sack(b,.35,.69,2.1+j*.55,.53);
    }
    crate(b,-.48,1.21,2.5,.49);
    b.box(0,.85,-2.3,width*.65,.18,.43,C.wood);
    b.box(.6,.76,-3,.49,.12,.65,C.cream);
  }else if(kind==='cargo'){
    for(let z=-1.5;z<1.8;z+=.7)for(const x of [-.4,.3])sack(b,x,.7,z,.57);
    b.box(0,1.35,0,width*.85,.12,2.1,C.cream);
    for(const x of [-.7,.7])b.box(x,.98,0,.07,.65,2.1,C.wood);
  }else{
    basket(b,-.2,.68,-.7,.65,null);basket(b,.25,.68,.3,.6,'fish');
    // Folded fishing nets made from a coarse woven lattice.
    for(let j=0;j<8;j++)b.box(-.25+j*.09,.75,1.2,.025,.03,.85,'#b4b193');
    for(let j=0;j<8;j++)b.box(.08,.77,.8+j*.1,.65,.03,.025,'#c1b99a');
    b.beam([-.6,.9,-1.8],[.65,.9,1.9],.05,.05,C.woodLight);
  }
  b.finish(group,'船体 · '+kind);group.userData={length,width,kind};return group;
}

export function setupRiver(scene,waterMaterial=new THREE.MeshStandardMaterial({color:'#81aea4',roughness:.46,metalness:.06})){
  scene.add(river);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(20.4,59.6),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.y=.23;water.receiveShadow=true;water.name='春水';river.add(water);
  const mosaic=new Blocks();
  for(let z=-29;z<30;z+=1.7)for(let x=-9.5;x<10;x+=1.7){
    if(rnd()>.52)mosaic.box(x,.235,z,1.68,.009,1.68,rnd()>.5?'#87b1a6':'#7ca99f');
  }
  mosaic.finish(river,'水面色块',{castShadow:false});
  // Slow drifting, varied-length light marks keep the flat water readable.
  const rippleMat=new THREE.MeshBasicMaterial({color:'#c2d1b7',transparent:true,opacity:.45,depthWrite:false});
  rippleMesh=new THREE.InstancedMesh(cubeGeometry,rippleMat,260);rippleMesh.frustumCulled=false;
  for(let i=0;i<260;i++)rippleData.push({x:rnd(-9.3,9.3),z:rnd(-29,29),length:rnd(.2,1.3),phase:rnd(0,6.28),speed:rnd(.035,.075)});
  river.add(rippleMesh);
  wakeMesh=new THREE.InstancedMesh(cubeGeometry,new THREE.MeshBasicMaterial({color:'#d0d8bd',transparent:true,opacity:.63,depthWrite:false}),52);
  wakeMesh.frustumCulled=false;river.add(wakeMesh);
  mainBoat=hull(9.7,3.05,'freight');mainBoat.name='主货船';river.add(mainBoat);
  const mast=new THREE.Group();mast.position.set(-.87,1,-1.7);
  const mb=new Blocks();mb.box(0,1.93,0,.13,3.86,.13,C.woodDark);mb.box(0,2.8,0,1.45,.09,.09,C.wood);
  mb.box(0,3.35,.02,.36,.42,.16,C.cream);mb.box(0,2.1,.06,.24,1.7,.19,'#bdb392');
  mb.beam([0,3.55,0],[-.66,2.8,0],.025,.025,C.cream);mb.beam([0,3.55,0],[.66,2.8,0],.025,.025,C.cream);mb.finish(mast,'可降桅杆');mainBoat.add(mast);mainBoat.userData.mast=mast;
  const rb=new Blocks();rb.box(-.87,.9,-1.7,.3,.43,.3,C.wood);rb.box(-.87,1.05,-1.7,.36,.12,.36,C.woodDark);rb.finish(mainBoat,'桅座');
  addBoatActor(mainBoat,.55,.9,-3.65,0,'boat');addBoatActor(mainBoat,-.37,.89,3.85,Math.PI,'boat');
  fleet.push(mainBoat);
  for(const opts of [
    {x:6.05,z:11.5,angle:0,l:5.7,w:1.9,kind:'cargo'},
    {x:-6.12,z:-12,angle:Math.PI,l:5.9,w:1.9,kind:'fishing'},
    {x:-7.85,z:21.2,angle:0,l:4.4,w:1.55,kind:'fishing',anchorX:-9.25,anchorZ:19.2}
  ]){
    const boat=hull(opts.l,opts.w,opts.kind);boat.userData.mooring=opts;boat.position.set(opts.x,.24,opts.z);boat.rotation.y=opts.angle;river.add(boat);fleet.push(boat);
    addBoatActor(boat,.1,.82,-opts.l*.3,0,'boat');
    if(opts.kind==='cargo')addBoatActor(boat,-.05,.75,opts.l*.28,Math.PI,'carry');
    const rope=new Blocks();const side=opts.x>0?1:-1;
    rope.beam([opts.x,.9,opts.z-1.5],[opts.anchorX??side*7.35,opts.anchorX !== undefined ? .99 : 1.22,opts.anchorZ??opts.z-2.8],.035,.035,C.cream);rope.finish(river,'缆绳');
  }
  updateRiver(0);return river;
}
export function updateRiver(time){
  const distance=8+time*BOAT_SPEED,path=boatPath(distance);
  mainBoat.position.set(path.x,.24+Math.sin(time*1.35)*.035,path.z);
  mainBoat.rotation.set(Math.sin(time*.9)*.006,path.yaw,Math.sin(time*1.2)*.009);
  // Lower well before the bow enters the crossing; lift only after the stern
  // has left. The folded rig clears all arch ribs by more than one metre.
  const folded=1-THREE.MathUtils.smoothstep(Math.abs(path.z),14,19);
  mainBoat.userData.mast.rotation.x=-folded*1.37;
  mainBoat.userData.mastFold=folded;
  for(let i=1;i<fleet.length;i++){
    const boat=fleet[i],m=boat.userData.mooring;boat.position.y=.23+Math.sin(time*1.05+i*1.7)*.025;boat.rotation.z=Math.sin(time*.8+i)*.008;
    boat.position.x=m.x+Math.sin(time*.65+i)*.015;
  }
  for(let i=0;i<rippleData.length;i++){
    const r=rippleData[i],zz=((r.z+30+time*r.speed)%60)-30;
    dummy.position.set(r.x+Math.sin(time*.23+r.phase)*.08,.256,zz);dummy.rotation.set(0,0,0);
    dummy.scale.set(r.length*(.8+Math.sin(time*.67+r.phase)*.17),.012,.025);dummy.updateMatrix();rippleMesh.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<26;i++)for(let side=-1;side<=1;side+=2){
    const t=i/25,trail=boatPath(distance-5-t*7.2);
    const offset=side*(1.15+t*1.7),px=-trail.dz,pz=trail.dx;
    dummy.position.set(trail.x+px*offset,.273,trail.z+pz*offset);
    dummy.rotation.set(0,trail.yaw+side*.26,0);dummy.scale.set(.045*(1-t*.65),.014,.18+(1-t)*.35);dummy.updateMatrix();wakeMesh.setMatrixAt(i*2+(side+1)/2,dummy.matrix);
  }
  rippleMesh.instanceMatrix.needsUpdate=true;wakeMesh.instanceMatrix.needsUpdate=true;
  river.updateMatrixWorld(true);
}
export function boatDiagnostics(time){
  const path=boatPath(8+time*BOAT_SPEED),tail=boatPath(8+time*BOAT_SPEED-5);
  return {count:fleet.length,main:{x:path.x,z:path.z,yaw:path.yaw,mastFold:mainBoat.userData.mastFold},wakeOrigin:{x:tail.x,z:tail.z},direction:{x:path.dx,z:path.dz},channelHalfWidth:9.6,routeRadius:R,boatWidth:3.05,boatLength:9.7};
}

// Conservative rectangle checks cover the full closed route, including both
// turning basins. Bridge clearance additionally uses actual transformed cube
// vertices, so the moving mast is checked in its rendered pose.
export function auditNavigation(){
  const samples=640,issues=[];let bankMargin=Infinity,endMargin=Infinity,bridgeClearance=Infinity;
  function rectangle(x,z,w,l,yaw){
    const right={x:Math.cos(yaw),z:-Math.sin(yaw)},front={x:-Math.sin(yaw),z:-Math.cos(yaw)};
    const points=[];for(const sx of [-1,1])for(const sz of [-1,1])points.push({x:x+right.x*sx*w/2+front.x*sz*l/2,z:z+right.z*sx*w/2+front.z*sz*l/2});
    return {points,axes:[right,front]};
  }
  function overlap(a,b){
    for(const axis of [...a.axes,...b.axes]){
      const ap=a.points.map(p=>p.x*axis.x+p.z*axis.z),bp=b.points.map(p=>p.x*axis.x+p.z*axis.z);
      if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;
    }
    return true;
  }
  const berthed=fleet.slice(1).map(ship=>{const p=ship.userData.mooring;return rectangle(p.x,p.z,p.w,p.l,p.angle);});
  const corner=new THREE.Vector3(),instance=new THREE.Matrix4(),combined=new THREE.Matrix4();
  for(let sample=0;sample<samples;sample++){
    const distance=sample*TOTAL/samples,t=(distance-8)/BOAT_SPEED,path=boatPath(distance);
    const bounds=rectangle(path.x,path.z,3.05,9.7,path.yaw);
    for(const point of bounds.points){bankMargin=Math.min(bankMargin,9.6-Math.abs(point.x));endMargin=Math.min(endMargin,29.8-Math.abs(point.z));}
    for(let i=0;i<berthed.length;i++)if(overlap(bounds,berthed[i]))issues.push({kind:'mooredBoatCollision',sample,boat:i+1});
    if(Math.abs(path.z)<10){
      updateRiver(t);
      mainBoat.traverse(object=>{
        if(!object.isInstancedMesh)return;
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,instance);combined.multiplyMatrices(object.matrixWorld,instance);
          for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
            corner.set(x,y,z).applyMatrix4(combined);
            if(Math.abs(corner.z)<3.75){
              const underside=1.75+5.25*(1-(corner.x/13)**2)-1.09;
              bridgeClearance=Math.min(bridgeClearance,underside-corner.y);
            }
          }
        }
      });
      // Crew and their poles are below this conservative vertical envelope.
      if(Math.abs(path.z)<7)bridgeClearance=Math.min(bridgeClearance,1.75+5.25*(1-((R+1.525)/13)**2)-1.09-3.75);
    }
  }
  if(bankMargin<0||endMargin<0)issues.push({kind:'bankCollision',bankMargin,endMargin});
  if(bridgeClearance<0)issues.push({kind:'bridgeCollision',bridgeClearance});
  return {samples,issues,minimumBankMargin:bankMargin,minimumRiverEndMargin:endMargin,minimumBridgeClearance:bridgeClearance,method:'640 poses; conservative hull rectangles and actual rendered timber and mast vertices; crew upper bound 3.75'};
}
