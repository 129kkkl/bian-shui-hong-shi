import { world as b, Blocks, C, rnd, pick, tint, sign, footprint, audit, pot, basket, crate, sack, stool, table } from './geometry.js';

export const GROUND=1.72;
export const peopleSpots=[];
export const foliage=new Blocks(),lanterns=[],smokeSources=[];
export function deckAt(x) {
  const clamped=Math.min(13,Math.max(-13,x));
  const step=.4, sample=Math.min(12.8,Math.max(-12.8,Math.round(clamped/step)*step));
  return 1.76+5.25*(1-Math.pow(sample/13,2));
}
function archAt(x){return 1.75+5.25*(1-(x/13)**2);}
function quayX(z,side){return side*(9.6+(Math.abs(z)>22?.6:Math.abs(z)>13?.05:Math.abs(z)>7?.4:0));}

export function terrain(){
  // A stepped cutaway plinth keeps the miniature legible from every side.
  b.box(0,-1.45,0,68,.55,60,'#b4ab8d');
  b.box(0,-1.76,0,67.3,.14,59.3,'#a69c7c');
  b.box(0,-.83,0,67.7,.7,59.7,'#c6bc9b');
  b.box(0,-.35,0,67.5,.25,59.5,'#9da38a');
  for(const side of [-1,1]){
    for(let z=-29;z<30;z+=2){
      const edge=Math.abs(quayX(z,side)); const width=34-edge;
      b.box(side*(edge+width/2),.35,z,width,2.68,2,C.dirt);
      b.box(side*(edge+width/2),1.62,z,width,.18,2,tint(C.dirt,rnd(-.025,.025)));
      // Large, staggered stone blocks on the waterfront.
      for(let row=0;row<4;row++){
        const zz=z+(row%2?.28:0);
        b.box(side*(edge+.06),.13+row*.4,zz,.52,.36,1.89,pick([C.stone,C.stoneLight,'#969f89']));
      }
      b.box(side*(edge+.08),1.65,z,.7,.2,1.97,C.stoneLight);
      if(Math.abs(z)>7 && rnd()<.6) b.box(side*(edge-.22),.3,z,.14,.18,.65,'#829781');
    }
    // Broad bridge approach and two continuous waterfront promenades.
    b.box(side*22,1.728,0,24,.055,5.35,'#c3b696');
    b.box(side*12.3,1.732,0,3.0,.06,57,'#c6bb9b');
    for(let x=14;x<33;x+=.91)for(let z=-2.1;z<2.4;z+=.7){
      if(rnd()>.17)b.box(side*(x+rnd(-.05,.05)),1.771,z+(Math.round(x)%2?.13:0),rnd(.58,.82),.045,.55,pick(['#b9b093','#cfc4a3','#bdb699','#d0c3a2']));
    }
    for(const segment of [[-27,-5],[5,27]])for(let z=segment[0];z<segment[1];z+=.82)for(let x=11.2;x<13.5;x+=.75){
      if(rnd()>.25)b.box(side*x,1.775,z,.58,.05,.62,pick(['#b9b093','#c5bc9c','#d0c3a2']));
    }
    // Peripheral dirt and grass patches, away from the walking lanes.
    for(let i=0;i<230;i++){
      const x=side*rnd(14.8,33.4),z=rnd(-29.3,29.3);
      if(Math.abs(z)<3)continue;
      b.box(x,1.74,z,rnd(.18,.8),.045,rnd(.2,.8),pick(['#bcb38b','#b2b18a','#b7ac84','#c6ba91']));
    }
  }
  // Stone bridge abutments: no supports intrude into the navigation channel.
  for(const side of [-1,1]){
    for(let row=0;row<3;row++)for(let iz=0;iz<6;iz++) b.box(side*12.55,.12+row*.48,(iz-2.5)*1.22,2.8,.45,1.17,pick([C.stone,C.stoneLight]));
    b.box(side*12.7,1.57,0,2.8,.28,7.55,'#b5b49a');
  }
}

export function bridge(){
  // Timber chord families form a continuous polygonal arch. Every deck bearer
  // joins an arch rib; transoms and diagonal ties bind the full bridge width.
  for(const z of [-3.06,-2.10,0,2.10,3.06]){
    for(let x=-13;x<12.99;x+=1.625){
      const nx=Math.min(13,x+1.625);
      b.beam([x,archAt(x)-.84,z],[nx,archAt(nx)-.84,z],.31,.32,C.timber);
      if(Math.abs(z)>2.9){
        b.beam([x-.12,archAt(x)-.46,z],[nx+.12,archAt(nx)-.46,z],.23,.28,C.woodLight);
        b.box(x,archAt(x)-.72,z,.17,.8,.42,C.wood,0,0,Math.atan(-10.5*x/169));
        b.box(x,archAt(x)-.58,z+Math.sign(z)*.23,.14,.14,.06,'#d0a96d');
      }
    }
  }
  for(let x=-12.35;x<12.5;x+=1.3){
    const y=archAt(x);
    b.box(x,y-.76,0,.25,.25,6.7,C.wood);
    for(const z of [-2.1,0,2.1])b.box(x,y-.38,z,.22,.65,.22,C.woodDark);
    if(x<10.8){
      b.beam([x,y-.67,-2.8],[x+1.3,archAt(x+1.3)-.67,2.8],.13,.13,C.woodDark);
      b.beam([x,y-.67,2.8],[x+1.3,archAt(x+1.3)-.67,-2.8],.13,.13,C.woodDark);
    }
  }
  for(let i=-32;i<=32;i++){
    const x=i*.4,y=deckAt(x);
    b.box(x,y-.075,0,.391,.15,7.18,pick(['#b48a59','#bb9261','#a77b4e','#c09969']));
    // Dark timber fasteners at the edge of each individual plank.
    for(const z of [-3.12,3.12])b.box(x,y+.006,z,.055,.018,.055,C.woodDark);
  }
  for(const z of [-3.48,3.48])for(let i=0;i<=20;i++){
    const x=-13+i*1.3,y=deckAt(x);
    b.box(x,y+.49,z,.17,1.06,.17,C.woodDark);
    b.box(x,y+1.04,z,.24,.12,.24,C.woodLight);
    if(i<20){for(const yy of [.32,.83]) b.beam([x,y+yy,z],[x+1.3,deckAt(x+1.3)+yy,z],.11,.12,C.wood);}
  }
  // Posts and small banners mark the entrances without obscuring the arch.
  for(const x of [-13.5,13.5])for(const z of [-3.65,3.65]){
    b.box(x,3.02,z,.23,2.6,.23,C.woodDark);b.box(x,4.38,z,.32,.15,.32,C.woodLight);
    b.box(x,3.8,z,.5,.65,.5,C.cream);b.box(x,4.15,z,.63,.1,.63,C.woodDark);b.box(x,3.43,z,.54,.09,.54,C.red);
    lanterns.push({x:x+Math.sign(x)*.3,y:3.8,z:z+Math.sign(z)*.34,size:1.25});
  }
  const kinds=['fruit','cloth','tea','pottery','fish','greens','grain','cloth'];
  const positions=[[-8.6,-2.5],[-3.2,-2.5],[2.2,-2.5],[7.5,-2.5],[-7,2.5],[-1.8,2.5],[3.5,2.5],[8.6,2.5]];
  positions.forEach(([x,z],i)=>{
    marketStall(x,z,2.35,1.16,kinds[i],z>0?Math.PI:0,deckAt(x),true,i!==4);
    peopleSpots.push({x:x+.05,z:z+(z>0?.74:-.74),y:deckAt(x),yaw:z>0?0:Math.PI,role:'vendor',pose:i%2?'talk':'stand'});
  });
  audit.bridge={span:26,width:7.18,crown:deckAt(0),bank:GROUND,navigationHalfWidth:7.6,centerUnderside:archAt(0)-1.02,marketCount:8,clearWalkwayWidth:3.05};
}

function roof(w,d,y,rise,hip=true,col=C.roof){
  const halfW=w/2+.58,halfD=d/2+.58,cell=.38;
  const ridgeHalf=Math.max(.5,halfW-halfD*.72);
  for(let z=-halfD+cell/2;z<halfD;z+=cell)for(let x=-halfW+cell/2;x<halfW;x+=cell){
    let slope=Math.abs(z)/halfD;
    if(hip)slope=Math.max(slope,Math.max(0,Math.abs(x)-ridgeHalf)/(halfW-ridgeHalf));
    const curl=Math.max(0,(slope-.79)/.21)*.16;
    const yy=y+Math.round((rise*(1-slope)+curl)/.12)*.12;
    b.box(x,yy,z,cell,.14,cell,tint(col,rnd(-.035,.025)));
    if(Math.round((x+halfW)/cell)%2===0)b.box(x,yy+.09,z,.07,.065,cell,tint(col,.055));
  }
  const ridgeW=hip?ridgeHalf*2:w+.7;
  b.box(0,y+rise+.12,0,ridgeW,.2,.27,tint(col,.10));
  b.box(0,y+rise+.24,0,ridgeW+.2,.1,.18,tint(col,.14));
  for(const s of [-1,1]){
    b.box(s*(ridgeW/2+.11),y+rise+.27,0,.25,.3,.28,col);
    b.box(s*(ridgeW/2+.23),y+rise+.43,0,.21,.18,.22,col);
    // Small upturned, stepped eave corners.
    for(const zz of [-1,1]){
      b.box(s*(halfW-.1),y+.26,zz*(halfD-.1),.35,.22,.35,tint(col,.04));
      b.box(s*(halfW+.05),y+.37,zz*(halfD+.02),.2,.16,.22,col);
    }
  }
  for(const s of [-1,1])b.box(0,y-.08,s*(d/2+.45),w+.9,.16,.15,C.woodDark);
}

export function building(x,z,{w=6,d=5,h=3.2,rot=0,name='商铺',type='grain',floors=1,wall=C.plaster,roofColor=C.roof,hip=true,awning=true}={}){
  footprint(x,z,w,d,rot,'building');audit.buildings.push({x,z,w,d,rot,name,floors});
  b.at(x,GROUND,z,rot,()=>{
    b.box(0,.13,0,w+.3,.26,d+.28,C.stone);
    b.box(0,.3,0,w,.15,d,C.woodDark);
    b.box(0,h/2+.3,-d/2+.12,w,h,.22,wall);
    for(const s of [-1,1]){
      b.box(s*(w/2-.12),h/2+.3,0,.24,h,d,wall);
      b.box(s*(w/2-.06),h/2+.3,d*.28,.16,h,.16,C.wood);
      // Exposed post-and-beam frames and lattice windows on the side walls.
      // These make the shops readable from the river and from the rear lanes.
      for(const zz of [-d/2+.08,0,d/2-.08])b.box(s*(w/2+.012),h/2+.3,zz,.1,h,.15,C.wood);
      b.box(s*(w/2+.018),h+.14,0,.12,.17,d,C.woodDark);
      b.box(s*(w/2+.026),.87,0,.09,.1,d,C.woodLight);
      b.box(s*(w/2+.026),.37,0,.1,.19,d,C.wood);
      for(const zz of [-d*.27,d*.25]){
        b.box(s*(w/2+.04),1.98,zz,.075,1.04,1.02,'#62756b');
        b.box(s*(w/2+.1),1.43,zz,.26,.12,1.18,C.woodLight);
        b.box(s*(w/2+.1),2.54,zz,.18,.10,1.13,C.woodDark);
        for(let k=-2;k<=2;k++)b.box(s*(w/2+.1),1.98,zz+k*.2,.07,1.02,.055,C.woodLight);
        for(const yy of [1.65,2.05,2.4])b.box(s*(w/2+.12),yy,zz,.06,.055,1.04,C.woodLight);
      }
      for(let zz=-d/2+.35;zz<d/2;zz+=.65)b.box(s*(w/2+.045),.56,zz,.08,.26,.59,'#b2ae92');
      b.beam([s*(w/2+.08),h-.08,-d/2+.08],[s*(w/2+.08),h-.57,-d/2+.64],.11,.11,C.wood);
      b.beam([s*(w/2+.08),h-.08,d/2-.08],[s*(w/2+.08),h-.57,d/2-.64],.11,.11,C.wood);
    }
    // Back doors, shutters and shallow stone steps lead into the service lanes.
    b.box(0,1.2,-d/2-.03,1.02,1.8,.09,C.wood);
    for(const xx of [-.51,0,.51])b.box(xx,1.2,-d/2-.09,.07,1.87,.06,C.woodDark);
    b.box(0,.27,-d/2-.3,1.36,.17,.65,C.stoneLight);
    for(const xx of [-w*.3,w*.3]){
      b.box(xx,1.95,-d/2-.04,1.0,1.0,.07,'#6b7b6e');
      for(let k=-2;k<=2;k++)b.box(xx+k*.19,1.95,-d/2-.10,.05,1.08,.06,C.woodLight);
      for(const yy of [1.46,1.95,2.46])b.box(xx,yy,-d/2-.11,1.12,.07,.06,C.woodLight);
    }
    b.box(0,h+.15,-d/2-.06,w,.17,.11,C.woodDark);
    for(const xx of [-w/2,0,w/2])b.box(xx,h/2+.31,-d/2-.065,.14,h,.12,C.wood);
    // Open shopfront, counter and storage inside the shaded room.
    b.box(0,.6,d/2-.1,w,.63,.2,C.wood);
    for(let xx=-w/2+.12;xx<=w/2;xx+=w/3){
      b.box(xx,h/2+.32,d/2,.19,h+.35,.19,C.woodDark);
      b.box(xx,h-.03,d/2+.02,.42,.17,.31,C.woodLight);
      b.beam([xx,h-.1,d/2],[xx+.36,h-.43,d/2],.1,.1,C.woodLight);
    }
    b.box(0,h+.25,d/2,w+.16,.25,.23,C.woodDark);
    b.box(0,.95,d/2+.21,w*.87,.13,.7,C.woodLight);
    for(const xx of [-w*.31,w*.31]){
      b.box(xx,h*.6,-d/2+.26,w*.18,h*.36,.045,'#72765e');
      for(let k=-1;k<=1;k++)b.box(xx+k*w*.045,h*.6,-d/2+.30,.055,h*.39,.045,C.woodDark);
    }
    for(const xx of [-w*.3,0,w*.3])goods(type,xx,1.03,d/2+.2,.75);
    for(let i=0;i<3;i++){crate(b,-w*.32+i*.75,.35,-d*.26,.55);sack(b,w*.29,.35,-d*.15+i*.62,.55);}
    if(floors===2){
      roof(w+.1,d+.2,h+.25,.65,true,roofColor);
      const upper=h+1.05,hh=2.5;
      b.box(0,upper+hh/2,0,w-.5,hh,d-.45,wall);
      for(const s of [-1,1])b.box(s*(w/2-.32),upper+hh/2,d/2-.12,.2,hh,.2,C.wood);
      for(const side of [-1,1])for(let xx=-w/2+.9;xx<w/2;xx+=1.35){
        b.box(xx,upper+1.3,side*(d/2-.2),.89,1.1,.06,'#5b6860');
        for(let k=-1;k<=1;k++)b.box(xx+k*.25,upper+1.3,side*(d/2-.15),.06,1.18,.07,C.woodLight);
        b.box(xx,upper+1.3,side*(d/2-.12),.92,.06,.08,C.woodLight);
      }
      // Upper balcony is shallow and connected to the upper floor.
      b.box(0,upper+.01,d/2+.35,w+.1,.18,1.25,C.wood);
      for(let xx=-w/2;xx<w/2+.1;xx+=.65)b.box(xx,upper+.48,d/2+.9,.09,.9,.09,C.woodDark);
      b.box(0,upper+.91,d/2+.9,w+.2,.11,.12,C.woodLight);
      roof(w,d,upper+hh,1.5,hip,roofColor);
    }else{
      if(!hip)for(let iz=0;iz<8;iz++){
        const yy=h+.28+iz*.17,dd=d*(1-iz/8);
        for(const s of [-1,1])b.box(s*(w/2-.12),yy,0,.22,.18,dd,wall);
      }
      roof(w,d,h+.3,Math.min(1.6,d*.25),hip,roofColor);
    }
    const lx=-w*.34,ly=h-.62,lz=d/2+.54;
    b.box(lx,h-.13,lz-.2,.07,.07,.62,C.woodDark);b.box(lx,h-.28,lz,.045,.32,.045,C.woodDark);
    b.box(lx,ly,lz,.34,.52,.34,'#d7ae6e');
    b.box(lx,ly+.29,lz,.42,.065,.42,C.woodDark);b.box(lx,ly-.29,lz,.4,.065,.4,C.woodDark);
    b.box(lx,ly-.42,lz,.065,.22,.065,C.red);
    lanterns.push({x:x+lx*Math.cos(rot)+(lz+.28)*Math.sin(rot),y:GROUND+ly,z:z-lx*Math.sin(rot)+(lz+.28)*Math.cos(rot),size:1});
    if(['宋家食店','孙记茶坊','汴梁酒肆'].includes(name)){
      const roofY=floors===2?h+5.05:h+.3+Math.min(1.6,d*.25),cx=w*.27,cz=-d*.17;
      b.box(cx,roofY-.2,cz,.38,.95,.4,C.stone);b.box(cx,roofY+.32,cz,.49,.12,.5,C.roofDark);
      smokeSources.push({x:x+cx*Math.cos(rot)+cz*Math.sin(rot),y:GROUND+roofY+.44,z:z-cx*Math.sin(rot)+cz*Math.cos(rot)});
    }
    sign(name,0,h-.12,d/2+.145,Math.min(2.9,w*.6),.64,0,C.woodDark,'#e1cc9b');
    if(awning){
      const ay=h-.65,az=d/2+.93;
      for(let k=0;k<Math.ceil(w/.42);k++)b.box(-w/2+k*.42+.21,ay,az,.43,.08,1.8,k%4===0?tint(C.cream,-.055):C.cream,.12);
      b.box(0,ay-.22,d/2+1.83,w,.35,.09,C.cream);
      for(const s of [-1,1]){b.box(s*(w/2-.1),(ay-.2)/2,d/2+1.75,.095,ay-.2,.095,C.wood);}
    }
    // A banner hangs from a visible bracket.
    b.box(w/2+.25,h-.1,d/2+.7,.09,1.1,.09,C.woodDark);
    b.box(w/2+.25,h+.37,d/2+.46,.1,.09,.85,C.woodDark);
    sign(name.slice(-1),w/2+.25,h-.25,d/2+.77,.52,.97,0,'#cbbd92','#6b5743');
  });
}

function goods(kind,x,y,z,s=1){
  if(kind==='fruit'||kind==='greens'||kind==='grain')basket(b,x,y,z,s*.75,kind==='grain'?'rice':kind);
  else if(kind==='pottery'){pot(b,x-.25*s,y,z,s*.6,C.red);pot(b,x+.25*s,y,z+.08,s*.43,'#b08a61');}
  else if(kind==='cloth'){
    for(let k=0;k<3;k++){b.box(x,y+.08+k*.13,z,s*.9,.13,s*.6,[C.indigo,C.cream,C.red][k]);b.box(x+s*.41,y+.08+k*.13,z,s*.06,.1,s*.61,tint([C.indigo,C.cream,C.red][k],.12));}
  }else if(kind==='fish'){
    b.box(x,y+.03,z,s,.06,s*.67,'#6e7e74');
    for(let k=0;k<3;k++){
      b.box(x+(k-1)*s*.27,y+.12,z,.14*s,.12*s,.46*s,'#bac5ae');
      b.box(x+(k-1)*s*.27,y+.11,z+.27*s,.24*s,.055,.12*s,'#a1afa2');
      b.box(x+(k-1)*s*.27+.06*s,y+.18,z-.16*s,.045,.025,.04,C.ink);
    }
  }else if(kind==='tea'){
    pot(b,x-.2*s,y,z,s*.43,C.woodDark,false);
    for(let k=0;k<3;k++){b.box(x+.18*s,y+.06,z+(k-1)*s*.22,.17,.12,.17,C.cream);b.box(x+.18*s,y+.126,z+(k-1)*s*.22,.12,.012,.12,'#786346');}
    b.box(x+.4*s,y+.05,z+.05,s*.25,.08,s*.55,C.wood);
  }
}

export function marketStall(x,z,w,d,kind,rot=0,y=GROUND,onBridge=false,covered=true){
  audit.markets[kind]=(audit.markets[kind]||0)+1;
  if(!onBridge)footprint(x,z,w,d,rot,'stall');
  b.at(x,y,z,rot,()=>{
    const slopeLift=onBridge?Math.max(deckAt(x-w/2),deckAt(x+w/2))-y:0;
    const top=.76+slopeLift;
    for(const xx of [-w/2+.12,w/2-.12])for(const zz of [-d/2+.1,d/2-.1]){
      const base=onBridge?deckAt(x+xx*Math.cos(rot))-y:0;
      b.box(xx,(base+top)/2,zz,.11,top-base,.11,C.wood);
    }
    b.box(0,top,0,w,.14,d,C.woodLight);
    b.box(0,top-.24,d/2-.02,w,.36,.08,C.wood);
    for(let i=0;i<3;i++)goods(kind,(i-1)*w*.3,top+.08,0,w*.3);
    if(covered){
      const cloth=kind==='cloth'?C.indigo:kind==='tea'?C.cream:kind==='pottery'?C.gold:kind==='fish'?'#98a99b':kind==='fruit'?C.red:'#b0b18a';
      const high=top+1.55;
      for(const xx of [-w/2+.06,w/2-.06])for(const zz of [-d/2,d/2]){
        const base=onBridge?deckAt(x+xx*Math.cos(rot))-y:0;
        b.box(xx,(base+high-.12)/2,zz,.08,high-.12-base,.08,C.woodDark);
      }
      b.box(0,high,0,w+.26,.08,.13,C.woodDark);
      for(const side of [-1,1])for(let k=0;k<4;k++){
        const zz=side*(k*.21+.1),yy=high-k*.065;
        b.box(0,yy,zz,w+.32,.065,.23,k%3===0?tint(cloth,.06):cloth);
      }
      for(const side of [-1,1])b.box(0,high-.34,side*.82,w+.33,.25,.07,cloth);
      // Tie ropes are visible where the awning corners meet their poles.
      for(const xx of [-w/2,w/2])b.beam([xx,high-.23,.77],[xx,high-.62,d/2],.025,.025,C.cream);
    }
    if(kind==='cloth')for(let k=0;k<3;k++)b.box(-w/2+.28,top+.52+k*.28,-d*.25,.23,.22,.7,[C.red,C.cream,C.indigo][k]);
    if(kind==='pottery')pot(b,w/2+.19,.03,-.1,.55,C.red);
  });
}

function tree(x,z,size=1,willow=false){
  b.at(x,GROUND,z,0,()=>{
    foliage.parent.copy(b.parent);
    b.box(0,1.15*size,0,.4*size,2.3*size,C.woodDark);
    b.beam([0,1.4*size,0],[.85*size,2.9*size,.25*size],.23*size,.25*size,C.wood);
    b.beam([0,1.9*size,0],[-.7*size,3.1*size,-.45*size],.24*size,.24*size,C.wood);
    b.beam([0,1.7*size,0],[.05*size,3.2*size,-.9*size],.2*size,.23*size,C.wood);
    for(let i=0;i<38;i++){
      const xx=rnd(-1.6,1.6)*size,zz=rnd(-1.5,1.5)*size;
      if(xx*xx+zz*zz>2.9*size*size)continue;
      const yy=(3.45-Math.abs(xx/size)*.24-Math.abs(zz/size)*.22+rnd(-.3,.35))*size;
      foliage.box(xx,yy,zz,rnd(.6,1.05)*size,rnd(.45,.9)*size,rnd(.65,1.1)*size,pick([C.leaf,C.leafLight,C.leafDark,'#96aa6b']));
    }
    if(willow)for(let i=0;i<18;i++){
      const a=i*Math.PI*2/18,r=rnd(1.1,1.75)*size;
      for(let j=0;j<rnd(3,7);j++)foliage.box(Math.cos(a)*(r+j*.03),3.05*size-j*.31,Math.sin(a)*(r+j*.03),.19*size,.38,.23*size,pick([C.leaf,C.leafLight,'#9caf71']));
    }
  });
  foliage.parent.identity();
}

function cart(x,z,rotation=0,kind='grain'){
  footprint(x+Math.sin(rotation)*.5,z+Math.cos(rotation)*.5,1.75,3.6,rotation,'cart');
  b.at(x,GROUND,z,rotation,()=>{
    b.box(0,.48,0,1.35,.14,1.8,C.woodLight);
    for(const s of [-1,1]){
      b.box(s*.7,.74,0,.1,.5,1.9,C.wood);
      b.box(s*.5,.4,1.5,.09,.09,1.6,C.woodDark);
      for(let k=0;k<8;k++)b.box(s*.81,.4,0,.12,.74,.1,C.woodDark,k*Math.PI/4);
      b.box(s*.81,.4,0,.18,.16,.16,C.woodLight);
    }
    for(let i=0;i<2;i++)for(let j=0;j<2;j++)if(kind==='grain')sack(b,(i-.5)*.6,.56,(j-.5)*.75,.6);else crate(b,(i-.5)*.6,.56,(j-.5)*.7,.55);
  });
}
export function town(){
  // Both approach streets run east-west. Fronts open toward the street;
  // smaller riverside shops face a separate north-south promenade.
  building(-19.4,-6.1,{w:6.1,d:5.5,h:3.4,name:'赵记布庄',type:'cloth',roofColor:'#617776'});
  building(-27.2,-6.2,{w:6.2,d:5.7,h:3.1,name:'米粮行',type:'grain',hip:false,wall:'#c9b995'});
  building(-19.7,6.7,{w:6.8,d:5.4,h:3.1,rot:Math.PI,name:'宋家食店',type:'tea',roofColor:'#718079'});
  building(-28.0,6.6,{w:6.5,d:5.5,h:3.3,rot:Math.PI,name:'杂货铺',type:'pottery',hip:false,wall:'#cdbf9b'});
  building(19.8,-6.4,{w:6.4,d:5.5,h:3.4,name:'孙记茶坊',type:'tea',floors:2,awning:false,roofColor:'#536e68'});
  building(28.0,-6.1,{w:6.4,d:5.5,h:3.5,name:'绸缎庄',type:'cloth',wall:'#d9c4a0',hip:false});
  building(20.0,6.4,{w:6.3,d:5.2,h:3.2,rot:Math.PI,name:'汴梁酒肆',type:'tea',roofColor:'#667e78',wall:'#d8c9a4'});
  building(28.1,6.5,{w:6.0,d:5.3,h:3.0,rot:Math.PI,name:'果子铺',type:'fruit',hip:false,roofColor:'#7e8575'});
  building(-17.5,-16,{w:7,d:5.2,h:3.0,rot:Math.PI/2,name:'鲜鱼行',type:'fish',roofColor:'#73847b'});
  building(-26.6,-17.0,{w:8.5,d:6.5,h:3.4,name:'顺丰货栈',type:'grain',awning:false,hip:false,wall:'#c2b493'});
  building(-17.5,17.2,{w:6.2,d:5.3,h:3.0,rot:Math.PI/2,name:'陶器铺',type:'pottery',wall:'#dfceaa',roofColor:'#788477'});
  building(-26.7,17.5,{w:8.2,d:6.4,h:3.2,rot:Math.PI,name:'邸店',type:'cloth',awning:false,roofColor:'#6e7c73'});
  building(17.9,-17.2,{w:6.7,d:5.2,h:3.4,rot:-Math.PI/2,name:'河畔客舍',type:'tea',floors:2,awning:false,roofColor:'#7b8372'});
  building(27.1,-17.8,{w:6.7,d:6.4,h:3.1,name:'竹木作',type:'grain',hip:false,awning:false,wall:'#c7b595'});
  building(18.0,17.7,{w:7.1,d:5.2,h:3.4,rot:-Math.PI/2,name:'广济货栈',type:'grain',awning:false,roofColor:'#627870'});
  building(27.6,18.3,{w:7.2,d:6.6,h:3.1,name:'李家院',type:'pottery',rot:Math.PI,awning:false,wall:'#e0cfab',roofColor:'#717b70'});
  // Two small courtyard wings and walled service yards give depth to the blocks.
  building(-29,-25.3,{w:6,d:3.3,h:2.6,rot:Math.PI,name:'柴房',type:'grain',awning:false,hip:false,roofColor:'#849084'});
  building(29,26.7,{w:6.2,d:3.4,h:2.8,rot:Math.PI,name:'后舍',type:'tea',awning:false,hip:false});
  for(const side of [-1,1]){
    b.box(side*23.5,2.25,25.5,.25,1.05,6.5,C.plaster);
    b.box(side*23.5,2.82,25.5,.45,.15,6.6,C.roof);
    b.box(side*27,2.25,28.5,7,.25,.3,C.wood);
    for(let x=24;x<33;x+=1.1)b.box(side*x,2.2,28.5,.11,.95,.12,C.wood);
  }
  const groundStalls=[[-15.0,-1.8,'fruit',0],[-29.6,1.7,'grain',Math.PI],[14.8,2,'pottery',Math.PI],[29.6,-1.7,'cloth',0],[-10.7,9.2,'fish',Math.PI/2],[10.8,-10.5,'greens',-Math.PI/2],[-15.2,-24.4,'grain',0],[15.2,24.1,'fruit',0]];
  for(const [x,z,kind,rot] of groundStalls){marketStall(x,z,2.15,1.2,kind,rot); const dx=-Math.sin(rot)*.96,dz=-Math.cos(rot)*.96;peopleSpots.push({x:x+dx,z:z+dz,y:GROUND,yaw:rot+Math.PI,role:'vendor',pose:'talk'});}
  // A tea terrace on the rear bank, with cups, stools and seated conversations.
  const teaX=-22.0,teaZ=-10.55;
  for(const [dx,dz] of [[0,0],[-4,0]]){
    footprint(teaX+dx,teaZ+dz,3.35,1.45,0,'tea table and stools');
    table(b,teaX+dx,GROUND,teaZ+dz,1.6,1.2);pot(b,teaX+dx,GROUND+.93,teaZ+dz,.3,C.woodDark,false);
    for(const s of [-1,1]){
      stool(b,teaX+dx+s*1.2,GROUND,teaZ+dz,.5);
      b.box(teaX+dx+s*.5,GROUND+.97,teaZ+dz,.17,.15,.17,C.cream);
      peopleSpots.push({x:teaX+dx+s*1.2,z:teaZ+dz,y:GROUND+.37,yaw:s>0?Math.PI/2:-Math.PI/2,role:'customer',pose:'sit'});
    }
  }
  // Goods waiting for the quay porters, always beside the traffic corridor.
  for(const side of [-1,1])for(let i=0;i<5;i++){
    crate(b,side*(14.1+(i%2)*.7),GROUND,12.2+Math.floor(i/2)*.8,.6);
    sack(b,side*(14.1+(i%2)*.65),GROUND,-12.2-Math.floor(i/2)*.7,.58);
  }
  cart(-30.8,26.4,.9);cart(29.7,-24.4,-1.4);cart(-24.8,24.4,2.4,'crate');
  for(const [x,z,s,w] of [[-13.6,26,1.05,true],[-14,-27,1.1,true],[13.8,-26.8,1.15,true],[13.9,27.2,1,true],[-31.8,-11.7,.85,false],[32.2,12,.9,false],[-22.8,26.7,.85,false],[24.2,-25.6,1.1,false],[-31.5,23.7,.7,false]])tree(x,z,s,w);
  // Low reeds and waterside stones stay out of the shipping lane.
  for(const side of [-1,1])for(let i=0;i<36;i++){
    const z=rnd(-28,28);if(Math.abs(z)<7)continue;const x=quayX(z,side)-side*rnd(.3,.7);
    for(let j=0;j<3;j++)b.box(x+j*.08,.4+rnd(0,.16),z+j*.09,.08,rnd(.3,.65),.09,pick(['#839b69','#9daa78','#b1b180']));
  }
  // Hanging laundry in the service yard.
  for(const x of [24.1,29.5])b.box(x,3.0,23.2,.1,2.6,.1,C.woodDark);
  b.beam([24.1,4.2,23.2],[29.5,4.2,23.2],.035,.035,C.woodDark);
  for(let i=0;i<5;i++)b.box(24.8+i*.85,3.65,23.2,.58,.95,.05,[C.cream,C.indigo,'#b8b896',C.red,'#adb8ab'][i]);
}

export function docks(){
  for(const [side,z] of [[1,11.5],[-1,-12]]){
    const x=side*8.6;
    for(const dx of [-1,1])for(const dz of [-1,1]){
      b.box(x+dx*1.25,.35,z+dz*2.8,.3,1.8,.3,C.woodDark);
      b.box(x+dx*1.25,1.3,z+dz*2.8,.38,.14,.38,C.woodLight);
    }
    for(let j=-7;j<=7;j++)b.box(x,1.05,z+j*.4,2.85,.16,.385,pick([C.wood,C.woodLight,'#ac8155']));
    b.box(x,.86,z,2.9,.2,5.95,C.woodDark);
    for(let i=0;i<5;i++)b.box(side*(9.1+i*.35),1.13+i*.13,z+.4,.37,.18,1.5,C.stoneLight);
    b.beam([side*7.35,1.23,z-2.8],[side*6.2,.95,z-1.8],.03,.03,C.cream);
    b.beam([side*7.5,1.14,z+.75],[side*6.72,.94,z+.75],.1,.65,C.woodLight);
    for(let i=0;i<3;i++)crate(b,x+.3*side,1.16,z-1.6+i*.62,.5);
    basket(b,x-.5*side,1.16,z+2,.48,null);
    peopleSpots.push({x:x-.3*side,z:z+1.35,y:1.15,yaw:side*Math.PI/2,role:'porter',pose:'carry'});
    peopleSpots.push({x:side*10.7,z:z+.4,y:GROUND,yaw:side*Math.PI/2,role:'porter',pose:'talk'});
    audit.docks.push({side,z,deckY:1.15,innerEdge:7.175,stepCount:5});
  }
  // Smaller fisherman landing with a matching descending stair.
  for(let i=0;i<6;i++)b.box(-10.2+i*.22,1.6-i*.16,20.6,.24,.2,2.4,C.stoneLight);
  b.box(-9.3,.66,20.6,1.0,.14,3,C.wood);
  for(const z of [19.2,22])b.box(-9.25,.41,z,.19,1.2,.19,C.woodDark);
  b.box(-8.73,.77,21.8,.72,.1,.58,C.woodLight);
}
