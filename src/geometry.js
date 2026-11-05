import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  wood: '#926444', woodLight: '#b78a5b', woodDark: '#584839', timber: '#71523b',
  plaster: '#d7c9a6', plasterLight: '#e5d8b8', stone: '#a4ab91', stoneLight: '#b6b79c',
  paving: '#c4b994', earth: '#b4a982', dirt: '#d0bd94', roof: '#647570', roofDark: '#4b605c',
  red: '#b4644c', cream: '#ddd0a0', indigo: '#617e83', green: '#81936a', gold: '#c59c55',
  leaf: '#869b66', leafLight: '#a8b97d', leafDark: '#607f5b', water: '#80ada3', ink: '#344d46'
};
export const UP = new THREE.Vector3(0, 1, 0);
export const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
export const solidMaterial = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, flatShading: true });
export const audit = { colliders: [], markets: {}, buildings: [], bridge: {}, docks: [], paths: [] };
let seed = 82431;
export function rnd(a = 0, b = 1) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + seed / 4294967296 * (b - a); }
export function pick(a) { return a[Math.floor(rnd(0, a.length))]; }
const colorCache = new Map();
export function color(c) { if (!colorCache.has(c)) colorCache.set(c, new THREE.Color(c)); return colorCache.get(c); }
export function tint(c, amount) { return color(c).clone().offsetHSL(0, 0, amount).getHex(); }
export class Blocks {
  constructor() { this.items = []; this.parent = new THREE.Matrix4(); this.stack = []; }
  box(x,y,z,w,h,d,c,rx=0,ry=0,rz=0) {
    if (h <= 0 || w <= 0 || d <= 0) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)), new THREE.Vector3(w,h,d));
    m.premultiply(this.parent);
    this.items.push({ m, c });
  }
  beam(a,b,w,d,c) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), v = q.clone().sub(p);
    const m = new THREE.Matrix4().compose(p.add(q).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(UP,v.clone().normalize()), new THREE.Vector3(w,v.length(),d));
    m.premultiply(this.parent); this.items.push({ m,c });
  }
  at(x,y,z,rotation,fn) { this.stack.push(this.parent.clone()); this.parent.multiply(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromAxisAngle(UP,rotation),new THREE.Vector3(1,1,1))); fn(); this.parent = this.stack.pop(); }
  finish(parent, name='体素建筑', options={}) {
    const material = options.material || solidMaterial;
    const mesh = new THREE.InstancedMesh(cubeGeometry, material, this.items.length);
    this.items.forEach((v,i) => { mesh.setMatrixAt(i,v.m); mesh.setColorAt(i,color(v.c)); });
    mesh.castShadow = options.castShadow !== false; mesh.receiveShadow = true;
    mesh.name = name; mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }
}
export const world = new Blocks();
export const fixtures = new THREE.Group();
fixtures.name = '招牌与布幌';
export function footprint(x,z,w,d,rotation,type) {
  const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));
  audit.colliders.push({ x,z,w:w*c+d*s,d:w*s+d*c,type });
}
const signTiles = new Map(), signRecords = [];
export function sign(text,x,y,z,w,h,rotation=0,bg='#5d5142',fg='#e5d6af') {
  const key=text+bg+fg;
  if(!signTiles.has(key))signTiles.set(key,{text,bg,fg});
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,rotation),new THREE.Vector3(1,1,1));
  matrix.premultiply(world.parent);
  signRecords.push({key,w,h,matrix});
}
export function finishSigns(parent=fixtures){
  if(!signRecords.length)return null;
  const tiles=[...signTiles.values()],columns=Math.min(4,tiles.length),rows=Math.ceil(tiles.length/columns);
  const canvas=document.createElement('canvas');canvas.width=columns*512;canvas.height=rows*256;
  const ctx=canvas.getContext('2d');
  tiles.forEach((tile,i)=>{
    const x=(i%columns)*512,y=Math.floor(i/columns)*256;
    signTiles.set(tiles[i].text+tiles[i].bg+tiles[i].fg,i);
    ctx.fillStyle=tile.bg;ctx.fillRect(x,y,512,256);
    ctx.strokeStyle=tile.fg+'88';ctx.lineWidth=4;ctx.strokeRect(x+12,y+12,488,232);
    ctx.fillStyle=tile.fg;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`bold ${Math.min(128,410/tile.text.length)}px "KaiTi","STKaiti","SimSun",serif`;
    ctx.fillText(tile.text,x+256,y+132,448);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const geometries=signRecords.map(record=>{
    const geometry=new THREE.PlaneGeometry(record.w,record.h),uv=geometry.attributes.uv;
    const tile=signTiles.get(record.key),u0=(tile%columns)/columns,u1=(tile%columns+1)/columns;
    const v1=1-Math.floor(tile/columns)/rows,v0=1-(Math.floor(tile/columns)+1)/rows;
    for(let i=0;i<uv.count;i++)uv.setXY(i,u0+uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));
    return geometry.applyMatrix4(record.matrix);
  });
  const geometry=mergeGeometries(geometries,false);geometries.forEach(item=>item.dispose());
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,roughness:1,side:THREE.DoubleSide}));
  mesh.name='市井招幌 · 纹理图集合批';mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  audit.signs={instances:signRecords.length,tiles:tiles.length,drawCalls:1};signRecords.length=0;
  return mesh;
}
export function pot(b,x,y,z,s=.55,col=C.red,open=true) {
  b.box(x,y+s*.12,z,s*.52,s*.24,s*.52,col);
  b.box(x,y+s*.42,z,s*.78,s*.38,s*.78,col);
  b.box(x,y+s*.68,z,s*.62,s*.16,s*.62,tint(col,.035));
  b.box(x,y+s*.79,z,s*.4,s*.12,s*.4,col);
  if(open) { b.box(x,y+s*.853,z,s*.26,.015,s*.26,C.woodDark); } else { b.box(x,y+s*.89,z,s*.46,s*.07,s*.46,C.cream); }
}
export function basket(b,x,y,z,s=.6,goods='fruit') {
  b.box(x,y+s*.21,z,s,s*.42,s,C.woodLight);
  for(let i=0;i<4;i++) b.box(x,y+s*(.08+i*.1),z,s+.025,.035,s+.025,tint(C.woodLight,.06));
  b.box(x,y+s*.425,z,s*.86,.025,s*.86,C.woodDark);
  if(goods) for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const c=goods==='fruit'?pick(['#c89b44','#d7af54','#bd7e3f']):goods==='greens'?pick(['#69834c','#92a75e','#a8b76c']):C.cream;
    b.box(x+(i-1)*s*.23,y+s*.51+rnd(0,.05),z+(j-1)*s*.23,s*.19,s*.18,s*.19,c,0,rnd(-.2,.2));
  }
}
export function crate(b,x,y,z,s=.65) {
  b.box(x,y+s*.45,z,s,s*.9,s,C.woodLight);
  for(const t of [-1,1]) {
    b.box(x+t*s*.39,y+s*.45,z,s*.085,s*.93,s+.03,C.wood);
    b.box(x,y+s*.45,z+t*s*.39,s+.03,s*.93,s*.085,C.wood);
  }
  b.box(x,y+s*.91,z,s*.13,.035,s,C.wood);
}
export function sack(b,x,y,z,s=.65,col='#c6bd8c') {
  b.box(x,y+s*.18,z,s*.78,s*.36,s*.62,col,0,.08);
  b.box(x,y+s*.49,z,s*.64,s*.28,s*.56,tint(col,.025));
  b.box(x,y+s*.68,z,s*.22,s*.12,s*.22,C.wood);
}
export function stool(b,x,y,z,s=.5) {
  for(const dx of [-1,1])for(const dz of [-1,1])b.box(x+dx*s*.31,y+s*.35,z+dz*s*.31,.08,s*.7,.08,C.woodDark);
  b.box(x,y+s*.74,z,s,.11,s,C.woodLight);
}
export function table(b,x,y,z,w=1.5,d=1) {
  for(const dx of [-1,1])for(const dz of [-1,1])b.box(x+dx*(w/2-.12),y+.39,z+dz*(d/2-.12),.13,.78,.13,C.wood);
  b.box(x,y+.84,z,w,.14,d,C.woodLight);
}
