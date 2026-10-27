// The ROM owns all driving, jumping, sprites, items, collisions and sound. This
// compositor replaces only the flat Mode-7 road layer with raised ROM-textured
// surfaces. The patched ROM projects its own sprites at their new floor height.
import {floorHeight,terrainMesh,cameraFloor,TERRAIN_MARKER as MARKER} from './terrain-geometry.js';
export class NativeTerrain {
 constructor(game,m){
  this.game=game;this.m=m;this.canvas=document.createElement('canvas');this.canvas.id='native-terrain';this.canvas.width=256;this.canvas.height=224;this.canvas.style='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;z-index:1;pointer-events:none';
  this.gl=this.canvas.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});const gl=this.gl;
  if(!gl||!gl.getExtension('EXT_frag_depth'))throw Error('Raised terrain needs WebGL depth support. Try a current Chrome or Safari browser.');
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
  this.p=program('attribute vec3 p;attribute float wall;uniform vec3 eye,right,down,forward;uniform float focal,origin;varying vec3 world;varying float w;void main(){vec3 d=p-eye;float z=dot(d,forward);gl_Position=vec4(dot(d,right)*focal/128.,(1.-origin/56.)*z-dot(d,down)*focal/56.,1.001*z-1.0005,z);world=p;w=wall;}',
  'precision highp float;uniform sampler2D tiles,atlas;varying vec3 world;varying float w;void main(){vec2 q=world.xy;float id;if(w>.5){q=vec2(world.x+world.y,world.z);id=240.+mod(floor(q.x/8.),2.)+mod(floor(q.y/8.),2.)*2.;}else{id=floor(texture2D(tiles,(floor(q/8.)+.5)/128.).r*255.+.5);}vec2 a=vec2(mod(id,16.),floor(id/16.))*8.+mod(floor(q),8.)+.5;gl_FragColor=texture2D(atlas,a/128.);}');
  this.fg=program('attribute vec2 p;varying vec2 uv;void main(){gl_Position=vec4(p,0,1);uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);}',
    '#extension GL_EXT_frag_depth : require\nprecision highp float;varying vec2 uv;uniform sampler2D image,depths;uniform vec4 sourceRect;uniform float enabled;void main(){vec4 c=texture2D(image,sourceRect.xy+uv*sourceRect.zw);if(enabled>.5&&c.r>.94&&c.g<.05&&c.b>.94)discard;vec2 d=texture2D(depths,uv).rg;float z=(d.r*65280.+d.g*255.)/16.;gl_FragDepthEXT=enabled>.5?(z>0.?min(1.,1.0005-.50025/z):0.):0.;gl_FragColor=c;}');
  this.points=[];const quad=(a,b,c,d,w=0)=>{for(const p of[a,b,c,a,c,d])this.points.push(...p,w);};
  for(const face of terrainMesh())quad(...face.vertices,face.wall);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.points),gl.STATIC_DRAW);this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};this.map=texture();this.atlas=texture();this.image=texture();
  const state=game.save(),tag=new TextEncoder().encode('VRA:065536:');let at=-1;for(let i=0;i<state.length-tag.length;i++)if(tag.every((v,j)=>state[i+j]===v)){at=i+tag.length;break;}if(at<0)throw Error('VRAM block not found');const vr=state.slice(at,at+65536),heap=m.module.HEAPU8,info=game.manager.functions.saveStateInfo().split('|').map(Number);const matches=[];
  let anchor=0,best=-1;for(let j=0;j<65520;j+=4){const n=new Set(vr.subarray(j,j+16)).size;if(n>best){anchor=j;best=n;}}if(best<4)throw Object.assign(Error('Native video memory is still loading.'),{notReady:true});const signature=new DataView(vr.buffer).getUint32(anchor,true),words=new Uint32Array(heap.buffer);for(let word=0;word<words.length;word++){if(words[word]!==signature)continue;const i=word*4-anchor;if(i<0||i+65536>heap.length)continue;if(i>=info[1]&&i<info[1]+info[0])continue;let same=true;for(let j=0;j<64;j++)if(heap[i+j]!==vr[j]){same=false;break;}if(same&&[4096,8192,16384,32768,49152,65535].every(j=>heap[i+j]===vr[j]))matches.push(i);}
  if(matches.length!==1)throw Error('Could not safely identify native video memory.');this.vram=matches[0];this.sky=m.u(0x3a80);this.frames=0;this.active=false;
  this.depthTexture=texture();this.depthPixels=new Uint8Array(256*224*4);this.depths=new Float32Array(256*224);this.atlasPixels=new Uint8Array(128*128*4);
  document.querySelector('#emulator').append(this.canvas);game.displayCanvas=this.canvas;
 }
 activate(){if(this.active)return;this.sky=this.m.u(0x3a80);this.active=true;this.game.manager.functions.setVariable('snes9x_layer_1','disabled');this.m.w(0x3a80,0x7c1f);this.m.w(0xe8a,1);this.m.w(0x10f4,MARKER);this.m.w(0x10f6,0xffff);this.m.w(0x11f6,0xffff);}
 deactivate(){if(!this.active)return;this.active=false;this.m.w(0x10f4,0);this.m.w(0x3a80,this.sky);this.m.w(0xe8a,1);this.game.manager.functions.setVariable('snes9x_layer_1','enabled');}
 camera(player){const m=this.m,i=player*2,a=m.u(0x94+i)*Math.PI/32768,z=m.u(0x80+i)*Math.PI/32768,s=Math.sin(a),c=Math.cos(a),sz=Math.sin(z),cz=Math.cos(z),x=m.u(0x88+i)/4,y=m.u(0x8c+i)/4,h=cameraFloor(m,player),l=m.u(0x7c+i);return{eye:[x-l*sz*s,y+l*sz*c,h+l*cz],right:[c,s,0],down:[-cz*s,cz*c,-sz],forward:[sz*s,-sz*c,-cz],focal:m.u(0x84+i),origin:m.u(0x98+i)-player*112};}
 spriteDepth(){
  const m=this.m,d=this.depths;d.fill(4095);
  for(let player=0;player<2;player++){
    const cam=this.camera(player),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),seen=new Set();let p=m.u(player?0xbc:0xb0),off=player?8:0;
    while(p&&p!==(player?0xb4:0xb0)&&p<65536&&!seen.has(p)&&seen.size<128){seen.add(p);const x=m.u(p+0x18),y=m.u(p+0x1c),z=this.height(x,y)+m.u(p+0x20),v=[x-cam.eye[0],y-cam.eye[1],z-cam.eye[2]],depth=dot(v,cam.forward);
      // Use the ROM's final screen coordinates, including its DSP rounding and
      // native jump adjustment. Reprojecting them can leave sprite pixels outside
      // the depth mask, particularly at platform edges and on the second camera.
      if(p>=0x1000&&p<0x1c00&&depth>1&&depth<1600){const scale=cam.focal/depth,sx=((m.u(p+(player?0x32:0x2c))+256)<<16)>>16,sy=((m.u(p+(player?0x34:0x2e))+256)<<16)>>16,half=8*scale,top=16*scale;
        const left=Math.max(0,Math.floor(sx-half)),right=Math.min(255,Math.ceil(sx+half)),a=Math.max(player*112+16,Math.floor(sy-top)),b=Math.min((player+1)*112-1,Math.ceil(sy+3*scale));
        for(let yy=a;yy<=b;yy++)for(let xx=left;xx<=right;xx++){const i=yy*256+xx;if(depth<d[i])d[i]=depth;}
      }p=m.u(p+off);
    }
    // Preserve the original blanking bars and player-number HUD above the road.
    for(let y=player*112;y<player*112+16;y++)d.fill(0,y*256,(y+1)*256);
    for(let y=player*112;y<player*112+24;y++)d.fill(0,y*256+148,y*256+176);
    // Each camera's own driver is drawn by the ROM's dedicated player path,
    // outside the world-object list. Keep that original sprite and balloons.
    const own=0x1000+player*256,jump=m.u(own+0x20),top=Math.max(16,66-jump*4);
    for(let y=player*112+top;y<(player+1)*112;y++)d.fill(0,y*256+98,y*256+158);
  }
  for(const [a,b]of[[108,112],[218,224]])for(let y=a;y<b;y++)d.fill(0,y*256,(y+1)*256);
  const pixels=this.depthPixels;for(let i=0;i<d.length;i++){const n=Math.min(65535,Math.round(d[i]*16));pixels[i*4]=n>>8;pixels[i*4+1]=n&255;pixels[i*4+3]=255;}
 }
 height(x,y){return floorHeight(x,y);}
 render(sourceGL){
  if(sourceGL){const v=sourceGL.getParameter(sourceGL.VIEWPORT),c=sourceGL.canvas;this.sourceRect=[v[0]/c.width,1-(v[1]+v[3])/c.height,v[2]/c.width,v[3]/c.height];}
  const gl=this.gl,m=this.m,heap=m.module.HEAPU8,vr=heap.subarray(this.vram,this.vram+65536);this.frames++;
  if(m.u(0x36)===14&&m.u(0x2c)===6&&m.u(0x124)===22)this.activate();else this.deactivate();
  if(!this.active){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.foreground();return;}
  const atlas=this.atlasPixels;for(let t=0;t<256;t++)for(let j=0;j<64;j++){const index=vr[t*128+j*2+1],color=index?m.u(0x3a80+index*2):this.sky,o=((t>>4)*8*128+(t&15)*8+(j>>3)*128+(j&7))*4;atlas[o]=(color&31)*255/31;atlas[o+1]=(color>>5&31)*255/31;atlas[o+2]=(color>>10&31)*255/31;atlas[o+3]=255;}
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.map);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,128,128,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,m.bytes().subarray(65536,81920));gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,128,128,0,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
  gl.useProgram(this.p);gl.uniform1i(gl.getUniformLocation(this.p,'tiles'),0);gl.uniform1i(gl.getUniformLocation(this.p,'atlas'),1);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const p=gl.getAttribLocation(this.p,'p'),w=gl.getAttribLocation(this.p,'wall');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(w);gl.vertexAttribPointer(w,1,gl.FLOAT,false,16,12);
  gl.clearColor((this.sky&31)/31,(this.sky>>5&31)/31,(this.sky>>10&31)/31,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.frontFace(gl.CW);
  for(let player=0;player<2;player++){const cam=this.camera(player);gl.viewport(0,(1-player)*112,256,112);
    for(const name of ['eye','right','down','forward'])gl.uniform3fv(gl.getUniformLocation(this.p,name),cam[name]);gl.uniform1f(gl.getUniformLocation(this.p,'focal'),cam.focal);gl.uniform1f(gl.getUniformLocation(this.p,'origin'),cam.origin);gl.drawArrays(gl.TRIANGLES,0,this.points.length/4);
  }
  gl.disable(gl.CULL_FACE);gl.disableVertexAttribArray(p);gl.disableVertexAttribArray(w);this.spriteDepth();this.foreground();
 }
 foreground(){const gl=this.gl;gl.viewport(0,0,256,224);gl.useProgram(this.fg);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.image);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.game.emulator.canvas);gl.uniform1i(gl.getUniformLocation(this.fg,'image'),0);gl.uniform4fv(gl.getUniformLocation(this.fg,'sourceRect'),this.sourceRect||[0,0,1,1]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.depthTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,224,0,gl.RGBA,gl.UNSIGNED_BYTE,this.depthPixels);gl.uniform1i(gl.getUniformLocation(this.fg,'depths'),1);gl.uniform1f(gl.getUniformLocation(this.fg,'enabled'),this.active?1:0);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const a=gl.getAttribLocation(this.fg,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.disableVertexAttribArray(a);
 }
}

// Run immediately after the emulator presents, before its transient WebGL buffer
// is discarded. An unrelated animation-frame copy can produce blank captures.
export function installTerrainFrameHook(game,onError){
 let renderer=null,failed=false;
 for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C)for(const key of ['drawArrays','drawElements']){
   const original=C.prototype[key];C.prototype[key]=function(...args){const result=original.apply(this,args);if(renderer&&!failed&&this.canvas===game.emulator?.canvas)try{renderer.render(this);}catch(e){failed=true;renderer.deactivate();game.pause(true);onError(e);}return result;};
 }
 return {attach(memory){renderer=new NativeTerrain(game,memory);return renderer;}};
}
