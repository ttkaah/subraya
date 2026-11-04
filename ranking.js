(function(){
'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const cfg=window.FIREBASE_CONFIG;
const ready=!!(cfg&&cfg.apiKey&&cfg.projectId&&window.firebase);
let S={name:'',on:false,pend:{ok:0,n:0},weeks:[],...ls.get('sb:lb',{})};
if(!S.pend||typeof S.pend.n!=='number')S.pend={ok:0,n:0};
if(!Array.isArray(S.weeks))S.weeks=[];
const save=()=>ls.set('sb:lb',S);
let db,auth,view='week',timer=null,busy=false;
const NAME_RE=/^[\p{L}\p{N} ._-]{2,20}$/u;
const msg=(t,e)=>{const m=$('#rkmsg');m.textContent=t||'';m.className='msg'+(e?' err':'')};

function weekKey(d=new Date()){
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-day);const y=t.getUTCFullYear();
  const w=Math.ceil(((t-new Date(Date.UTC(y,0,1)))/864e5+1)/7);
  return y+'-W'+String(w).padStart(2,'0');
}
function friendly(e){
  const c=(e&&e.code)||'';
  if(c==='permission-denied')return 'Firebase rechazó la operación. Revisa que las reglas de Firestore estén publicadas.';
  if(c==='auth/operation-not-allowed'||c==='auth/admin-restricted-operation')return 'Activa el acceso anónimo en Firebase → Authentication → Método de acceso.';
  if(c==='auth/unauthorized-domain')return 'Añade tu dominio en Firebase → Authentication → Configuración → Dominios autorizados.';
  if(c==='unavailable'||c==='auth/network-request-failed')return 'Sin conexión con Firebase. Revisa tu internet.';
  if(c==='failed-precondition'||c==='not-found')return 'Firestore no está creado o falta un índice. Revisa FIREBASE.md.';
  return (e&&e.message)||'Error desconocido';
}
function show(){
  $('#rkoff').hidden=ready;$('#rkjoin').hidden=!ready||S.on;$('#rkon').hidden=!ready||!S.on;
  if(S.on)$('#rkme').textContent='Juegas como «'+S.name+'». Solo se comparten tu apodo y tus contadores de aciertos.';
}
if(!ready){show();window.rankRecord=()=>{};return}

firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();
async function uid(){
  if(!auth.currentUser){
    await new Promise(r=>{const u=auth.onAuthStateChanged(()=>{u();r()})});
    if(!auth.currentUser)await auth.signInAnonymously();
  }
  return auth.currentUser.uid;
}

/* ---- envío de puntos (acumulados y por lotes, para gastar pocas escrituras) ---- */
window.rankRecord=(ok,n)=>{
  if(!S.on||!n)return;
  S.pend.ok+=ok;S.pend.n+=n;save();
  clearTimeout(timer);timer=setTimeout(flush,15000);
};
async function flush(){
  clearTimeout(timer);timer=null;
  if(!S.on||busy||S.pend.n<=0)return;
  busy=true;
  const take=Math.min(S.pend.n,250),okT=take===S.pend.n?S.pend.ok:Math.min(take,Math.round(S.pend.ok*take/S.pend.n));
  const d={ok:okT,n:take};
  S.pend={ok:S.pend.ok-okT,n:S.pend.n-take};save();
  try{
    const id=await uid(),wk=weekKey(),F=firebase.firestore.FieldValue;
    const r1=db.collection('players').doc(id),r2=db.collection('weeks').doc(wk).collection('players').doc(id);
    await db.runTransaction(async tx=>{
      const [a,b]=await Promise.all([tx.get(r1),tx.get(r2)]);
      const mk=(s,min)=>{const o=(s.exists?s.data().ok:0)+d.ok,n=(s.exists?s.data().n:0)+d.n;
        return {name:S.name,ok:o,n,pct:n>=min?o/n:F.delete(),t:F.serverTimestamp()}};
      tx.set(r1,mk(a,30),{merge:true});tx.set(r2,mk(b,15),{merge:true});
    });
    if(!S.weeks.includes(wk)){S.weeks.push(wk);save()}
    msg('');
  }catch(e){S.pend={ok:S.pend.ok+d.ok,n:S.pend.n+d.n};save();msg(friendly(e),true)}
  busy=false;
  if(S.pend.n>0&&!timer)timer=setTimeout(flush,15000);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});

/* ---- tabla ---- */
async function loadView(){
  if(!S.on)return;
  const box=$('#rktable');box.textContent='Cargando…';
  try{
    await flush();
    const id=await uid(),wk=weekKey();
    const col=view==='week'?db.collection('weeks').doc(wk).collection('players'):db.collection('players');
    const snap=await col.orderBy(view==='pct'?'pct':'ok','desc').limit(25).get();
    box.innerHTML='';
    box.append(el('p','msg',view==='week'?'Se reinicia cada lunes.':view==='pct'?'Hace falta haber respondido al menos 30 preguntas para aparecer.':'Aciertos acumulados de todos los tiempos.'));
    if(snap.empty){box.append(el('p',null,'Todavía no hay nadie aquí. ¡Sé el primero!'));return}
    const wrap=el('div','lbw'),t=el('table','lbt'),hd=el('tr'),th=el('thead'),tb=el('tbody');
    ['#','Jugador','Aciertos','Preguntas','Precisión'].forEach(x=>hd.append(el('th',null,x)));th.append(hd);t.append(th);
    let found=false;
    snap.docs.forEach((doc,i)=>{
      const x=doc.data(),tr=el('tr',doc.id===id?'me':'');if(doc.id===id)found=true;
      [i<3?['🥇','🥈','🥉'][i]:String(i+1),x.name||'—',String(x.ok),String(x.n),x.n?Math.round(100*x.ok/x.n)+'%':'–'].forEach(v=>tr.append(el('td',null,v)));
      tb.append(tr);
    });
    t.append(tb);wrap.append(t);box.append(wrap);
    if(!found){
      const mine=await col.doc(id).get();
      if(mine.exists){const x=mine.data();
        box.append(el('p','msg',view==='pct'&&x.pct==null?'Todavía no apareces: te faltan '+Math.max(0,(view==='pct'?30:15)-x.n)+' preguntas.':'Tú: '+x.ok+' aciertos de '+x.n+' (fuera del top 25).'))}
    }
  }catch(e){box.textContent='';msg(friendly(e),true)}
}

/* ---- botones ---- */
document.querySelectorAll('.rtab').forEach(b=>b.onclick=()=>{
  view=b.dataset.v;document.querySelectorAll('.rtab').forEach(x=>x.setAttribute('aria-selected',x===b));loadView();
});
$('#rkref').onclick=loadView;
$('#rkgo').onclick=async()=>{
  const nm=$('#rkname').value.trim();
  if(!NAME_RE.test(nm)){msg('Usa entre 2 y 20 caracteres: letras, números, espacios, punto o guion.',true);return}
  try{await uid();S={...S,name:nm,on:true,pend:{ok:0,n:0}};save();msg('');show();loadView()}
  catch(e){msg(friendly(e),true)}
};
$('#rkren').onclick=async()=>{
  const nm=(prompt('Nuevo apodo (2-20 caracteres):',S.name)||'').trim();
  if(!nm||nm===S.name)return;
  if(!NAME_RE.test(nm)){msg('Apodo no válido: usa 2-20 letras, números, espacios, punto o guion.',true);return}
  try{
    const id=await uid();await flush();
    const refs=[db.collection('players').doc(id),...S.weeks.map(w=>db.collection('weeks').doc(w).collection('players').doc(id))];
    for(const r of refs){const s=await r.get();if(s.exists)await r.update({name:nm})}
    S.name=nm;save();show();loadView();
  }catch(e){msg(friendly(e),true)}
};
$('#rkleave').onclick=async()=>{
  if(!confirm('Se borrarán tu apodo y tus puntos de la clasificación. ¿Continuar?'))return;
  try{
    const id=await uid();
    await db.collection('players').doc(id).delete();
    for(const w of S.weeks)await db.collection('weeks').doc(w).collection('players').doc(id).delete();
    S={name:'',on:false,pend:{ok:0,n:0},weeks:[]};save();msg('Has salido de la clasificación.');show();
  }catch(e){msg(friendly(e),true)}
};

show();
if(S.on){
  if(S.pend.n>0)flush();
  if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();loadView()}});io.observe($('#rank'))}
  else loadView();
}
})();
