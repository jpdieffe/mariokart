// Crop the original split-screen output using layout, without copying WebGL's
// transient drawing buffer. The network always carries the complete frame.
export class Presentation {
 constructor(){this.mode='full';this.racing=false;this.player=0;this.crop=null;this.draw=this.draw.bind(this);requestAnimationFrame(this.draw);}
 setSource(source,player=0){this.source=source;this.player=player;}
 draw(){const crop=this.mode==='driver'&&this.racing;if(crop!==this.crop){this.crop=crop;document.getElementById('screen').classList.toggle('driver-view',crop);document.getElementById('console').classList.toggle('driver-view',crop);}requestAnimationFrame(this.draw);}
}
