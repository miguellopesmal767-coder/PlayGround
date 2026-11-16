import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const canvas=document.querySelector('#game-canvas');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x78a9c2);scene.fog=new THREE.Fog(0x78a9c2,55,190);
const camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,.1,260);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const clock=new THREE.Clock(),keys=new Set(),touch=new Set();
const ui={blue:document.querySelector('#blue-score'),orange:document.querySelector('#orange-score'),timer:document.querySelector('#timer'),speed:document.querySelector('#speed'),boost:document.querySelector('#boost-fill'),boostValue:document.querySelector('#boost-value'),item:document.querySelector('#item-name'),itemCard:document.querySelector('#item-card'),toast:document.querySelector('#toast'),goal:document.querySelector('#goal-flash')};
const WORLD={x:25,z:42,goalHalf:7.3,goalDepth:8,floor:0};let running=false,ended=false,timeLeft=120,blueScore=0,orangeScore=0,matchStart=0,toastTimeout,goalTimeout,audioContext=null,soundOn=true;
const mat=(color,roughness=.65,metalness=.05,emissive=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:.65});
const mats={turf:mat(0x187b70),turf2:mat(0x12665f),line:mat(0x9be9d8,.45,.05,0x174d45),wall:mat(0x162f46,.42,.25),cyan:mat(0x42dafa,.28,.4,0x12a6d9),cyanDark:mat(0x123f59,.3,.45),orange:mat(0xff9b43,.3,.3,0xe7631e),white:mat(0xe9f3f5,.25,.18),rubber:mat(0x101923,.9),gold:mat(0xffca54,.27,.25,0xff9200),red:mat(0xff4c66,.3,.3,0xd0183d),glass:new THREE.MeshStandardMaterial({color:0x9ceeff,roughness:.16,metalness:.45,transparent:true,opacity:.48})};
scene.add(new THREE.HemisphereLight(0xc9f0ff,0x284837,1.7));const sun=new THREE.DirectionalLight(0xfff0d7,3);sun.position.set(-20,45,-8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.bias=-.0002;scene.add(sun);const fill=new THREE.DirectionalLight(0x48c7ff,1.2);fill.position.set(24,18,30);scene.add(fill);
function box(parent,size,material,pos,cast=true,receive=true){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=cast;m.receiveShadow=receive;parent.add(m);return m;}
function cylinder(parent,rt,rb,h,material,pos,n=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),material);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;}
function makeArena(){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(500,500),mat(0x304956));ground.rotation.x=-Math.PI/2;ground.position.y=-.09;ground.receiveShadow=true;scene.add(ground);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(WORLD.x*2,WORLD.z*2),mats.turf);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 for(let i=0;i<10;i++){const band=new THREE.Mesh(new THREE.PlaneGeometry(WORLD.x*2,WORLD.z/5),mat(i%2?0x19786d:0x1b8376));band.rotation.x=-Math.PI/2;band.position.set(0,.006,-WORLD.z+WORLD.z/10+i*WORLD.z/5);scene.add(band);}
 const markings=new THREE.Group();scene.add(markings);function line(x1,z1,x2,z2,w=.15){return box(markings,[Math.abs(x2-x1)||w,.035,Math.abs(z2-z1)||w],mats.line,[(x1+x2)/2,.035,(z1+z2)/2],false,false);}
 line(-WORLD.x+1,-WORLD.z+1,WORLD.x-1,-WORLD.z+1,.18);line(-WORLD.x+1,WORLD.z-1,WORLD.x-1,WORLD.z-1,.18);line(-WORLD.x+1,-WORLD.z+1,-WORLD.x+1,WORLD.z-1,.18);line(WORLD.x-1,-WORLD.z+1,WORLD.x-1,WORLD.z-1,.18);line(-WORLD.x+1,0,WORLD.x-1,0,.14);
 const circle=new THREE.Mesh(new THREE.TorusGeometry(8,.095,6,80),mats.line);circle.rotation.x=Math.PI/2;circle.position.y=.045;markings.add(circle);const kickoff=new THREE.Mesh(new THREE.CircleGeometry(.65,32),mats.gold);kickoff.rotation.x=-Math.PI/2;kickoff.position.y=.04;markings.add(kickoff);
 for(const side of [-1,1]){box(scene,[WORLD.x*2,.7,1.3],mats.wall,[0,.25,side*WORLD.z],false);box(scene,[WORLD.x*2,.15,.3],side<0?mats.cyan:mats.orange,[0,.7,side*(WORLD.z-.35)],false);const g=new THREE.Mesh(new THREE.BoxGeometry(WORLD.x*2,4,.22),mats.glass);g.position.set(0,2.7,side*(WORLD.z-.65));scene.add(g);}
 for(const side of [-1,1]){box(scene,[1.3,.7,WORLD.z*2],mats.wall,[side*WORLD.x,.25,0],false);box(scene,[.3,.15,WORLD.z*2],mats.cyan,[side*(WORLD.x-.35),.7,0],false);const g=new THREE.Mesh(new THREE.BoxGeometry(.22,4,WORLD.z*2),mats.glass);g.position.set(side*(WORLD.x-.65),2.7,0);scene.add(g);}
 buildGoals(-1);buildGoals(1);buildStands();
}
function buildGoals(end){const z=end*(WORLD.z+.35),goal=new THREE.Group();scene.add(goal);const color=end<0?mats.cyan:mats.orange;box(goal,[.55,7,.55],color,[-WORLD.goalHalf,3.5,0]);box(goal,[.55,7,.55],color,[WORLD.goalHalf,3.5,0]);box(goal,[WORLD.goalHalf*2+.55,.55,.55],color,[0,7,z]);box(goal,[WORLD.goalHalf*2,5,.25],new THREE.MeshBasicMaterial({color:end<0?0x17aaca:0xe77728,transparent:true,opacity:.13}),[0,2.5,end*(WORLD.z+4)],false,false);const nm=new THREE.LineBasicMaterial({color:end<0?0x69dff4:0xffc072,transparent:true,opacity:.25});for(let x=-WORLD.goalHalf;x<=WORLD.goalHalf;x+=1.3){goal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.3,z),new THREE.Vector3(x,5,z)]),nm));}for(let y=.6;y<=5;y+=1)goal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-WORLD.goalHalf,y,z),new THREE.Vector3(WORLD.goalHalf,y,z)]),nm));const light=new THREE.PointLight(end<0?0x32d9ff:0xff9b43,8,18);light.position.set(0,4,z);scene.add(light);}
function buildStands(){const colors=[0x123146,0x173b50,0x1a4658,0x214657];for(const side of [-1,1])for(let row=0;row<5;row++){const z=side*(WORLD.z+3.4+row*1.35),y=1.2+row*.65;box(scene,[WORLD.x*2+9,.55,1.25],mat(colors[row%4]),[0,y,z],false);for(let x=-WORLD.x;x<=WORLD.x;x+=2.2){const seatIndex=((Math.floor(x/2)+row)%4+4)%4;box(scene,[.85,.45,.65],mat(seatIndex===0?0x355468:colors[seatIndex]),[x,y+.4,z],false,false);}}for(let side of [-1,1])for(let row=0;row<4;row++)box(scene,[1.15,.55,WORLD.z*2+7],mat(colors[(row+1)%4]),[side*(WORLD.x+3.5+row*1.25),1.2+row*.65,0],false);for(const x of [-1,1])for(const z of [-1,1]){const px=x*(WORLD.x+8),pz=z*(WORLD.z+9);cylinder(scene,.22,.38,16,mats.wall,[px,8,pz],12);box(scene,[4,.35,1.1],new THREE.MeshBasicMaterial({color:0xcaf5ff}),[px,16,pz],false);const l=new THREE.SpotLight(0xbdeeff,65,100,.7,.5,1.2);l.position.set(px,15,pz);l.target.position.set(0,0,0);scene.add(l,l.target);}for(let i=0;i<18;i++){const x=(i-9)*15,z=-70-Math.random()*24,h=9+Math.random()*22,w=7+Math.random()*9;box(scene,[w,h,5],mat(i%2?0x263e50:0x304a5b),[x,h/2,z],false,false);box(scene,[w*.55,.18,.12],i%3?mats.cyan:mats.orange,[x,h*.72,z+2.55],false,false);}}
makeArena();

function makeCar(team='blue'){const root=new THREE.Group();scene.add(root);const blue=team==='blue',primary=blue?mats.cyan:mats.orange,dark=blue?mats.cyanDark:mats.red,body=new THREE.Group();root.add(body);box(body,[2.15,.62,3.55],primary,[0,.78,0]);const hood=box(body,[1.82,.38,1.42],primary,[0,1.02,-.88]);const rear=box(body,[1.8,.4,.9],dark,[0,1.02,1.12]);const cabin=box(body,[1.4,.78,1.55],mats.glass,[0,1.47,.05]);box(body,[1.55,.13,.12],mats.white,[0,1.07,-1.62]);box(body,[2.35,.27,.25],dark,[0,.52,-1.84]);box(body,[2.3,.28,.28],dark,[0,.61,1.8]);box(body,[1.8,.12,.27],primary,[0,1.72,1.25]);for(const x of [-.68,.68])box(body,[.14,.55,.13],dark,[x,1.46,1.24]);for(const x of [-.67,.67]){const head=box(body,[.4,.14,.12],new THREE.MeshBasicMaterial({color:blue?0xcaf8ff:0xfff0ce}),[x,.85,-1.77],false,false);box(body,[.36,.14,.12],new THREE.MeshBasicMaterial({color:0xff344d}),[x,.88,1.73],false,false);}const wheels=[];for(const x of [-1.12,1.12])for(const z of [-1.1,1.15]){const tire=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.34,18),mats.rubber);tire.rotation.z=Math.PI/2;tire.position.set(x,.49,z);tire.castShadow=true;body.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.36,12),blue?mats.white:mats.gold);hub.rotation.z=Math.PI/2;hub.position.set(x,.49,z);body.add(hub);wheels.push(tire);}const glow=new THREE.PointLight(blue?0x32d9ff:0xff8c42,3,7);glow.position.set(0,.35,.4);root.add(glow);const under=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.5),new THREE.MeshBasicMaterial({color:blue?0x24d5ff:0xff8c3d,transparent:true,opacity:.22,side:THREE.DoubleSide}));under.rotation.x=-Math.PI/2;under.position.y=.12;root.add(under);const flame=new THREE.Group();root.add(flame);flame.position.set(0,.72,2);const fire=new THREE.Mesh(new THREE.ConeGeometry(.38,1.2,10),new THREE.MeshBasicMaterial({color:0x68eaff,transparent:true,opacity:.9}));fire.rotation.x=-Math.PI/2;fire.position.z=.47;flame.add(fire);flame.visible=false;return{root,body,wheels,flame,team,primary};}
const player=makeCar('blue');player.root.position.set(0,0,20);player.yaw=0;player.velocity=new THREE.Vector3();player.airVel=0;player.grounded=true;player.boost=100;player.item=null;player.jumpLock=false;
const bots=[makeCar('orange'),makeCar('orange')];bots[0].root.position.set(-5,0,-18);bots[0].yaw=Math.PI;bots[0].velocity=new THREE.Vector3();bots[0].grounded=true;bots[0].boost=50;bots[1].root.position.set(14,0,-29);bots[1].yaw=Math.PI;bots[1].velocity=new THREE.Vector3();bots[1].grounded=true;bots[1].boost=50;
const ball=new THREE.Group();scene.add(ball);const sphere=new THREE.Mesh(new THREE.SphereGeometry(1.65,32,24),new THREE.MeshStandardMaterial({color:0xf5f2e9,roughness:.27,metalness:.1}));sphere.castShadow=true;sphere.receiveShadow=true;ball.add(sphere);const panelMat=new THREE.MeshStandardMaterial({color:0x152c3e,roughness:.4,metalness:.2});for(let i=0;i<8;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(1.67,8,6,0,Math.PI/4,.2,Math.PI/3),i%2?mats.gold:panelMat);p.rotation.y=i*Math.PI/4;ball.add(p);}const ballGlow=new THREE.PointLight(0xffcb74,1.5,9);ball.add(ballGlow);ball.position.set(0,1.7,0);ball.userData.vel=new THREE.Vector3();ball.userData.spin=new THREE.Vector3();const ballShadow=new THREE.Mesh(new THREE.CircleGeometry(2.1,28),new THREE.MeshBasicMaterial({color:0x071920,transparent:true,opacity:.35,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
const itemTypes={boost:{label:'TURBO BOOST',color:0x66e8ff,symbol:'»'},shell:{label:'SEEKER SHELL',color:0xff6a69,symbol:'➤'},banana:{label:'BANANA PEEL',color:0xffd75e,symbol:'⌁'},zap:{label:'LIGHTNING',color:0xd9a2ff,symbol:'ϟ'}};
function makeCrate(x,z){const group=new THREE.Group();scene.add(group);group.position.set(x,.9,z);const core=box(group,[1.15,1.15,1.15],mats.gold,[0,0,0]);core.rotation.y=Math.PI/4;group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.45,1.45,1.45)),new THREE.LineBasicMaterial({color:0xfff0a2,transparent:true,opacity:.8})));const halo=new THREE.Mesh(new THREE.TorusGeometry(1.02,.04,8,32),new THREE.MeshBasicMaterial({color:0xffcf59}));halo.rotation.x=Math.PI/2;group.add(halo);group.add(new THREE.PointLight(0xffbd4f,1.7,6));return{group,core,halo,active:true,phase:Math.random()*6};}
const crates=[makeCrate(-15,8),makeCrate(15,-7),makeCrate(0,-29),makeCrate(-14,-18),makeCrate(14,22)],projectiles=[],traps=[],particles=[];
function makeItemIcon(type){const d=itemTypes[type];document.querySelector('.item-orbit').textContent=d?.symbol||'?';document.querySelector('.item-orbit').style.color=d?`#${d.color.toString(16).padStart(6,'0')}`:'';document.querySelector('.item-orbit').style.borderColor=d?`#${d.color.toString(16).padStart(6,'0')}`:'';}
function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>ui.toast.classList.remove('show'),1550);}
function beep(freq=440,duration=.08,type='sine',volume=.035){if(!soundOn)return;try{audioContext??=new AudioContext();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+duration);}catch{}}
function inputOn(name){return touch.has(name)||keys.has(name);}function forwardOf(yaw){return new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));}
function updateCar(car,dt,isPlayer=false,index=0){const pos=car.root.position;let throttle=0,steer=0,boosting=false,jump=false;if(isPlayer){throttle=(inputOn('forward')?1:0)-(inputOn('back')?1:0);steer=(inputOn('right')?1:0)-(inputOn('left')?1:0);boosting=inputOn('boost')&&car.boost>0&&throttle>=0;jump=inputOn('jump');}else{const offset=index===0?0:Math.sin(matchStart*.0005+index)*9,target=new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x+offset,-17,17),0,ball.position.z+5+index*3),dx=target.x-pos.x,dz=target.z-pos.z,desired=Math.atan2(-dx,-dz);let diff=THREE.MathUtils.euclideanModulo(desired-car.yaw+Math.PI,Math.PI*2)-Math.PI;steer=THREE.MathUtils.clamp(diff*2.7,-1,1);throttle=1;if(Math.abs(diff)<.45&&car.boost>2&&Math.random()<dt*.55)boosting=true;}if(!isPlayer&&car.stun>0){car.stun=Math.max(0,car.stun-dt);throttle=.12;steer=0;}
 const fwd=forwardOf(car.yaw),speed=car.velocity.dot(fwd);if(Math.abs(throttle)>.05)car.velocity.addScaledVector(fwd,throttle*(boosting?43:25)*dt);if(boosting){car.boost=Math.max(0,car.boost-35*dt);car.flame.visible=true;if(Math.random()<dt*20)spawnParticles(pos.clone().addScaledVector(fwd,-2),0x6ceaff,1);}else{car.flame.visible=false;car.boost=Math.min(100,car.boost+(isPlayer?10:4)*dt);}const sideVec=new THREE.Vector3(-fwd.z,0,fwd.x),lateral=car.velocity.dot(sideVec);car.velocity.addScaledVector(sideVec,-lateral*Math.min(1,dt*(isPlayer?5:3.3)));car.velocity.multiplyScalar(Math.exp(-dt*(throttle===0?.85:.22)));const max=boosting?38:24;if(car.velocity.length()>max)car.velocity.setLength(max);if(Math.abs(speed)>.45)car.yaw+=steer*dt*(1.15+Math.min(1.1,Math.abs(speed)/15))*(speed<0?-1:1);if(jump&&!car.jumpLock&&car.grounded){car.airVel=8.2;car.grounded=false;car.jumpLock=true;beep(330,.12,'triangle');}if(!jump)car.jumpLock=false;if(!car.grounded){car.airVel-=19*dt;pos.y+=car.airVel*dt;if(pos.y<=0){pos.y=0;car.airVel=0;car.grounded=true;beep(90,.06,'sine',.018);}}pos.x+=car.velocity.x*dt;pos.z+=car.velocity.z*dt;const lx=WORLD.x-1.6,lz=WORLD.z-1.9;if(Math.abs(pos.x)>lx){pos.x=Math.sign(pos.x)*lx;car.velocity.x*=-.58;beep(150,.05);}if(Math.abs(pos.z)>lz&&!(Math.abs(pos.x)<WORLD.goalHalf-1.2&&pos.y<4.2)){pos.z=Math.sign(pos.z)*lz;car.velocity.z*=-.58;beep(150,.05);}car.root.rotation.z=pos.y>0?THREE.MathUtils.clamp(-steer*.14,-.2,.2):THREE.MathUtils.damp(car.root.rotation.z,0,8,dt);car.root.rotation.y=car.yaw;car.body.position.y=0;car.wheels.forEach(w=>w.rotation.x+=car.velocity.length()*dt*1.6);}
function spawnParticles(position,color,count=8){for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.08+Math.random()*.12,0),new THREE.MeshBasicMaterial({color,transparent:true}));mesh.position.copy(position);scene.add(mesh);particles.push({mesh,vel:new THREE.Vector3((Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8),life:.4+Math.random()*.5,max:.9});}}

function collectItem(car,type){
  if(car.item){showToast('ITEM SLOT FULL — USE YOUR ITEM');return;}
  car.item=type; if(car===player){ui.item.textContent=itemTypes[type].label;makeItemIcon(type);ui.itemCard.classList.add('armed');showToast(`${itemTypes[type].label} READY`);beep(680,.12,'sine');}
}
function useItem(){
  const type=player.item;if(!type){showToast('NO ITEM — FIND A CRATE');return;}
  player.item=null;ui.item.textContent='NO ITEM';makeItemIcon(null);ui.itemCard.classList.remove('armed');
  const fwd=forwardOf(player.yaw);
  if(type==='boost'){player.boost=Math.min(100,player.boost+55);player.velocity.addScaledVector(fwd,18);showToast('TURBO BOOST!');spawnParticles(player.root.position.clone(),0x55e6ff,14);beep(880,.2,'sawtooth');}
  if(type==='shell'){
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.58,1),new THREE.MeshStandardMaterial({color:0xff5366,roughness:.25,metalness:.4,emissive:0x9c102a,emissiveIntensity:1}));scene.add(mesh);
    mesh.position.copy(player.root.position).add(new THREE.Vector3(0,1.4,0)).addScaledVector(fwd,2.4);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.06,8,24),new THREE.MeshBasicMaterial({color:0xffbbc1}));mesh.add(ring);ring.rotation.x=Math.PI/2;
    projectiles.push({mesh,vel:fwd.clone().multiplyScalar(15),life:5,owner:player});showToast('SEEKER SHELL AWAY!');beep(500,.2,'square');
  }
  if(type==='banana'){
    const trap=new THREE.Group();scene.add(trap);trap.position.copy(player.root.position).addScaledVector(fwd,-2.8);trap.position.y=.35;
    const peel=new THREE.Mesh(new THREE.TorusGeometry(.42,.18,7,18,Math.PI*1.6),new THREE.MeshStandardMaterial({color:0xffdc46,roughness:.38}));peel.rotation.x=Math.PI/2;peel.rotation.z=.3;trap.add(peel);
    const stem=new THREE.Mesh(new THREE.ConeGeometry(.16,.55,8),new THREE.MeshStandardMaterial({color:0x88af39}));stem.position.y=.22;stem.rotation.z=.7;trap.add(stem);
    traps.push({mesh:trap,life:14});showToast('BANANA PEEL DEPLOYED');beep(240,.12,'triangle');
  }
  if(type==='zap'){
    for(const bot of bots){bot.velocity.multiplyScalar(.25);bot.stun=2.2;spawnParticles(bot.root.position.clone().add(new THREE.Vector3(0,1,0)),0xc88dff,18);}
    showToast('LIGHTNING STRIKE! RIVALS STUNNED');beep(1100,.22,'sawtooth');
  }
}
function resetPositions(){
  player.root.position.set(0,0,20);player.yaw=0;player.velocity.set(0,0,0);player.airVel=0;player.grounded=true;
  bots.forEach((bot,i)=>{bot.root.position.set(i?14:-5,0,i?-29:-18);bot.yaw=Math.PI;bot.velocity.set(0,0,0);bot.grounded=true;bot.airVel=0;bot.stun=0;});
  ball.position.set(0,1.7,0);ball.userData.vel.set(0,0,0);ball.userData.spin.set(0,0,0);
}
function scoreGoal(team){
  if(team==='blue')blueScore++;else orangeScore++;
  ui.blue.textContent=blueScore;ui.orange.textContent=orangeScore;
  ui.goal.classList.add('show');clearTimeout(goalTimeout);goalTimeout=setTimeout(()=>ui.goal.classList.remove('show'),1800);
  showToast(team==='blue'?'NEON RIDERS SCORE!':'PYRO PANTHERS SCORE!');beep(team==='blue'?880:320,.45,'sawtooth',.06);
  spawnParticles(ball.position.clone(),team==='blue'?0x47dfff:0xffa54d,32);
  resetPositions();
}
function updateBall(dt){
  const vel=ball.userData.vel;vel.y-=14*dt;ball.position.addScaledVector(vel,dt);
  if(ball.position.y<1.65){ball.position.y=1.65;if(vel.y<0){vel.y*=-.67;if(Math.abs(vel.y)<.8)vel.y=0;}vel.x*=Math.exp(-dt*.75);vel.z*=Math.exp(-dt*.75);}
  // sideboards and goal-mouth rebound
  if(Math.abs(ball.position.x)>WORLD.x-1.6){ball.position.x=Math.sign(ball.position.x)*(WORLD.x-1.6);vel.x*=-.78;}
  const atGoal=Math.abs(ball.position.x)<WORLD.goalHalf&&ball.position.y<5.4;
  if(Math.abs(ball.position.z)>WORLD.z-1.3&&!atGoal){ball.position.z=Math.sign(ball.position.z)*(WORLD.z-1.3);vel.z*=-.76;}
  if(atGoal&&ball.position.z < -WORLD.z-1){scoreGoal('blue');return;}
  if(atGoal&&ball.position.z > WORLD.z+1){scoreGoal('orange');return;}
  // car-ball impact: a strong nose-first hit adds a satisfying shot impulse
  for(const car of [player,...bots]){
    const carCenter=car.root.position.clone().add(new THREE.Vector3(0,1.05,0));
    const delta=ball.position.clone().sub(carCenter);const dist=delta.length();const minDist=2.65;
    if(dist<minDist){
      const normal=delta.normalize();const overlap=minDist-dist;ball.position.addScaledVector(normal,overlap+.02);
      const relative=ball.userData.vel.clone().sub(car.velocity);const closing=Math.max(0,-relative.dot(normal));
      let impulse=Math.max(3,closing*1.18+car.velocity.length()*.58);
      if(car===player&&inputOn('boost'))impulse+=5;
      ball.userData.vel.addScaledVector(normal,impulse);ball.userData.vel.y=Math.max(ball.userData.vel.y,2.1+car.velocity.length()*.08);
      ball.userData.spin.x+=normal.z*impulse*.12;ball.userData.spin.z-=normal.x*impulse*.12;
      if(closing>4){beep(Math.min(700,190+closing*12),.065,'triangle',.022);spawnParticles(ball.position,car===player?0x71e9ff:0xffb05a,Math.min(8,Math.floor(closing/2)));}
    }
  }
  ball.userData.vel.multiplyScalar(Math.exp(-dt*.055));if(ball.userData.vel.length()>34)ball.userData.vel.setLength(34);
  ball.rotation.x+=ball.userData.vel.z*dt*.4;ball.rotation.z-=ball.userData.vel.x*dt*.4;
  ballShadow.position.set(ball.position.x,.025,ball.position.z);ballShadow.scale.setScalar(Math.max(.45,1.3-ball.position.y*.18));
}
function updateObjects(dt){
  for(const crate of crates){if(!crate.active)continue;crate.phase+=dt;crate.group.rotation.y+=dt*.7;crate.group.position.y=.9+Math.sin(crate.phase*2)*.18;crate.halo.rotation.z+=dt*.8;
    for(const car of [player,...bots])if(car.root.position.distanceTo(crate.group.position)<2.1){crate.active=false;crate.group.visible=false;const type=Object.keys(itemTypes)[Math.floor(Math.random()*4)];collectItem(car,type);setTimeout(()=>{crate.active=true;crate.group.visible=true;},6500);break;}
  }
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;
    let target=bots.reduce((best,b)=>p.mesh.position.distanceTo(b.root.position)<p.mesh.position.distanceTo(best.root.position)?b:best,bots[0]);
    if(target&&p.life<4.7){const aim=target.root.position.clone().add(new THREE.Vector3(0,.9,0)).sub(p.mesh.position).normalize();p.vel.lerp(aim.multiplyScalar(16),dt*2.7).normalize().multiplyScalar(16);}
    p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.x+=dt*5;p.mesh.rotation.y+=dt*7;
    if(target&&p.mesh.position.distanceTo(target.root.position.clone().add(new THREE.Vector3(0,1,0)))<2){target.velocity.multiplyScalar(.25);target.stun=1.3;spawnParticles(p.mesh.position,0xff6273,15);p.life=0;}
    if(p.life<=0){scene.remove(p.mesh);projectiles.splice(i,1);}
  }
  for(let i=traps.length-1;i>=0;i--){const t=traps[i];t.life-=dt;t.mesh.rotation.y+=dt*1.5;
    for(const bot of bots)if(bot.root.position.distanceTo(t.mesh.position)<1.9){bot.stun=1.5;bot.velocity.multiplyScalar(.2);spawnParticles(t.mesh.position,0xffdc46,12);t.life=0;}
    if(t.life<=0){scene.remove(t.mesh);traps.splice(i,1);}
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.vel,dt);p.vel.y-=8*dt;p.mesh.scale.multiplyScalar(Math.max(0,1-dt*1.8));p.mesh.material.opacity=Math.max(0,p.life/p.max);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}
}

const startOverlay=document.querySelector('#start-overlay'),endOverlay=document.querySelector('#end-overlay');
const resultTitle=document.querySelector('#result-title'),resultCopy=document.querySelector('#result-copy');
function formatTime(seconds){const s=Math.max(0,Math.ceil(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function beginMatch(){blueScore=0;orangeScore=0;timeLeft=120;ended=false;running=true;ui.blue.textContent='0';ui.orange.textContent='0';ui.timer.textContent='2:00';resetPositions();startOverlay.classList.add('hidden');endOverlay.classList.add('hidden');matchStart=performance.now();clock.getDelta();showToast('KICK OFF!');beep(620,.18,'triangle');}
function finishMatch(){running=false;ended=true;touch.clear();keys.clear();if(blueScore>orangeScore){resultTitle.innerHTML='VICTORY.<br><em>WHAT A SHOT.</em>';resultCopy.textContent=`You beat the Pyro Panthers ${blueScore}–${orangeScore}. The arena is yours.`;}else if(blueScore<orangeScore){resultTitle.innerHTML='NICE<br><em>DRIVING.</em>';resultCopy.textContent=`The Pyro Panthers win ${orangeScore}–${blueScore}. Ready for a rematch?`;}else{resultTitle.innerHTML='A DRAW.<br><em>RUN IT BACK?</em>';resultCopy.textContent=`Both teams finish level at ${blueScore}–${orangeScore}. One more match?`;}endOverlay.classList.remove('hidden');}
function updateCamera(dt){const fwd=forwardOf(player.yaw),desired=player.root.position.clone().addScaledVector(fwd,-10.5).add(new THREE.Vector3(0,6.6,0));camera.position.lerp(desired,1-Math.exp(-4.2*dt));const look=player.root.position.clone().addScaledVector(fwd,7).add(new THREE.Vector3(0,1.3,0));camera.lookAt(look);}
function updateHud(){const speed=player.velocity.length()*7.2;ui.speed.textContent=String(Math.round(speed)).padStart(3,'0');ui.boost.style.width=`${player.boost}%`;ui.boostValue.textContent=String(Math.round(player.boost));ui.timer.textContent=formatTime(timeLeft);}
function gameFrame(){requestAnimationFrame(gameFrame);const dt=Math.min(clock.getDelta(),.035);if(running){timeLeft=Math.max(0,timeLeft-dt);updateCar(player,dt,true);bots.forEach((bot,i)=>updateCar(bot,dt,false,i));updateBall(dt);updateObjects(dt);if(timeLeft<=0)finishMatch();}else{crates.forEach((crate,i)=>{if(crate.active){crate.phase+=dt;crate.group.rotation.y+=dt*.35;crate.group.position.y=.9+Math.sin(crate.phase*2)*.18;}});}
  updateCamera(dt);updateHud();renderer.render(scene,camera);
}
function onKeyDown(event){const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(key))event.preventDefault();if(key==='w'||key==='arrowup')keys.add('forward');if(key==='s'||key==='arrowdown')keys.add('back');if(key==='a'||key==='arrowleft')keys.add('left');if(key==='d'||key==='arrowright')keys.add('right');if(key===' '||key==='w'&&event.code==='Space')keys.add('jump');if(key==='shift')keys.add('boost');if(key==='q'||key==='e'){if(!event.repeat&&running)useItem();}if((key==='enter'||key===' ')&&!running&&!ended){beginMatch();}if((key==='enter'||key===' ')&&ended){beginMatch();}}
function onKeyUp(event){const key=event.key.toLowerCase();if(key==='w'||key==='arrowup')keys.delete('forward');if(key==='s'||key==='arrowdown')keys.delete('back');if(key==='a'||key==='arrowleft')keys.delete('left');if(key==='d'||key==='arrowright')keys.delete('right');if(key===' '||key==='w'&&event.code==='Space')keys.delete('jump');if(key==='shift')keys.delete('boost');}
window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',()=>{keys.clear();touch.clear();});
document.querySelector('#play-btn').addEventListener('click',beginMatch);document.querySelector('#rematch-btn').addEventListener('click',beginMatch);
document.querySelector('#sound-btn').addEventListener('click',event=>{soundOn=!soundOn;event.currentTarget.classList.toggle('muted',!soundOn);event.currentTarget.textContent=soundOn?'♫':'♪';if(soundOn)beep(560,.08);});
document.querySelectorAll('[data-control]').forEach(button=>{const control=button.dataset.control;button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);if(control==='item'){if(running)useItem();return;}touch.add(control);button.classList.add('pressed');});const release=event=>{event.preventDefault();touch.delete(control);button.classList.remove('pressed');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);});
makeItemIcon(null);gameFrame();
