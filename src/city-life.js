import { buildWalkGraph, routeBetween, sampleRoute, redirectRoute } from './route-logic.js';

export const ROLES = {citizen:'市民',youth:'青年',officeworker:'上班族',cyclist:'通勤族',parent:'家長',child:'學童',elder:'長者',worker:'工程人員',researcher:'研究員',traveller:'旅人'};
export const DEFAULT_AVATAR = {name:'我的角色',role:'citizen',skin:'#dfb18b',shirt:'#52755e',hair:'#4d4039',hat:'none',accessory:'none',hairStyle:'short',outfit:'plain',pants:'#45595a',height:1,width:1,face:'none'};
const FLOW_DEFINITIONS = [
  ['f1','民生 × 家庭','c1','c2','parent','生活補給'],
  ['f2','家庭 × 校園','c2','c4','child','書本'],
  ['f3','校園 × 青年','c4','c5','youth','學習工具'],
  ['f4','青年 × 交通','c5','c6','cyclist','通勤包'],
  ['f5','交通 × 健康','c6','c3','elder','健康補給'],
  ['f6','健康 × 環境','c3','c8','citizen','綠色盆栽'],
  ['f7','數位 × 產業','c7','c9','researcher','數位工具'],
  ['f8','產業 × 文化','c9','c11','traveller','城市導覽'],
  ['f9','環境 × 安全','c8','c10','worker','安全工具'],
  ['f10','安全 × 工程','c10','c12','worker','工程物資'],
];
export const FLOWS = FLOW_DEFINITIONS.map(([id,title,from,to,role,carry])=>({id,title,from,to,role,carry,description:'串接兩座主題島的城市行走示意；角色與搬運物件用於互動展示，不表示兩項政策存在經查證的協作關係。',basis:'視覺示意，非經查證政策關係'}));
export function normalizeAvatar(input={}) {
  input=input&&typeof input==='object'?input:{};
  const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  return {name:typeof input.name==='string'?(input.name.trim().slice(0,24)||DEFAULT_AVATAR.name):DEFAULT_AVATAR.name,
    role:Object.hasOwn(ROLES,input.role)?input.role:DEFAULT_AVATAR.role,
    skin:color(input.skin,DEFAULT_AVATAR.skin),shirt:color(input.shirt,DEFAULT_AVATAR.shirt),hair:color(input.hair,DEFAULT_AVATAR.hair),
    hat:['none','cap','helmet'].includes(input.hat)?input.hat:'none',accessory:['none','bag','umbrella'].includes(input.accessory)?input.accessory:'none',
    hairStyle:['short','long','bun','bald'].includes(input.hairStyle)?input.hairStyle:'short',outfit:['plain','vest','coat'].includes(input.outfit)?input.outfit:'plain',
    pants:color(input.pants,DEFAULT_AVATAR.pants),height:Number.isFinite(Number(input.height))?Math.min(1.4,Math.max(.7,Number(input.height))):1,
    width:Number.isFinite(Number(input.width))?Math.min(1.4,Math.max(.7,Number(input.width))):1,face:['none','glasses','mask'].includes(input.face)?input.face:'none'};
}

export function createCityLife({THREE,scene,positions,categories,onEvent=()=>{},onSelectPerson=()=>{}}) {
  const graph=buildWalkGraph(positions,categories.map(c=>c.id));
  const categoryNames=new Map(categories.map(c=>[c.id,c.title]));
  const root=new THREE.Group();root.name='city-life';scene.add(root);
  const cube=new THREE.BoxGeometry(1,1,1), sphere=new THREE.SphereGeometry(1,10,8), cylinder=new THREE.CylinderGeometry(1,1,1,10), cone=new THREE.ConeGeometry(1,1,12);
  const geometries=new Set([cube,sphere,cylinder,cone]),materials=new Map(),textures=new Map();
  const mat=(color)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return materials.get(color);};
  function shape(parent,geometry,color,position,scale){const m=new THREE.Mesh(geometry,mat(color));m.position.set(...position);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
  function carryBadge(kind) {
    if(!textures.has(kind)) {
      const size=48, pixels=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const index=(y*size+x)*4;
        if(Math.hypot(x-23.5,y-23.5)>23) continue;
        let color=[251,245,223];
        const edge=Math.hypot(x-23.5,y-23.5)>21;
        const box=x>=12&&x<=35&&y>=17&&y<=34;
        const handle=x>=18&&x<=29&&y>=11&&y<=17&&(x<21||x>26||y<14);
        if(edge)color=[91,121,99];
        if(box||handle)color=kind==='綠色盆栽'?[91,139,86]:kind==='書本'?[83,127,157]:[185,124,72];
        if(box&&x>=22&&x<=25)color=[247,221,159];
        pixels.set([...color,255],index);
      }
      const texture=new THREE.DataTexture(pixels,size,size);texture.needsUpdate=true;
      texture.colorSpace=THREE.SRGBColorSpace;textures.set(kind,texture);
      materials.set(`badge-${kind}`,new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
    }
    const badge=new THREE.Sprite(materials.get(`badge-${kind}`));badge.position.set(0,1.35,0);badge.scale.set(.42,.42,1);return badge;
  }
  function figure(config,carry,isAvatar=false){
    const group=new THREE.Group();root.add(group);
    const torso=shape(group,cube,config.shirt,[0,.44,0],[.29,.32,.19]);
    const head=shape(group,sphere,config.skin,[0,.77,0],[.225,.235,.205]);
    if(config.hairStyle!=='bald')shape(group,sphere,config.hair,[0,.89,-.025],[.23,.15,.205]);
    if(config.hairStyle==='long')shape(group,cube,config.hair,[0,.7,-.14],[.42,.37,.15]);
    if(config.hairStyle==='bun')shape(group,sphere,config.hair,[0,1.05,-.06],[.12,.13,.12]);
    if(config.outfit==='vest')shape(group,cube,0xd5b86b,[0,.45,.108],[.31,.25,.035]);
    if(config.outfit==='coat')shape(group,cube,0xe5e6d9,[0,.35,.01],[.34,.47,.23]);
    for(const x of [-.078,.078])shape(group,sphere,0x26372f,[x,.79,.19],[.022,.027,.016]);
    shape(group,cube,0xb78269,[0,.69,.19],[.055,.012,.014]);
    const limbs={};
    for(const [key,x] of [['left',-.085],['right',.085]]){
      const leg=new THREE.Group();leg.position.set(x,.29,0);group.add(leg);
      shape(leg,cube,config.pants,[0,-.14,0],[.105,.28,.12]);shape(leg,cube,0xf4ead7,[0,-.265,.035],[.125,.055,.19]);limbs[`${key}Leg`]=leg;
      const arm=new THREE.Group();arm.position.set(x*2.2,.56,0);group.add(arm);
      shape(arm,cube,config.shirt,[0,-.1,0],[.09,.23,.12]);shape(arm,sphere,config.skin,[0,-.24,0],[.055,.065,.055]);limbs[`${key}Arm`]=arm;
    }
    if(config.hat!=='none'){
      const color=config.hat==='helmet'?0xe2b84b:0x6c8895;
      shape(group,sphere,color,[0,.99,-.015],[.25,.12,.23]);shape(group,cube,color,[0,.96,.12],[.47,.04,.36]);
    }
    if(config.face==='glasses'||config.role==='researcher'||config.role==='elder'){
      for(const x of [-.078,.078]){shape(group,cube,0x526663,[x,.79,.205],[.11,.075,.015]);shape(group,cube,0xd4e7dd,[x,.79,.218],[.078,.045,.008]);}
    }
    if(config.face==='mask')shape(group,cube,0xc9dedb,[0,.7,.2],[.24,.12,.025]);
    if(config.role==='child'){shape(group,cube,0xdcb449,[0,.42,-.17],[.25,.26,.14]);group.scale.setScalar(.8);}
    if(config.accessory==='bag'||config.role==='traveller')shape(group,cube,0xc19b68,[.29,.29,0],[.16,.24,.16]);
    if(config.accessory==='umbrella'){
      shape(group,cylinder,0x61706d,[.3,.65,.03],[.012,.9,.012]);shape(group,cone,0xc08677,[.3,1.22,.03],[.48,.27,.48]);
    }
    const cargo=new THREE.Group();group.add(cargo);
    if(carry){
      const badge=carryBadge(carry);cargo.add(badge);
      if(carry==='綠色盆栽'){shape(cargo,cylinder,0xae8763,[0,.42,.3],[.12,.17,.12]);shape(cargo,sphere,0x729864,[0,.61,.3],[.17,.18,.16]);}
      else{shape(cargo,cube,carry==='書本'?0x718da0:0xc7a16c,[0,.44,.27],[.32,.2,.2]);shape(cargo,cube,0xf1d9a2,[0,.44,.375],[.04,.2,.014]);}
    }
    const wheels=[];
    if(config.role==='cyclist'){
      for(const z of [-.32,.35]){const wheel=shape(group,cylinder,0x465c59,[0,.19,z],[.19,.055,.19]);wheel.rotation.z=Math.PI/2;wheels.push(wheel);const spoke=shape(group,cube,0xe1d7bb,[.04,.19,z],[.02,.025,.32]);wheels.push(spoke);}
      const frame=shape(group,cube,0xbf895f,[0,.39,.04],[.045,.045,.66]);frame.rotation.x=.35;
      shape(group,cube,0xbf895f,[0,.35,-.16],[.045,.3,.045]);shape(group,cube,0x4b655b,[0,.51,-.16],[.18,.035,.12]);
      shape(group,cube,0x4b655b,[0,.6,.35],[.33,.035,.04]);
    }
    let marker=null;
    if(isAvatar){marker=shape(group,cone,0xd28a48,[0,1.48,0],[.13,.2,.13]);marker.rotation.z=Math.PI;}
    const childScale=config.role==='child'?.8:1;group.scale.set(config.width*childScale,config.height*childScale,config.width*childScale);
    return {group,head,torso,limbs,cargo,wheels,marker};
  }
  let elapsed=0,arrivals=0,serial=0,carryVisible=true,flowsVisible=false,selectedFlow=null,disposed=false;
  const logs=[];
  function log(text,personId){const event={id:++serial,text,time:elapsed,personId};logs.unshift(event);logs.splice(60);onEvent({...event});}
  const routes=new Map(FLOWS.map(flow=>[flow.id,routeBetween(graph,flow.from,flow.to)]));
  const people=[];
  const colors=['#759587','#cb987a','#83a4b0','#c6b16f'];
  for(const [index,flow] of FLOWS.entries()) for(let copy=0;copy<2;copy++){
    const config=normalizeAvatar({name:`${ROLES[flow.role]} ${copy+1}`,role:flow.role,shirt:colors[index%colors.length],hat:flow.role==='worker'?'helmet':flow.role==='cyclist'?'helmet':'none'});
    const model=figure(config,flow.carry);
    const route=routes.get(flow.id),travelled=route.total*(copy===0?.15:.65);
    const person={id:`${flow.id}-p${copy+1}`,name:config.name,role:config.role,config,flowId:flow.id,carry:flow.carry,from:flow.from,to:flow.to,route,travelled,direction:copy===0?1:-1,speed:flow.role==='cyclist'?.85:.55+(index%3)*.06,wait:0,state:'walking',model,isAvatar:false};
    model.group.userData.personId=person.id;people.push(person);
  }
  const avatar={id:'avatar',name:DEFAULT_AVATAR.name,role:DEFAULT_AVATAR.role,config:{...DEFAULT_AVATAR},from:categories[0].id,to:categories[0].id,route:routeBetween(graph,categories[0].id,categories[0].id),travelled:0,direction:1,speed:.85,wait:0,state:'idle',model:figure(DEFAULT_AVATAR,null,true),isAvatar:true,auto:false};
  avatar.model.group.userData.personId=avatar.id;people.push(avatar);
  const ambientPoses=['read','sit','wave','boxes','skate','read'];
  ambientPoses.forEach((pose,index)=>{
    const category=categories[index*2], config=normalizeAvatar({name:['閱讀居民','休憩居民','招呼居民','搬箱居民','滑板青年','閱讀青年'][index],role:index===4?'youth':'citizen',shirt:colors[index%colors.length]});
    const person={id:`ambient-${index}`,name:config.name,role:config.role,config,from:category.id,to:category.id,route:routeBetween(graph,category.id,category.id),travelled:0,direction:1,speed:0,state:'ambient',pose,model:figure(config,pose==='read'?'書本':pose==='boxes'?'工程物資':null),isAvatar:false};
    person.model.group.userData.personId=person.id;
    if(pose==='skate'){shape(person.model.group,cube,0x8b9d7e,[0,-.03,0],[.24,.055,.65]);for(const z of [-.24,.24])shape(person.model.group,cylinder,0x4c6255,[0,-.09,z],[.07,.3,.07]).rotation.z=Math.PI/2;}
    people.push(person);
  });
  const guideConfig=normalizeAvatar({name:'風城嚮導',role:'traveller',shirt:'#c47d55',hat:'cap',accessory:'bag'});
  const guide={id:'guide',name:guideConfig.name,role:guideConfig.role,config:guideConfig,from:categories[0].id,to:categories[1].id,route:routeBetween(graph,categories[0].id,categories[1].id),travelled:0,direction:1,speed:.7,wait:0,state:'walking',model:figure(guideConfig,null),isAvatar:false,isGuide:true};
  guide.model.group.userData.personId=guide.id;people.push(guide);
  const lines=FLOWS.map((flow,index)=>{
    const route=routes.get(flow.id),points=route.points.map(p=>new THREE.Vector3(p[0],p[1]+.06,p[2]));
    const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
    const geometry=new THREE.TubeGeometry(path,Math.max(2,points.length*3),.05,5,false);geometries.add(geometry);
    const material=new THREE.MeshBasicMaterial({color:[0xc9744e,0x557d95,0x8d965a][index%3],transparent:true,opacity:.8,depthTest:false,depthWrite:false});materials.set(`line-${flow.id}`,material);
    const line=new THREE.Mesh(geometry,material);line.visible=false;line.renderOrder=3;line.userData.flowId=flow.id;root.add(line);
    const bead=shape(root,sphere,0xf7da8c,[0,.6,0],[.085,.085,.085]);bead.visible=false;
    return {flow,route,line,bead};
  });
  // Painted perimeter paths match the route graph and stay clear of central buildings.
  for(let i=0;i<positions.length;i++){
    const points=graph.nodes.slice(i*12,i*12+12).map(n=>new THREE.Vector3(...n.point));points.push(points[0]);
    const geometry=new THREE.BufferGeometry().setFromPoints(points);geometries.add(geometry);
    const material=new THREE.LineBasicMaterial({color:0xeee9d4,transparent:true,opacity:.75});materials.set(`walkway-${i}`,material);
    root.add(new THREE.Line(geometry,material));
  }
  graph.edges.forEach((edges,a)=>edges.forEach(({to:b})=>{
    if(b<a)return;
    const p=graph.nodes[a].point,q=graph.nodes[b].point;
    const length=Math.hypot(q[0]-p[0],q[2]-p[2]);
    const road=shape(root,cube,0xe5dfca,[(p[0]+q[0])/2,.485,(p[2]+q[2])/2],[.22,.035,length]);
    road.rotation.y=Math.atan2(q[0]-p[0],q[2]-p[2]);road.receiveShadow=true;road.castShadow=false;
  }));
  function display(person){
    const sampled=sampleRoute(person.route,person.travelled);
    person.model.group.position.set(...sampled.position);
    const walking=person.state==='walking';
    const pose=person.pose||(person.isGuide&&person.state==='waiting'?'wave':null);
    person.model.group.rotation.y=Math.atan2(sampled.direction[0]*person.direction,sampled.direction[2]*person.direction);
    const stride=walking?Math.sin(elapsed*9+people.indexOf(person))*.55:0;
    const {leftLeg,rightLeg,leftArm,rightArm}=person.model.limbs;
    leftLeg.rotation.x=stride;rightLeg.rotation.x=-stride;
    leftArm.rotation.x=person.carry?-.75:-stride*.75;rightArm.rotation.x=person.carry?-.75:stride*.75;
    if(pose==='wave'){rightArm.rotation.x=-2.4;rightArm.rotation.z=Math.sin(elapsed*4)*.3;}
    else rightArm.rotation.z=0;
    if(pose==='sit'){leftLeg.rotation.x=rightLeg.rotation.x=-1.5;person.model.group.position.y-=.12;}
    if(pose==='read'||pose==='boxes'){leftArm.rotation.x=rightArm.rotation.x=-.95;}
    if(pose==='skate'){person.model.group.position.x+=Math.sin(elapsed*.65)*.45;person.model.group.rotation.y=Math.cos(elapsed*.65)>0?Math.PI/2:-Math.PI/2;leftArm.rotation.z=.6;rightArm.rotation.z=-.6;}
    if(Number.isFinite(person.poseYaw)&&pose)person.model.group.rotation.y=person.poseYaw;
    person.model.wheels.forEach(wheel=>{if(walking)wheel.rotation.x=elapsed*6;});
    person.model.head.rotation.y=Math.sin(elapsed*.9+people.indexOf(person))*.055;
    person.model.group.position.y+=walking?Math.abs(Math.sin(elapsed*9))*.022:0;
    person.model.cargo.visible=carryVisible;
  }
  function beginAvatar(target,keepPose=false){
    if(!keepPose){avatar.pose=null;avatar.pendingPose=null;}
    if(!graph.stops.has(target))return false;
    const next=redirectRoute(graph,avatar.route,avatar.travelled,target)||routeBetween(graph,avatar.to,target);
    if(!next.points.length)return false;
    avatar.from=avatar.to;avatar.to=target;avatar.route=next;avatar.travelled=0;avatar.direction=1;avatar.wait=0;avatar.state=next.total>.001?'walking':'idle';
    if(avatar.state==='walking')log(`${avatar.name} 前往 ${categoryNames.get(target)}（示意行程）`,avatar.id);
    display(avatar);return true;
  }
  function refreshLines(){lines.forEach(({flow,line,bead})=>{line.visible=flowsVisible;bead.visible=line.visible;line.material.opacity=selectedFlow&&selectedFlow!==flow.id?.18:.9;bead.scale.setScalar(.085*(selectedFlow===flow.id?1.5:1));});}
  people.forEach(display);
  return {
    update(dt){
      if(disposed||!Number.isFinite(dt)||dt<=0)return;
      const step=Math.min(dt,.25);elapsed+=step;
      for(const person of people){
        if(person.state==='waiting'){
          person.wait-=step;
          if(person.wait<=0){
            if(person.isGuide){const index=categories.findIndex(c=>c.id===person.to);person.from=person.to;person.to=categories[(index+1)%categories.length].id;person.route=routeBetween(graph,person.from,person.to);person.travelled=0;person.state='walking';log(`風城嚮導前往 ${categoryNames.get(person.to)}（巡遊示意）`,person.id);}
            else if(person.isAvatar){person.state='idle';if(person.auto){const index=categories.findIndex(c=>c.id===person.to);beginAvatar(categories[(index+1)%categories.length].id);}}
            else{person.direction*=-1;person.state='walking';log(`${person.name} 出發前往 ${categoryNames.get(person.direction>0?person.to:person.from)}（${person.carry}示意）`,person.id);}
          }
        }else if(person.state==='walking'){
          person.travelled+=person.speed*step*person.direction;
          if(person.travelled>=person.route.total||person.travelled<=0){
            person.travelled=Math.max(0,Math.min(person.route.total,person.travelled));person.state=person.isAvatar&&!person.auto?'idle':'waiting';person.wait=person.isAvatar||person.isGuide?3:1.4;arrivals++;
            if(person.isAvatar&&person.pendingPose){person.pose=person.pendingPose.pose;person.poseYaw=person.pendingPose.yaw;person.pendingPose=null;}
            log(`${person.name} 抵達 ${categoryNames.get(person.direction>0?person.to:person.from)}（示意行程）`,person.id);
          }
        }
        display(person);
      }
      lines.forEach(({route,bead},index)=>{const p=sampleRoute(route,(elapsed*.75+index*2)%Math.max(route.total,.001)).position;bead.position.set(p[0],p[1]+.12,p[2]);});
    },
    setFlowVisible(value){flowsVisible=Boolean(value);refreshLines();},
    setMarkersVisible(value){people.forEach(p=>{if(p.model.marker)p.model.marker.visible=Boolean(value);});},
    getFlowPickables(){return lines.filter(entry=>entry.line.visible).map(entry=>entry.line);},
    setCarryVisible(value){carryVisible=Boolean(value);people.forEach(p=>{p.model.cargo.visible=carryVisible;});},
    selectFlow(id){selectedFlow=FLOWS.some(f=>f.id===id)?id:null;if(selectedFlow)flowsVisible=true;refreshLines();},
    setAvatar(input){const config=normalizeAvatar(input);root.remove(avatar.model.group);avatar.config=config;avatar.name=config.name;avatar.role=config.role;avatar.model=figure(config,null,true);avatar.model.group.userData.personId=avatar.id;display(avatar);return {...config};},
    moveAvatar:beginAvatar,
    setAvatarAuto(value){avatar.auto=Boolean(value);if(avatar.auto){avatar.pose=null;avatar.pendingPose=null;}if(avatar.auto&&avatar.state==='idle'){const index=categories.findIndex(c=>c.id===avatar.to);beginAvatar(categories[(index+1)%categories.length].id);}},
    poseAvatar(input={}){if(!graph.stops.has(input.categoryId)||!['stand','wave','sit'].includes(input.pose))return false;avatar.auto=false;const pose={pose:input.pose,yaw:Number.isFinite(Number(input.yaw))?Number(input.yaw):0};avatar.pendingPose=pose;avatar.pose=null;if(!beginAvatar(input.categoryId,true))return false;if(avatar.state==='idle'){avatar.pose=pose.pose;avatar.poseYaw=pose.yaw;avatar.pendingPose=null;display(avatar);}return true;},
    getSnapshot(){return {people:people.map(p=>({id:p.id,name:p.name,role:p.role,from:p.from,to:p.to,state:p.state,progress:p.route.total?p.travelled/p.route.total:1,position:p.model.group.position.toArray(),isAvatar:p.isAvatar,flowId:p.flowId||null,carry:p.carry||null,pose:p.pose||(p.isGuide&&p.state==='waiting'?'wave':null),isGuide:!!p.isGuide})),flows:FLOWS.map(f=>({...f})),avatar:{config:{...avatar.config},target:avatar.to,state:avatar.state,auto:avatar.auto,pose:avatar.pose||null},logs:logs.map(item=>({...item})),stats:{people:people.length,walking:people.filter(p=>p.state==='walking').length,arrivals},selectedFlow,flowsVisible,carryVisible};},
    getAvatarPosition(){return avatar.model.group.position.clone();},
    getPersonPosition(id){return people.find(p=>p.id===id)?.model.group.position.clone()||null;},
    getPickables(){const meshes=[];people.forEach(p=>p.model.group.traverse(o=>{if(o.isMesh){o.userData.personId=p.id;meshes.push(o);}}));return meshes;},
    pickPerson(id){if(people.some(p=>p.id===id))onSelectPerson(id);},
    dispose(){disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
  };
}
