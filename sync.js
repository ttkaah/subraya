(function(){
'use strict';
const $=s=>document.querySelector(s);
const ls={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const FB=window.SBFire,APP=window.SBApp;
if(!FB||!APP){window.SBSync=null;return}
const {auth,db}=FB;
const CHUNK=200000;
let uid=null,enabled=false,busy=false,again=false,timer=null,due=0;
const pend=new Map();
const key=()=>'sb:sync:'+uid;
const topics=()=>db.collection('users').doc(uid).collection('topics');
const ui=(t,err)=>{const m=$('#syncmsg');if(m){m.textContent=t||'';m.className='msg'+(err?' err':'')}};
const hora=()=>new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
function friendly(e){
  const c=(e&&e.code)||'';
  if(c==='permission-denied')return 'Firebase rechazó la sincronización. Publica las reglas nuevas de firestore.rules (mira FIREBASE.md).';
  if(c==='unavailable'||c==='auth/network-request-failed')return 'Sin conexión. Se sincronizará cuando vuelva internet.';
  return (e&&e.message)||'Error de sincronización';
}
function showBox(){const b=$('#syncbox');if(!b)return;b.hidden=!uid;$('#synccb').checked=enabled}

/* ---- formato en la nube ---- */
const metaOf=(m,nc)=>JSON.parse(JSON.stringify({id:m.id,name:m.name,n:m.n||1,level:m.level,v50:1,elo:m.elo,prog:m.prog,streak:m.streak,count:m.count,
  asked:(m.asked||[]).slice(-60),used:m.used||[],wrong:m.wrong||[],exams:m.exams||[],u:m.u||Date.now(),tv:m.tv,nc}));
function chunks(t){
  const out=[];let i=0;
  while(i<t.length){let e=Math.min(t.length,i+CHUNK);if(e<t.length&&/[\uDC00-\uDFFF]/.test(t[e]))e--;out.push(t.slice(i,e));i=e}
  return out.length?out:[''];
}
async function download(id,nc){
  const s=await topics().doc(id).collection('chunks').orderBy('i').get();
  if(s.docs.length<(nc||1))throw new Error('Un temario está incompleto en la nube; se reintentará más tarde.');
  return s.docs.map(d=>d.data().t).join('');
}
async function commitAll(ops){
  for(let i=0;i<ops.length;i+=8){const b=db.batch();ops.slice(i,i+8).forEach(f=>f(b));await b.commit()}
}
async function push(m,withText){
  const ref=topics().doc(m.id);let nc=m.nc||1;
  if(!m.tv)m.tv=m.u||Date.now();
  if(withText){
    const cs=chunks(m.text),cr=ref.collection('chunks'),old=await cr.get(),ops=[];
    cs.forEach((t,i)=>ops.push(b=>b.set(cr.doc(String(i).padStart(4,'0')),{i,t})));
    old.docs.forEach(d=>{if(Number(d.id)>=cs.length)ops.push(b=>b.delete(d.ref))});
    await commitAll(ops);nc=cs.length;m.nc=nc;
  }
  await ref.set(metaOf(m,nc));
}

/* ---- sincronizar: gana siempre el cambio más reciente de cada temario ---- */
async function pull(){
  if(!enabled||!uid)return;
  if(busy){again=true;return}
  busy=true;ui('Sincronizando…');
  try{
    const snap=await topics().get(),cloud=new Map(snap.docs.map(d=>[d.id,d.data()]));
    const local=APP.lib();let done=0;
    for(const [id,c] of cloud){
      const m=local.find(x=>x.id===id),clean=Object.assign({},c);delete clean.del;
      if(c.del){
        if(m&&(m.u||0)<=c.u)await APP.remove(id);
        else if(m)await push(m,true);
        continue;
      }
      if(!m){ui('Descargando temario «'+c.name+'»…');await APP.apply(clean,await download(id,c.nc));done++}
      else if((c.u||0)>(m.u||0)){const t=c.tv!==m.tv?await download(id,c.nc):null;await APP.apply(clean,t);done++}
      else if((c.u||0)<(m.u||0)){await push(m,c.tv!==m.tv)}
    }
    for(const m of local)if(!cloud.has(m.id)){ui('Subiendo temario «'+m.name+'»…');await push(m,true)}
    ui('Sincronizado ✓ '+hora()+(done?' · '+done+' temario'+(done>1?'s':'')+' actualizado'+(done>1?'s':''):''));
  }catch(e){ui(friendly(e),true)}
  busy=false;
  if(again){again=false;pull()}
}

/* ---- avisos desde la aplicación ---- */
function touch(m,opt){
  if(!enabled||!uid)return;
  const e=pend.get(m.id)||{m,text:false};e.m=m;if(opt&&opt.text)e.text=true;pend.set(m.id,e);
  const d=opt&&opt.text?2000:30000,at=Date.now()+d;
  if(!timer||at<due){clearTimeout(timer);due=at;timer=setTimeout(flushAll,d)}
}
async function flushAll(){
  clearTimeout(timer);timer=null;due=0;
  if(!enabled||!uid||!pend.size)return;
  const items=[...pend.values()];pend.clear();let bad=false;
  for(const e of items){try{await push(e.m,e.text)}catch(err){pend.set(e.m.id,e);ui(friendly(err),true);bad=true}}
  if(!bad)ui('Sincronizado ✓ '+hora());
}
async function del(m){
  if(!enabled||!uid)return;
  pend.delete(m.id);
  const ref=topics().doc(m.id),old=await ref.collection('chunks').get();
  await commitAll(old.docs.map(d=>b=>b.delete(d.ref)));
  await ref.set({id:m.id,del:true,u:Date.now()});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushAll()});

/* ---- sesión y casilla ---- */
auth.onAuthStateChanged(async u=>{
  if(!u||u.isAnonymous){uid=null;enabled=false;pend.clear();showBox();return}
  uid=u.uid;
  let on=ls.get(key(),null);
  if(on===null){ // si ya usó la sincronización en otro dispositivo, se activa sola
    try{on=!(await topics().limit(1).get()).empty}catch(e){on=false}
    ls.set(key(),on);
  }
  enabled=!!on;showBox();
  if(enabled)await pull();else ui('');
});
$('#synccb').onchange=e=>{
  if(!uid)return;
  enabled=e.target.checked;ls.set(key(),enabled);
  if(enabled)pull();else ui('Sincronización desactivada. Lo que ya está en la nube se queda ahí.');
};
$('#syncnow').onclick=async()=>{if(!enabled){ui('Activa antes la casilla de sincronización.',true);return}await flushAll();await pull()};

window.SBSync={touch,del,pull,enabled:()=>enabled};
})();
