(function(){
'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const cfg=window.FIREBASE_CONFIG;
const ready=!!(cfg&&cfg.apiKey&&cfg.projectId&&window.firebase);
let S={name:'',on:false,upg:false,av:'',pend:{ok:0,n:0},weeks:[],...ls.get('sb:lb',{})};
if(!S.pend||typeof S.pend.n!=='number')S.pend={ok:0,n:0};
if(!Array.isArray(S.weeks))S.weeks=[];
const save=()=>ls.set('sb:lb',S);
let db,auth,view='week',amode='new',timer=null,busy=false;
const NAME_RE=/^[\p{L}\p{N} ._-]{2,20}$/u;
const EMOJIS=['🦊','🐼','🐯','🦉','🐙','🦄','🐸','🐧','🦁','🐨','🐲','🚀'];
const AV_RE=/^p:data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
const msg=(t,e)=>{const m=$('#rkmsg');m.textContent=t||'';m.className='msg'+(e?' err':'')};

function weekKey(d=new Date()){
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-day);const y=t.getUTCFullYear();
  const w=Math.ceil(((t-new Date(Date.UTC(y,0,1)))/864e5+1)/7);
  return y+'-W'+String(w).padStart(2,'0');
}
function friendly(e){
  const c=(e&&e.code)||'';
  if(c==='permission-denied')return 'Firebase rechazó la operación. Revisa que las reglas de Firestore estén publicadas (FIREBASE.md).';
  if(c==='auth/operation-not-allowed')return 'Activa «Correo electrónico/contraseña» en Firebase → Authentication → Método de acceso.';
  if(c==='auth/email-already-in-use'||c==='auth/credential-already-in-use')return 'Ese nombre ya está en uso. Elige otro, o pulsa «Entrar» si es tuyo.';
  if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials','auth/invalid-email'].includes(c))return 'Nombre o contraseña incorrectos.';
  if(c==='auth/weak-password')return 'La contraseña debe tener al menos 6 caracteres.';
  if(c==='auth/too-many-requests')return 'Demasiados intentos. Espera unos minutos.';
  if(c==='auth/requires-recent-login')return 'Vuelve a iniciar sesión e inténtalo de nuevo.';
  if(c==='auth/unauthorized-domain')return 'Añade tu dominio en Firebase → Authentication → Configuración → Dominios autorizados.';
  if(c==='unavailable'||c==='auth/network-request-failed')return 'Sin conexión con Firebase. Revisa tu internet.';
  if(c==='failed-precondition'||c==='not-found')return 'Firestore no está creado o falta un índice. Revisa FIREBASE.md.';
  return (e&&e.message)||'Error desconocido';
}

/* ---- avatares: solo se pintan formatos conocidos (nada de URLs externas) ---- */
function avEl(av,name,sz){
  const s=el('span','av');s.style.width=s.style.height=sz+'px';s.style.fontSize=Math.round(sz*.55)+'px';
  if(typeof av==='string'&&av.length<=15000&&AV_RE.test(av)){const i=document.createElement('img');i.src=av.slice(2);i.alt='';s.append(i)}
  else if(typeof av==='string'&&av.startsWith('e:')&&EMOJIS.includes(av.slice(2)))s.textContent=av.slice(2);
  else{s.textContent=(name||'?').trim().charAt(0).toUpperCase();s.classList.add('ini')}
  return s;
}
async function photoToAv(file){
  const url=URL.createObjectURL(file);
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('No se pudo leer la imagen.'));i.src=url});
  const c=document.createElement('canvas');c.width=c.height=96;
  const s=Math.min(img.width,img.height);
  c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,96,96);
  URL.revokeObjectURL(url);
  for(const q of [.75,.6,.45]){const d=c.toDataURL('image/jpeg',q);if(d.length<=12000)return 'p:'+d}
  throw new Error('La imagen es demasiado compleja. Prueba con otra.');
}
async function emailOf(nm){
  if(!(window.crypto&&crypto.subtle))throw new Error('Abre la web desde https:// para poder usar perfiles.');
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nm.trim().toLowerCase()));
  return 'u'+[...new Uint8Array(b)].slice(0,20).map(x=>x.toString(16).padStart(2,'0')).join('')+'@subraya.app';
}

/* ---- pantalla ---- */
function show(){
  if(!ready)$('#rkoff').querySelector('p').textContent=!cfg||!cfg.apiKey?'La clasificación no está activada: falta pegar la configuración de Firebase en firebase-config.js (mira FIREBASE.md).':'No se pudieron cargar los scripts de Firebase. Puede que tu red (colegio, VPN, bloqueador) bloquee gstatic.com. Prueba con otra red, por ejemplo los datos del móvil.';
  $('#rkoff').hidden=ready;
  const out=ready&&!S.on,up=ready&&S.on&&S.upg,inn=ready&&S.on&&!S.upg;
  $('#rkauth').hidden=!out;$('#rkup').hidden=!up;$('#rkprof').hidden=!(inn||up);$('#rkviews').hidden=!ready;
  $('#rkacts').hidden=up;
  if(S.on){
    const box=$('#rkme');box.innerHTML='';box.append(avEl(S.av,S.name,52));
    const d=el('div');d.append(el('b',null,S.name),el('small',null,up?'Perfil sin contraseña':'Sesión iniciada'));box.append(d);
  }
}
if(!ready){show();window.rankRecord=()=>{};return}

firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();
const F=()=>firebase.firestore.FieldValue;

auth.onAuthStateChanged(async u=>{
  if(u&&!u.isAnonymous){
    S.on=true;S.upg=false;
    try{const s=await db.collection('players').doc(u.uid).get();if(s.exists){S.name=s.data().name||S.name;S.av=s.data().av||''}}catch(e){}
  }else if(u&&u.isAnonymous&&S.on){S.upg=true}
  else S={...S,on:false,upg:false,name:'',av:'',pend:{ok:0,n:0},weeks:[]};
  save();show();loadView();
});

/* ---- envío de puntos (acumulados y por lotes) ---- */
window.rankRecord=(ok,n)=>{
  if(!S.on||!n)return;
  S.pend.ok+=ok;S.pend.n+=n;save();
  clearTimeout(timer);timer=setTimeout(flush,15000);
};
async function flush(){
  clearTimeout(timer);timer=null;
  const u=auth.currentUser;
  if(!S.on||!u||busy||S.pend.n<=0||!S.name)return;
  busy=true;
  const take=Math.min(S.pend.n,250),okT=take===S.pend.n?S.pend.ok:Math.min(take,Math.round(S.pend.ok*take/S.pend.n));
  const d={ok:okT,n:take};
  S.pend={ok:S.pend.ok-okT,n:S.pend.n-take};save();
  try{
    const id=u.uid,wk=weekKey();
    const r1=db.collection('players').doc(id),r2=db.collection('weeks').doc(wk).collection('players').doc(id);
    await db.runTransaction(async tx=>{
      const [a,b]=await Promise.all([tx.get(r1),tx.get(r2)]);
      const mk=(s,min)=>{const o=(s.exists?s.data().ok:0)+d.ok,n=(s.exists?s.data().n:0)+d.n;
        const x={name:S.name,ok:o,n,pct:n>=min?o/n:F().delete(),t:F().serverTimestamp()};if(S.av)x.av=S.av;return x};
      tx.set(r1,mk(a,30),{merge:true});tx.set(r2,mk(b,15),{merge:true});
    });
    if(!S.weeks.includes(wk)){S.weeks.push(wk);save()}
    msg('');
  }catch(e){S.pend={ok:S.pend.ok+d.ok,n:S.pend.n+d.n};save();msg(friendly(e),true)}
  busy=false;
  if(S.pend.n>0&&!timer)timer=setTimeout(flush,15000);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});

/* ---- tabla (la puede ver cualquiera) ---- */
async function loadView(){
  const box=$('#rktable');if(!box)return;
  box.textContent='Cargando…';
  try{
    await flush();
    const id=S.on&&auth.currentUser?auth.currentUser.uid:null,wk=weekKey();
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
      tr.append(el('td',null,i<3?['🥇','🥈','🥉'][i]:String(i+1)));
      const nm=el('td','nm');nm.append(avEl(x.av,x.name,28),el('span',null,x.name||'—'));tr.append(nm);
      [String(x.ok),String(x.n),x.n?Math.round(100*x.ok/x.n)+'%':'–'].forEach(v=>tr.append(el('td',null,v)));
      tb.append(tr);
    });
    t.append(tb);wrap.append(t);box.append(wrap);
    if(id&&!found){
      const mine=await col.doc(id).get();
      if(mine.exists){const x=mine.data();
        box.append(el('p','msg',view==='pct'&&x.pct==null?'Todavía no apareces: te faltan '+Math.max(0,30-x.n)+' preguntas.':'Tú: '+x.ok+' aciertos de '+x.n+' (fuera del top 25).'))}
    }
  }catch(e){box.textContent='';msg(friendly(e),true)}
}
document.querySelectorAll('.rtab').forEach(b=>b.onclick=()=>{
  view=b.dataset.v;document.querySelectorAll('.rtab').forEach(x=>x.setAttribute('aria-selected',x===b));loadView();
});
$('#rkref').onclick=loadView;

/* ---- crear perfil / entrar ---- */
document.querySelectorAll('.atab').forEach(b=>b.onclick=()=>{
  amode=b.dataset.a;document.querySelectorAll('.atab').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('#rkp2').hidden=amode!=='new';$('#rkgo').textContent=amode==='new'?'Crear perfil':'Entrar';
  $('#rkpass').autocomplete=amode==='new'?'new-password':'current-password';msg('');
});
$('#rkshow').onchange=e=>{['#rkpass','#rkpass2','#rkupw','#rkupw2'].forEach(s=>{$(s).type=e.target.checked?'text':'password'})};
$('#rkgo').onclick=async()=>{
  const nm=$('#rkname').value.replace(/\s+/g,' ').trim(),pw=$('#rkpass').value;
  if(!NAME_RE.test(nm)){msg('Nombre no válido: 2 a 20 caracteres, con letras, números, espacios, punto o guion.',true);return}
  if(amode==='new'&&pw.length<6){msg('La contraseña debe tener al menos 6 caracteres.',true);return}
  if(!pw){msg('Escribe tu contraseña.',true);return}
  if(amode==='new'&&pw!==$('#rkpass2').value){msg('Las contraseñas no coinciden.',true);return}
  $('#rkgo').disabled=true;
  try{
    const email=await emailOf(nm);
    if(amode==='new'){
      await auth.createUserWithEmailAndPassword(email,pw);
      await db.collection('players').doc(auth.currentUser.uid).set({name:nm,ok:0,n:0,t:F().serverTimestamp()});
      S={...S,name:nm,on:true,upg:false,av:'',pend:{ok:0,n:0},weeks:[]};save();show();loadView();
    }else await auth.signInWithEmailAndPassword(email,pw);
    $('#rkpass').value='';$('#rkpass2').value='';msg('');
  }catch(e){msg(friendly(e),true)}
  finally{$('#rkgo').disabled=false}
};
$('#rkupgo').onclick=async()=>{
  const pw=$('#rkupw').value;
  if(pw.length<6){msg('La contraseña debe tener al menos 6 caracteres.',true);return}
  if(pw!==$('#rkupw2').value){msg('Las contraseñas no coinciden.',true);return}
  try{
    const email=await emailOf(S.name);
    await auth.currentUser.linkWithCredential(firebase.auth.EmailAuthProvider.credential(email,pw));
    S.upg=false;save();$('#rkupw').value='';$('#rkupw2').value='';msg('Perfil protegido. Ya puedes entrar desde cualquier dispositivo.');show();loadView();
  }catch(e){msg(friendly(e),true)}
};

/* ---- foto y avatar ---- */
EMOJIS.forEach(e=>{const b=el('button',null,e);b.setAttribute('aria-label','Avatar '+e);b.onclick=()=>setAvatar('e:'+e);$('#rkemo').append(b)});
$('#rkphoto').onclick=()=>{$('#rkav').hidden=!$('#rkav').hidden};
$('#rkfile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{await setAvatar(await photoToAv(f))}catch(err){msg(err.message,true)}};
$('#rkrm').onclick=()=>setAvatar('');
async function setAvatar(av){
  const u=auth.currentUser;if(!S.on||!u)return;
  try{
    const refs=[db.collection('players').doc(u.uid),...S.weeks.map(w=>db.collection('weeks').doc(w).collection('players').doc(u.uid))];
    for(const r of refs){const s=await r.get();if(s.exists)await r.update({av:av||F().delete()})}
    S.av=av;save();show();loadView();msg('');
  }catch(e){msg(friendly(e),true)}
}

/* ---- sesión ---- */
$('#rkout').onclick=async()=>{await flush();try{await auth.signOut();msg('Sesión cerrada.')}catch(e){msg(friendly(e),true)}};
$('#rkdel').onclick=()=>{$('#rkdelbox').hidden=!$('#rkdelbox').hidden};
$('#rkdelgo').onclick=async()=>{
  const pw=$('#rkdelpw').value,u=auth.currentUser;if(!u||!pw){msg('Escribe tu contraseña para confirmar.',true);return}
  if(!confirm('Se borrarán tu perfil, tu foto y tus puntos de la clasificación. Esto no se puede deshacer. ¿Continuar?'))return;
  try{
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,pw));
    const id=u.uid,keys=new Set(S.weeks);
    for(let i=0;i<26;i++)keys.add(weekKey(new Date(Date.now()-i*7*864e5)));
    const b=db.batch();b.delete(db.collection('players').doc(id));
    keys.forEach(w=>b.delete(db.collection('weeks').doc(w).collection('players').doc(id)));
    await b.commit();await u.delete();
    $('#rkdelpw').value='';$('#rkdelbox').hidden=true;msg('Tu perfil se ha eliminado.');
  }catch(e){msg(friendly(e),true)}
};

show();
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();loadView()}});io.observe($('#rank'))}
else loadView();
})();
