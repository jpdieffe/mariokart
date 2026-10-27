import * as T from './vendor/three/three.module.min.js';
import {TERRAIN,PADS,PICKUPS,COLORS,SIZE,heightOn,floorAt,angleDelta} from './arena-world.js';

export class ArenaRenderer {
  constructor(container){
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0x9ddce1);this.renderer.outputColorSpace=T.SRGBColorSpace;
    container.append(this.renderer.domElement);this.container=container;
    this.scene=new T.Scene();this.scene.fog=new T.Fog(0x9ddce1,220,440);
    this.scene.add(new T.HemisphereLight(0xfff8de,0x546c73,1.7));
    const light=new T.DirectionalLight(0xfff2cc,1.6);light.position.set(-60,100,40);this.scene.add(light);
    this.camera=new T.PerspectiveCamera(58,1,.2,420);this.camera.position.set(100,112,135);
    this.aim=new T.Vector3();this.followAngle=null;this.materials=new Map();this.textures=[];this.karts=[];this.boxes=[];this.shots=new Map();this.lastTime=0;
    this.buildArena();for(let i=0;i<6;i++)this.karts.push(this.buildKart(i));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  mat(color){if(!this.materials.has(color))this.materials.set(color,new T.MeshLambertMaterial({color}));return this.materials.get(color);}
  mesh(geometry,color,parent=this.scene){const m=new T.Mesh(geometry,this.mat(color));parent.add(m);return m;}
  box(x,y,z,w,h,d,color,parent){const m=this.mesh(new T.BoxGeometry(w,h,d),color,parent);m.position.set(x,y,z);return m;}
  ball(x,y,z,r,color,parent){const m=this.mesh(new T.SphereGeometry(r,12,8),color,parent);m.position.set(x,y,z);return m;}
  label(text,color='#173c36',bg='#fff2ce'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');
    c.fillStyle=bg;c.fillRect(0,0,512,128);c.fillStyle=color;c.font='900 62px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,66);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);
    return new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
  }
  buildArena(){
    this.box(0,-2.2,0,180,4,180,0x447b78);this.box(0,-.12,0,176,.24,176,0xe4d3b3);
    // Courtyard pavers and perimeter stripes make scale and movement readable.
    for(let i=-80;i<=80;i+=10){this.box(i,.015,0,.12,.03,176,0xc9bfa6);this.box(0,.015,i,176,.03,.12,0xc9bfa6);}
    for(let i=-84;i<=84;i+=8){for(const [x,z] of [[i,-88],[i,88],[-88,i],[88,i]])this.box(x,1,z,5,2,3,(i/8)%2?0xf5f0d6:0x305d68);}
    for(const t of TERRAIN){
      if(!t.axis){this.box(t.x+t.w/2,t.h/2,t.z+t.d/2,t.w,t.h,t.d,t.color);this.box(t.x+t.w/2,t.h+.025,t.z+t.d/2,t.w,.05,t.d,t.id==='sky'?0xf9d679:0x7bc7b5);
        // Colored fascia on vertical walls makes the three storeys unambiguous.
        for(const dy of [t.h-.8,t.h-1.25])this.box(t.x+t.w/2,dy,t.z+t.d/2,t.w+.06,.16,t.d+.06,0xffefcb);
      }else{
        const corners=[[t.x,t.z],[t.x+t.w,t.z],[t.x+t.w,t.z+t.d],[t.x,t.z+t.d]];
        const vertices=corners.map(([x,z])=>[x,heightOn(t,x,z)+.03,z]).concat(corners.map(([x,z])=>[x,0,z]));
        const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));geom.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);geom.computeVertexNormals();this.mesh(geom,t.color);
        // Upward arrows lie exactly on the ramp plane.
        const angle=t.axis==='x'?(t.end>t.h?Math.PI/2:-Math.PI/2):(t.end>t.h?0:Math.PI);
        for(const f of [.2,.45,.7]){
          const x=t.x+t.w*(t.axis==='x'?f:.5),z=t.z+t.d*(t.axis==='z'?f:.5),shape=new T.Shape();
          shape.moveTo(0,-2);shape.lineTo(2,1);shape.lineTo(.8,1);shape.lineTo(.8,3);shape.lineTo(-.8,3);shape.lineTo(-.8,1);shape.lineTo(-2,1);shape.closePath();
          const arrow=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0xfff3d1,side:T.DoubleSide}));arrow.rotation.x=-Math.PI/2;arrow.rotation.z=angle;
          // Transform vertices into world space and lift them onto the slope.
          arrow.updateMatrix();arrow.geometry.applyMatrix4(arrow.matrix);arrow.rotation.set(0,0,0);
          const pos=arrow.geometry.attributes.position;for(let j=0;j<pos.count;j++){const ax=x+pos.getX(j),az=z+pos.getZ(j);pos.setXYZ(j,ax,heightOn(t,ax,az)+.1,az);}pos.needsUpdate=true;this.scene.add(arrow);
        }
      }
    }
    for(const p of PADS){const pad=this.box(p.x,p.y+.08,p.z,6,.15,4,0xea697e);for(let i=-1;i<=1;i++)this.box(p.x+i*1.7,p.y+.17,p.z,.65,.05,3,0xffedb4);pad.rotation.y=p.angle;}
    // Noncolliding decoration is outside the driving boundary.
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=112;this.box(Math.sin(a)*r,3,Math.cos(a)*r,1.4,6,1.4,0x8b6b51);this.ball(Math.sin(a)*r,8,Math.cos(a)*r,5, i%2?0x558b66:0x6caa74);}
    for(const [x,z] of [[-39,-33],[39,-33],[-39,33],[39,33]]){this.box(x,12,z,.3,10,.3,0xf9edcd);this.box(x+2,16,z,4,2.4,.15,0xf3c255);}
    const sign=new T.Mesh(new T.PlaneGeometry(20,5),this.label('SKY PLAZA'));sign.position.set(0,22,-24);this.scene.add(sign);
    for(const x of [-9,9])this.box(x,17,-24,.3,10,.3,0xf9edcd);
    const question=this.label('?','#fff5d4','#3e8ac5');
    for(const p of PICKUPS){
      const group=new T.Group(),cube=new T.Mesh(new T.BoxGeometry(2.8,2.8,2.8),question);group.add(cube);group.position.set(p.x,p.y+2,p.z);this.scene.add(group);this.boxes.push(group);
      this.box(p.x,p.y+.04,p.z,4.8,.08,4.8,0x376c7f);
    }
    this.effectMeshes=Array.from({length:24},()=>{const m=this.mesh(new T.IcosahedronGeometry(1,0),0xffcf5b);m.visible=false;return m;});
  }
  buildKart(id){
    const g=new T.Group();this.scene.add(g);const color=COLORS[id];
    this.box(0,.65,0,2.3,.65,3.4,color,g);this.box(0,.95,1,1.8,.35,1.3,0xf8e6bb,g);this.box(0,.6,1.9,2.5,.25,.3,0x5a6773,g);
    for(const x of [-1.25,1.25])for(const z of [-1.05,1.05]){const wheel=this.mesh(new T.CylinderGeometry(.6,.6,.45,10),0x253743,g);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.55,z);this.ball(x*1.04,.55,z,.24,0xa0b3b8,g);}
    this.box(0,1.25,-.4,1.1,1,.8,0x3155a0,g);this.ball(0,2.08,-.25,.62,0xffcea1,g);this.ball(0,2.35,-.3,.65,color,g);this.box(0,2.22,.2,1.05,.18,.7,color,g);this.ball(0,1.92,.33,.24,0xe4aa7b,g);this.box(0,1.78,.38,.7,.14,.15,0x493e36,g);
    const balloons=[];for(let i=0;i<3;i++){const x=(i-1)*1.4,y=4.4+(i%2)*.6;const b=this.ball(x,y,-1, .7,color,g);b.scale.y=1.2;const string=this.box(x,y-1.2,-1,.025,1.7,.025,0xf6e1bd,g);balloons.push([b,string]);}
    const shadow=new T.Mesh(new T.CircleGeometry(1.8,16),new T.MeshBasicMaterial({color:0x223c42,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;this.scene.add(shadow);
    return {g,balloons,shadow,position:new T.Vector3(),angle:0,initialized:false};
  }
  resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  render(state,player,dt,overview=false){
    const alpha=1-Math.exp(-dt*18);
    for(const k of state.karts){const m=this.karts[k.id];m.g.visible=k.active&&k.hp>0;if(!m.initialized||Math.hypot(m.position.x-k.x,m.position.z-k.z)>22){m.position.set(k.x,k.y,k.z);m.angle=k.angle;m.initialized=true;}else{m.position.lerp(new T.Vector3(k.x,k.y,k.z),alpha);m.angle+=angleDelta(k.angle,m.angle)*alpha;}
      m.g.position.copy(m.position);m.g.rotation.y=m.angle;m.g.rotation.z=Math.sin(state.time*32)*Math.min(k.inv,.8)*.06;
      m.balloons.forEach((pair,i)=>pair.forEach(o=>o.visible=i<k.hp));m.shadow.visible=m.g.visible;m.shadow.position.set(m.position.x,floorAt(m.position.x,m.position.z)+.06,m.position.z);
    }
    this.boxes.forEach((g,i)=>{g.visible=state.pickups[i].ready;g.rotation.y=state.time;g.position.y=PICKUPS[i].y+2+Math.sin(state.time*2+i)*.3;});
    const ids=new Set(state.shots.map(s=>s.id));for(const[id,m]of this.shots)if(!ids.has(id)){this.scene.remove(m);m.geometry.dispose();this.shots.delete(id);}
    for(const s of state.shots){let m=this.shots.get(s.id);if(!m){m=this.mesh(s.type==='banana'?new T.ConeGeometry(.7,1.5,8):new T.SphereGeometry(.8,10,8),s.type==='banana'?0xfbd557:s.type==='red shell'?0xe5493f:0x38ab6b);this.shots.set(s.id,m);}m.position.set(s.x,s.y,s.z);m.rotation.y=state.time*8;}
    this.effectMeshes.forEach((m,i)=>{const e=state.effects[i];m.visible=!!e;if(e){m.position.set(e.x,e.y,e.z);m.scale.setScalar(1+(1-e.life/.6)*3);m.rotation.set(state.time*4,state.time*5,0);}});
    let follow=state.karts[player];if(!follow.hp)follow=state.karts.find(k=>k.active&&k.hp>0&&(state.teams?k.id<2:true))||state.karts.find(k=>k.active&&k.hp>0)||follow;
    const visual=this.karts[follow.id],pos=visual.position;
    if(overview){this.camera.position.lerp(new T.Vector3(105,115,145),1-Math.exp(-dt*4));this.aim.lerp(new T.Vector3(0,0,0),1-Math.exp(-dt*5));}
    else{
      if(this.followAngle===null)this.followAngle=visual.angle;this.followAngle+=angleDelta(visual.angle,this.followAngle)*(1-Math.exp(-dt*6));
      const back=21,desired=new T.Vector3(pos.x-Math.sin(this.followAngle)*back,pos.y+13,pos.z-Math.cos(this.followAngle)*back);
      // Keep the chase camera above terraces when a driver drops behind a wall.
      desired.y=Math.max(desired.y,floorAt(desired.x,desired.z)+7);
      this.camera.position.lerp(desired,1-Math.exp(-dt*7));this.aim.lerp(new T.Vector3(pos.x+Math.sin(this.followAngle)*5,pos.y+1.8,pos.z+Math.cos(this.followAngle)*5),1-Math.exp(-dt*10));
    }
    this.camera.lookAt(this.aim);this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.resizeObserver.disconnect();const materials=new Set();this.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const m of materials)m.dispose();for(const t of this.textures)t.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
