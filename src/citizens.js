import * as THREE from 'three';
import { cubeGeometry,solidMaterial,color,C,rnd,pick,audit,UP } from './geometry.js';
import { GROUND,deckAt,peopleSpots } from './architecture.js';

export const actors=[];
let mesh,index=0,routeAudit;
const m=new THREE.Matrix4(),rootMatrix=new THREE.Matrix4(),partMatrix=new THREE.Matrix4();
const p=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler();
function addActor(options){
  const actor={x:0,y:GROUND,z:0,yaw:0,role:'customer',pose:'stand',phase:rnd(0,Math.PI*2),height:rnd(.9,1.08),shirt:pick(['#6e8590','#b5a776','#b86e54','#8f9a78','#d0bd94','#687b70','#a58e77','#899da0']),skin:pick(['#c7a57b','#d9ba91','#c8ab86']),...options};
  if(actor.role==='porter')actor.shirt=pick(['#a58a61','#8b856b','#b19972']);
  if(actor.role==='boatman')actor.shirt='#8e9a88';
  actor.startIndex=index;actor.parts=[];
  const part=(pos,size,c,kind='fixed',rotation=0)=>{actor.parts.push({pos,size,c,kind,rotation,idx:index++});};
  const legs=actor.pose==='sit'? .25:.29;
  part([-.115,legs,0],[.145,.44,.18],'#555e51','legL');
  part([.115,legs,0],[.145,.44,.18],'#555e51','legR');
  part([-.115,.075,-.035],[.175,.12,.29],'#4a4b3f','footL');
  part([.115,.075,-.035],[.175,.12,.29],'#4a4b3f','footR');
  part([0,.70,0],[.44,.48,.29],actor.shirt);
  part([0,.48,0],[.46,.18,.33],actor.shirt);
  part([0,.57,0],[.455,.06,.335],actor.role==='vendor'?C.cream:C.woodDark);
  part([0,.87,-.155],[.06,.22,.025],C.cream);
  part([0,1.04,0],[.13,.11,.14],actor.skin);
  part([0,1.205,-.01],[.295,.31,.285],actor.skin);
  part([0,1.36,.025],[.32,.10,.29],'#414b40');
  part([0,1.435,.055],[.13,.12,.14],'#414b40');
  part([-.285,.76,0],[.14,.40,.19],actor.shirt,'armL');
  part([.285,.76,0],[.14,.40,.19],actor.shirt,'armR');
  part([-.285,.535,-.015],[.115,.12,.13],actor.skin,'handL');
  part([.285,.535,-.015],[.115,.12,.13],actor.skin,'handR');
  // Tiny dark eyes are still real geometry, visible at the nearest viewpoints.
  for(const side of [-1,1])part([side*.069,1.23,-.158],[.034,.033,.017],'#454438');
  if(actor.role==='porter'||actor.role==='boatman'){
    part([0,1.425,0],[.63,.065,.54],'#c2ac78');
    part([0,1.49,0],[.43,.08,.38],'#cabb8a');
    part([0,1.55,0],[.2,.06,.21],'#cdbb85');
  }else if(actor.role==='vendor'){
    part([0,1.4,.015],[.34,.1,.32],C.cream);
    part([.17,1.33,.10],[.1,.23,.12],C.cream);
    part([0,.57,-.19],[.27,.31,.06],'#d2c39a');
  }else if(rnd()>.72){
    part([0,1.41,0],[.39,.16,.34],'#4f6159');
  }
  if(actor.pose==='pole'){
    part([0,1.0,.06],[1.76,.075,.075],C.woodDark);
    for(const side of [-1,1]){
      part([side*.76,.68,.06],[.035,.65,.035],C.cream);
      part([side*.76,.31,.06],[.45,.35,.47],C.woodLight);
      part([side*.76,.49,.06],[.38,.035,.40],C.green);
    }
  }
  if(actor.pose==='carry'){
    part([0,.63,-.38],[.54,.50,.47],C.woodLight);
    for(const side of [-1,1])part([side*.19,.63,-.63],[.055,.51,.025],C.woodDark);
  }
  if(actor.pose==='boat')part([.48,.83,-.18],[.055,2.5,.055],C.woodDark,'oar');
  actors.push(actor);return actor;
}

function lineRoute(x1,z1,x2,z2,y=GROUND){
  const len=Math.hypot(x2-x1,z2-z1);
  const route={len,x1,z1,x2,z2,y};audit.paths.push(route);return route;
}
function routePoint(actor,t,out={}){
  const r=actor.route;
  let distance=((actor.offset+t*actor.speed)%(2*r.len)+2*r.len)%(2*r.len);
  const reverse=distance>r.len;
  if(reverse)distance=2*r.len-distance;
  const k=distance/r.len;
  out.x=r.x1+(r.x2-r.x1)*k;out.z=r.z1+(r.z2-r.z1)*k;
  const dx=(r.x2-r.x1)*(reverse?-1:1),dz=(r.z2-r.z1)*(reverse?-1:1);
  out.y=r.y==='bridge'?(Math.abs(out.x)<=12.99?deckAt(out.x):GROUND):r.y;out.yaw=Math.atan2(-dx,-dz);
  return out;
}
export function populate(){
  peopleSpots.forEach(s=>addActor(s));
  // Four lanes of activity: the bridge axis, waterfront promenades, service
  // alleys, and quay work. Routes stay in the deliberate open ground.
  const bridgeRoutes=[lineRoute(-31,-.72,31,-.72,'bridge'),lineRoute(31,.72,-31,.72,'bridge')];
  for(let lane=0;lane<2;lane++)for(let i=0;i<9;i++)addActor({route:bridgeRoutes[lane],offset:i*7.2+lane*2.7,speed:.44+rnd(-.055,.055),role:i%4===0?'porter':'customer',pose:i%4===0?'pole':'walk'});
  for(const side of [-1,1])for(const range of [[-26,-6],[6,26]]){
    const route=lineRoute(side*12.35,range[0],side*12.35,range[1]);
    for(let i=0;i<4;i++)addActor({route,offset:i*5.1+rnd(0,1.4),speed:rnd(.32,.47),role:i===1?'porter':'customer',pose:i===1?'carry':'walk'});
  }
  for(const side of [-1,1])for(const zz of [-11.4,11.2]){
    const narrow=side===-1&&zz<0,routeZ=narrow?-11.85:zz;
    const route=lineRoute(side*17,routeZ,side*29.8,routeZ);
    for(let i=0;i<3;i++)addActor({route,offset:i*4.1+rnd(0,1),speed:rnd(.3,.43),pose:i===0?(narrow?'carry':'pole'):'walk',role:i===0?'porter':'customer'});
  }
  // Conversations and buying happen at the shoulders of the traffic lanes.
  for(const side of [-1,1])for(const x of [17,22.6,27])for(const zz of [-2.4,2.4]){
    addActor({x:side*x,z:zz,yaw:zz>0?Math.PI:0,pose:'talk'});
  }
  for(const [x,z,yaw] of [[-5.6,-1.5,0],[.3,-1.5,0],[5.1,1.5,Math.PI],[-10.7,2.6,-1.4],[10.7,-2.5,1.2]])addActor({x,z,y:deckAt(x),yaw,pose:'talk'});
  // A pair pause at the railing to watch the passing freight boat.
  for(const x of [-.4,.6])addActor({x,z:3.15,y:deckAt(x),yaw:Math.PI,pose:'lean'});
  for(const [x,z] of [[-14,9.6],[14.3,-11.1],[-14.2,-20.1],[14.6,21.6],[-25.5,23.6],[23.9,-23.4]])addActor({x,z,yaw:rnd(0,6.28),pose:'talk'});
}
export function addBoatActor(parent,x,y,z,yaw=0,pose='boat'){
  return addActor({parent,x,y,z,yaw,role:'boatman',pose});
}
export function finishPeople(scene){
  mesh=new THREE.InstancedMesh(cubeGeometry,solidMaterial,index);
  mesh.name='市井人物';mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled=false;
  for(const a of actors)for(const part of a.parts)mesh.setColorAt(part.idx,color(part.c));
  scene.add(mesh);updatePeople(0);return mesh;
}
export function updatePeople(time){
  if(!mesh)return;
  for(const a of actors){
    const state=a.current||(a.current={x:a.x,y:a.y,z:a.z,yaw:a.yaw});
    if(a.route)routePoint(a,time,state);
    const walking=!!a.route,phase=time*(a.speed||.38)*8+a.phase;
    const stride=walking?Math.sin(phase)*.46:0;
    const bob=walking?Math.abs(Math.sin(phase))*.035:Math.sin(time*1.2+a.phase)*.008;
    p.set(state.x,state.y+bob,state.z);q.setFromAxisAngle(UP,state.yaw);scale.setScalar(a.height);
    rootMatrix.compose(p,q,scale);
    if(a.parent)rootMatrix.premultiply(a.parent.matrixWorld);
    for(const part of a.parts){
      let [x,y,z]=part.pos,rx=part.rotation,rz=0;
      const left=part.kind.endsWith('L'),sign=left?1:-1;
      if(part.kind.startsWith('leg')){rx+=sign*stride;z+=Math.sin(rx)*.18;y+=Math.abs(Math.sin(rx))*.045;}
      if(part.kind.startsWith('foot')){z+=Math.sin(sign*stride)*.35;y+=Math.max(0,-Math.sin(sign*stride))*.11;}
      if(part.kind.startsWith('arm')||part.kind.startsWith('hand')){
        const hand=part.kind.startsWith('hand');
        if(a.pose==='carry'){z-=hand?.25:.12;y+=hand?.14:.03;rx=-.52;}
        else if(a.pose==='pole'){y+=left?(hand?.37:.16):0;rx=left?-1.12:0;}
        else if(a.pose==='boat'){z-=.12;rx=-.37+Math.sin(time*1.45+a.phase)*.2;y+=hand?.12:0;}
        else if(a.pose==='talk'&&left){rx=-.65+Math.sin(time*1.8+a.phase)*.17;y+=hand?.14:0;z-=hand?.15:.07;}
        else if(a.pose==='lean'){rx=-.9;z-=hand?.23:.12;y+=hand?.2:.06;}
        else{rx=-sign*stride*.7;z+=Math.sin(rx)*.13;}
      }
      if(a.pose==='sit'){
        if(part.kind.startsWith('leg')){rx=-1.2;y-=.1;z-=.1;}
        else if(part.kind.startsWith('foot')){y-=.04;z-=.27;}
        else y-=.15;
      }
      if(part.kind==='oar'){rx=.24+Math.sin(time*1.45+a.phase)*.14;rz=-.15;z+=Math.sin(time*1.45+a.phase)*.12;}
      p.set(x,y,z);scale.set(...part.size);e.set(rx,0,rz);q.setFromEuler(e);partMatrix.compose(p,q,scale);
      m.multiplyMatrices(rootMatrix,partMatrix);mesh.setMatrixAt(part.idx,m);
    }
  }
  mesh.instanceMatrix.needsUpdate=true;
}
export function peopleDiagnostics(){
  if(routeAudit)return routeAudit;
  const walking=actors.filter(a=>a.route),collisions=[];
  for(const actor of walking)for(let i=0;i<=100;i++){
    const point=routePoint({...actor,offset:0},i*actor.route.len/100/actor.speed);
    for(const c of audit.colliders)if(Math.abs(point.x-c.x)<c.w/2+.17&&Math.abs(point.z-c.z)<c.d/2+.17){collisions.push({type:c.type,x:point.x,z:point.z});break;}
  }
  routeAudit={total:actors.length,walking:walking.length,static:actors.length-walking.length,routeCollisions:collisions.slice(0,12),routeCollisionCount:collisions.length};
  return routeAudit;
}
