(function(){
'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const FB=window.SBFire;
const CATS={idea:'Idea nueva',mejora:'Mejora',fallo:'Algo no funciona',otro:'Otra cosa'};
const STATUS={nueva:'Recibida',vista:'Vista',en_curso:'En marcha',hecha:'Hecha ✓',descartada:'No por ahora'};
const msg=(t,e)=>{const m=$('#sugmsg');m.textContent=t||'';m.className='msg'+(e?' err':'')};

function friendly(e){
  const c=(e&&e.code)||'';
  if(c==='permission-denied')return 'Firebase rechazó el envío. Comprueba que has publicado las reglas nuevas de firestore.rules (mira FIREBASE.md) y que has iniciado sesión con tu perfil.';
  if(c==='unavailable'||c==='auth/network-request-failed')return 'Sin conexión. Inténtalo de nuevo cuando tengas internet.';
  return (e&&e.message)||'Error desconocido';
}
const user=()=>{const u=FB&&FB.auth.currentUser;return u&&!u.isAnonymous?u:null};

function refresh(){
  $('#sugoff').hidden=!!FB;
  if(!FB){$('#sugauth').hidden=true;$('#sugform').hidden=true;$('#sugmine').hidden=true;return}
  const u=user();
  $('#sugauth').hidden=!!u;$('#sugform').hidden=!u;$('#sugmine').hidden=!u;
  if(u&&!$('#view-sug').hidden)loadList();
}
async function loadList(){
  const u=user();if(!u)return;
  const box=$('#suglist');box.textContent='Cargando…';
  try{
    const s=await FB.db.collection('suggestions').where('uid','==',u.uid).get();
    const items=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.t)-ms(a.t));
    box.innerHTML='';
    if(!items.length){box.append(el('p','msg','Todavía no has enviado ninguna.'));return}
    items.forEach(x=>{
      const c=el('article','sg'),h=el('div','sh');
      h.append(el('span','pill st-'+(STATUS[x.status]?x.status:'nueva'),STATUS[x.status]||STATUS.nueva),el('span',null,CATS[x.cat]||'Sugerencia'));
      const t=ms(x.t);if(t)h.append(el('time',null,new Date(t).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})));
      c.append(h,el('p',null,x.text||''));
      if(x.reply)c.append(el('div','reply','Respuesta: '+x.reply));
      box.append(c);
    });
  }catch(e){box.textContent='';msg(friendly(e),true)}
}
const ms=t=>t&&typeof t.toMillis==='function'?t.toMillis():0;

if(FB){
  $('#sugtext').oninput=()=>{$('#sugcount').textContent=$('#sugtext').value.length};
  $('#sugtorank').onclick=e=>{e.preventDefault();location.hash='';setTimeout(()=>{const r=$('#rank');if(r)r.scrollIntoView({behavior:'smooth'})},80)};
  $('#sugsend').onclick=async()=>{
    const u=user();if(!u)return;
    const text=$('#sugtext').value.trim();
    if(text.length<5){msg('Escribe al menos unas palabras (mínimo 5 caracteres).',true);return}
    let last=0;try{last=+localStorage.getItem('sb:sugT')||0}catch(e){}
    if(Date.now()-last<60000){msg('Espera un minuto antes de enviar otra sugerencia.',true);return}
    $('#sugsend').disabled=true;
    try{
      await FB.db.collection('suggestions').add({uid:u.uid,name:((FB.name&&FB.name())||'').slice(0,20),cat:$('#sugcat').value,text:text.slice(0,1000),
        status:'nueva',reply:'',t:firebase.firestore.FieldValue.serverTimestamp(),v:String(window.SB_VERSION||'').slice(0,12)});
      try{localStorage.setItem('sb:sugT',String(Date.now()))}catch(e){}
      $('#sugtext').value='';$('#sugcount').textContent='0';msg('¡Gracias! Tu sugerencia se ha enviado.');loadList();
    }catch(e){msg(friendly(e),true)}
    finally{$('#sugsend').disabled=false}
  };
  FB.auth.onAuthStateChanged(refresh);
}
window.SBSug={show:()=>{msg('');refresh()}};
refresh();
})();
