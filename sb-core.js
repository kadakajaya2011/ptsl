/* sb-core.js — lapisan login, hak akses, sinkronisasi & realtime (Supabase) untuk PTSL Kadakajaya */
(function(){
const C=window.SB_CONFIG||{},SB=window.SB={};
let sb,me=null,prof=null,O={},cols=[],snap={},vers={},pushT=0,busy=0,waiters=[],pushQ=Promise.resolve(),rtT=0,rtKeys=new Map(),conn=false,lastOk=null;
const $=s=>document.querySelector(s);
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const J=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
const MODS={ptsl:'Pengajuan PTSL',pemberkasan:'Pemberkasan',letterc:'Letter C'};
const tm=d=>(d?new Date(d):new Date()).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const css=`#sbgate{position:fixed;inset:0;z-index:99999;background:#0f2a1b;display:flex;align-items:center;justify-content:center;font:14px Segoe UI,Arial,sans-serif}
.sbbox{background:#fff;color:#17201a;border-radius:14px;padding:26px;width:min(380px,92vw);box-shadow:0 10px 40px #0008}.sbbox h2{margin:0 0 4px;font-size:19px}.sbbox p{margin:0 0 12px;color:#66736a}
.sbbox input{width:100%;padding:10px;margin:5px 0;border:1px solid #c9d6cd;border-radius:8px;font-size:14px;box-sizing:border-box}
.sbrow{display:flex;gap:8px;margin:8px 0}.sbb{flex:1;padding:9px 12px;border:1px solid #14532d;background:#fff;color:#14532d;border-radius:8px;cursor:pointer;font-size:14px}.sbb.p{background:#14532d;color:#fff}
.sbmsg{background:#fff7e0;border:1px solid #f0d98a;border-radius:8px;padding:9px;margin:8px 0;font-size:13px}.sbbox a{color:#166534;font-size:13px;cursor:pointer}
#sbbar{position:fixed;right:10px;bottom:10px;z-index:9999;background:#123b25;color:#fff;border-radius:22px;padding:6px 12px;font:12px Segoe UI,Arial,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 3px 14px #0006;max-width:96vw;flex-wrap:wrap}
#sbbar button,#sbbar a{background:#ffffff22;color:#fff;border:0;border-radius:12px;padding:4px 9px;cursor:pointer;text-decoration:none;font-size:12px}#sbbar .bad{color:#ffb4a8}
#sbtoast{position:fixed;left:50%;transform:translateX(-50%);bottom:60px;z-index:100000;background:#222;color:#fff;padding:10px 16px;border-radius:10px;max-width:90vw;font:13px Segoe UI,Arial,sans-serif;display:none}
#sbu{position:fixed;inset:0;z-index:99998;background:#000a;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}
#sbu .pn{background:#fff;color:#17201a;border-radius:12px;padding:16px;width:min(1100px,98vw);font:13px Segoe UI,Arial,sans-serif}#sbu table{border-collapse:collapse;width:100%}#sbu th,#sbu td{border-bottom:1px solid #e3ebe5;padding:5px 6px;text-align:left;vertical-align:middle}#sbu select,#sbu input[type=text]{padding:4px;font-size:12px}
#sbu .tb{display:flex;gap:8px;margin-bottom:10px;align-items:center}#sbu button{padding:6px 10px;border:1px solid #14532d;background:#fff;color:#14532d;border-radius:7px;cursor:pointer}#sbu button.p{background:#14532d;color:#fff}`;
function ui(){if($('#sbcss'))return;const s=document.createElement('style');s.id='sbcss';s.textContent=css;document.head.appendChild(s)}
function gate(h){let g=$('#sbgate');if(h==null){g&&g.remove();return}ui();if(!g){g=document.createElement('div');g.id='sbgate';document.body.appendChild(g)}g.innerHTML=h}
function toast(t,ms){ui();let e=$('#sbtoast');if(!e){e=document.createElement('div');e.id='sbtoast';document.body.appendChild(e)}e.textContent=t;e.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>e.style.display='none',ms||5000)}
SB.toast=toast;
SB.akses=m=>!prof||!prof.aktif?'tidak':prof.role==='admin'?'tulis':((prof.akses||{})[m]||'tidak');
SB.canWrite=m=>SB.akses(m)==='tulis';SB.isAdmin=()=>!!prof&&prof.role==='admin'&&prof.aktif;
SB.user=()=>prof;
SB.pending=()=>waiters.length>0||busy>0;
function status(t,bad){const e=$('#sbst');if(e){e.textContent=t;e.className=bad?'bad':''}if(SB.onStatus)SB.onStatus(t,bad)}
/* ---------- login ---------- */
function out(){sb.auth.signOut().finally(()=>location.reload())}
function msgScreen(m,logout){gate(`<div class="sbbox"><h2>${E(O.title||'')}</h2><div class="sbmsg">${m}</div><div class="sbrow">${logout?'<button class="sbb" id="sbo">Keluar</button>':''}<button class="sbb p" onclick="location.reload()">Muat ulang</button></div></div>`);const b=$('#sbo');if(b)b.onclick=out}
function login(msg){gate(`<div class="sbbox"><h2>${E(O.title||'')}</h2><p>Masuk untuk melanjutkan</p>${msg?`<div class="sbmsg">${msg}</div>`:''}<input id="sbe" type="email" placeholder="Email" autocomplete="username"><input id="sbp" type="password" placeholder="Kata sandi" autocomplete="current-password"><div class="sbrow"><button class="sbb p" id="sbin">Masuk</button><button class="sbb" id="sbup">Daftar</button></div><a id="sbrs">Lupa kata sandi?</a></div>`);
 const em=()=>$('#sbe').value.trim(),pw=()=>$('#sbp').value;
 $('#sbin').onclick=async()=>{const{error}=await sb.auth.signInWithPassword({email:em(),password:pw()});if(error)login('Gagal masuk: '+E(error.message));else boot()};
 $('#sbp').onkeydown=e=>{if(e.key==='Enter')$('#sbin').click()};
 $('#sbup').onclick=async()=>{if(!em()||pw().length<6)return login('Isi email dan kata sandi (minimal 6 karakter) lalu klik Daftar.');const nama=prompt('Nama lengkap:')||'';const{data,error}=await sb.auth.signUp({email:em(),password:pw(),options:{data:{nama}}});if(error)return login('Gagal daftar: '+E(error.message));if(data.session)boot();else login('Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk. Akun baru perlu diaktifkan admin.')};
 $('#sbrs').onclick=async()=>{if(!em())return login('Isi email dahulu.');const{error}=await sb.auth.resetPasswordForEmail(em(),{redirectTo:location.href.split('#')[0]});login(error?'Gagal: '+E(error.message):'Tautan reset kata sandi dikirim ke email.')}}
/* ---------- muat data ---------- */
async function loadCol(c){
 const m=snap[c.key]={},V=vers[c.key]={},all=[];
 for(let a=0;;a+=1000){const{data,error}=await sb.from(c.table).select('id,data,ver').order('id').range(a,a+999);if(error)throw error;data.forEach(x=>{all.push(x.data);m[x.id]=J(x.data);V[x.id]=x.ver});if(data.length<1000)break}
 c.set(all);if(c.single&&!(c.sid in m))m[c.sid]=J(c.get()[0]);c.ok=true}
async function loadAll(){const ls=cols.filter(c=>SB.akses(c.mod)!=='tidak');let i=0;
 await Promise.all(ls.map(async c=>{try{await loadCol(c)}catch(e){c.ok=false;toast('Gagal memuat '+c.table+': '+(e.message||e),9000)}i++;status('Memuat data… '+i+'/'+ls.length)}))}
SB.reload=async()=>{await loadAll();O.onData&&O.onData('*')};
/* ---------- simpan (diff & push) ---------- */
async function conflict(c,id,res){const{data}=await sb.from(c.table).select('id,data,ver,updated_by').eq('id',id).maybeSingle();let arr=c.get().slice();
 if(data){const i=arr.findIndex(r=>r.id===id);if(i>=0)arr[i]=data.data;else arr.push(data.data);snap[c.key][id]=J(data.data);vers[c.key][id]=data.ver}
 else{arr=arr.filter(r=>r.id!==id);delete snap[c.key][id];delete vers[c.key][id]}
 c.set(arr);res.conf=(res.conf||0)+1}
async function doPush(){
 const res={ok:true,err:'',conf:0};
 for(const c of cols){
  if(!c.ok||c.ro)continue;
  const m=snap[c.key],V=vers[c.key],seen=new Set(),cm=new Map();
  for(const r of c.get()){if(!r||r.id==null)continue;seen.add(r.id);const j=J(r);if(m[r.id]!==j)cm.set(r.id,[r,j])}
  const ch=[...cm.values()];
  const del=Object.keys(m).filter(id=>!seen.has(id));
  if(!ch.length&&!del.length)continue;
  if(SB.akses(c.mod)!=='tulis'){res.ok=false;res.err='Hak akses Anda hanya-baca: perubahan pada '+(MODS[c.mod]||c.table)+' tidak disimpan.';await loadCol(c);continue}
  c.infl=new Map(ch.map(([r,j])=>[r.id,j]));
  try{
   const ins=ch.filter(([r])=>V[r.id]==null),upd=ch.filter(([r])=>V[r.id]!=null);
   for(let i=0;i<ins.length;i+=300){const b=ins.slice(i,i+300),{data,error}=await sb.from(c.table).upsert(b.map(([r])=>({id:r.id,data:r})),{onConflict:'id'}).select('id,ver');if(error)throw error;data.forEach(x=>V[x.id]=x.ver);b.forEach(([r,j])=>m[r.id]=j);if(ins.length>300)status('Menyimpan '+c.table+' '+Math.min(i+300,ins.length)+'/'+ins.length)}
   if(upd.length>25){for(let i=0;i<upd.length;i+=300){const b=upd.slice(i,i+300),{data,error}=await sb.from(c.table).upsert(b.map(([r])=>({id:r.id,data:r})),{onConflict:'id'}).select('id,ver');if(error)throw error;data.forEach(x=>V[x.id]=x.ver);b.forEach(([r,j])=>m[r.id]=j);status('Menyimpan '+c.table+' '+Math.min(i+300,upd.length)+'/'+upd.length)}}
   else for(const[r,j]of upd){const{data,error}=await sb.from(c.table).update({data:r}).eq('id',r.id).eq('ver',V[r.id]).select('id,ver');if(error)throw error;if(!data.length){await conflict(c,r.id,res);continue}V[r.id]=data[0].ver;m[r.id]=j}
   for(let i=0;i<del.length;i+=100){const b=del.slice(i,i+100),{error}=await sb.from(c.table).delete().in('id',b);if(error)throw error;b.forEach(id=>{delete m[id];delete V[id]})}
  }catch(e){res.ok=false;res.err=(e.message||String(e))+(e.code==='42501'?' (ditolak hak akses)':'')}
  setTimeout(()=>{c.infl=null},3000);
 }
 if(res.conf){res.ok=false;res.err='Data diubah pengguna lain bersamaan: '+res.conf+' perubahan Anda tidak disimpan dan tampilan dimuat ulang dari server. Periksa lalu ulangi.';O.onData&&O.onData('*')}
 return res}
function report(r){if(r.ok){lastOk=Date.now();status('✔ Tersinkron '+tm(lastOk))}else{status('⚠ '+r.err,1);toast(r.err,9000)}}
SB.push=function(now){if(!cols.length)return Promise.resolve({ok:true});return new Promise(res=>{waiters.push(res);clearTimeout(pushT);status('Menyimpan…');
 const run=()=>{const w=waiters;waiters=[];busy++;pushQ=pushQ.then(doPush).catch(e=>({ok:false,err:e.message||String(e)})).then(r=>{busy--;report(r);w.forEach(f=>f(r))})};
 if(now)run();else pushT=setTimeout(run,250)})};
window.addEventListener('beforeunload',e=>{if(SB.pending()){e.preventDefault();e.returnValue=''}});
/* ---------- realtime ---------- */
function onRT(c,p){const m=snap[c.key],V=vers[c.key];let arr=c.get(),chg=false,rid=null;
 if(p.eventType==='DELETE'){const id=p.old&&p.old.id;if(id==null||!(id in m))return;delete m[id];delete V[id];c.set(arr.filter(r=>r.id!==id));chg=true;rid=id}
 else{const n=p.new;if(!n||!n.data)return;const j=J(n.data);if(m[n.id]===j||(c.infl&&c.infl.get(n.id)===j)){V[n.id]=n.ver;return}
  arr=arr.slice();const i=arr.findIndex(r=>r.id===n.id);if(i>=0)arr[i]=n.data;else arr.push(n.data);c.set(arr);m[n.id]=j;V[n.id]=n.ver;chg=true;rid=n.id}
 if(chg){if(!rtKeys.has(c.key))rtKeys.set(c.key,new Set());rtKeys.get(c.key).add(rid);clearTimeout(rtT);rtT=setTimeout(()=>{const k=[...rtKeys];rtKeys.clear();k.forEach(([x,ids])=>O.onData&&O.onData(x,true,ids))},250)}}
function subscribe(){const ch=sb.channel('sb-'+O.module+'-'+Math.random().toString(36).slice(2,6));
 cols.filter(c=>c.rt&&c.ok).forEach(c=>ch.on('postgres_changes',{event:'*',schema:'public',table:c.table},p=>onRT(c,p)));
 ch.subscribe(s=>{conn=s==='SUBSCRIBED';const d=$('#sbdot');if(d)d.textContent=conn?'🟢':'🔴'})}
/* ---------- bar & kelola pengguna ---------- */
function bar(){ui();let b=$('#sbbar');if(!b){b=document.createElement('div');b.id='sbbar';document.body.appendChild(b)}
 const L=C.links||{},cur=O.module==='letterc'?'letterc':'ptsl',oth=cur==='ptsl'?['letterc','Letter C',L.letterc]:['ptsl','Pengajuan PTSL',L.ptsl];
 const ro=SB.akses(O.module)==='baca';
 b.innerHTML=`<span id="sbdot">🟡</span><span>${E(prof.nama||prof.email)} · ${prof.role}${ro?' · HANYA BACA':''}</span><span id="sbst"></span>${oth[2]&&SB.akses(oth[0]==='letterc'?'letterc':'ptsl')!=='tidak'?`<a href="${E(oth[2])}">↗ ${oth[1]}</a>`:''}${SB.isAdmin()?'<button id="sbadm">👥 Kelola Pengguna</button>':''}<button id="sbout">Keluar</button>`;
 $('#sbout').onclick=out;if(SB.isAdmin())$('#sbadm').onclick=usersUI;status(ro?'Mode hanya-baca':'Siap')}
async function usersUI(tab){tab=tab||'u';let h=$('#sbu');if(!h){h=document.createElement('div');h.id='sbu';document.body.appendChild(h)}
 h.innerHTML='<div class="pn">Memuat…</div>';
 const{data:ps,error}=await sb.from('profiles').select('*').order('created_at');if(error){h.remove();return alert('Gagal: '+error.message)}
 const nm=Object.fromEntries(ps.map(p=>[p.id,p.nama||p.email]));
 let body='';
 if(tab==='u'){const sel=(v,id,m)=>`<select data-id="${id}" data-m="${m}">${['tidak','baca','tulis'].map(o=>`<option ${v===o?'selected':''}>${o}</option>`).join('')}</select>`;
  body=`<table><tr><th>Nama / Email</th><th>Aktif</th><th>Peran</th>${Object.values(MODS).map(x=>`<th>${x}</th>`).join('')}<th></th></tr>${ps.map(p=>{const self=p.id===me.id,adm=p.role==='admin';return`<tr data-r="${p.id}"><td><input type="text" data-id="${p.id}" data-f="nama" value="${E(p.nama||'')}"><br><small>${E(p.email)}</small></td><td><input type="checkbox" data-id="${p.id}" data-f="aktif" ${p.aktif?'checked':''} ${self?'disabled':''}></td><td><select data-id="${p.id}" data-f="role" ${self?'disabled':''}><option ${!adm?'selected':''}>petugas</option><option ${adm?'selected':''}>admin</option></select></td>${Object.keys(MODS).map(m=>`<td>${adm?'<small>penuh (admin)</small>':sel((p.akses||{})[m]||'tidak',p.id,m)}</td>`).join('')}<td><button class="p" data-save="${p.id}">Simpan</button></td></tr>`}).join('')}</table><p><small>Akun baru yang mendaftar tampil di sini dengan status tidak aktif. Aktifkan lalu atur hak akses per modul: <b>tidak</b> = tidak terlihat, <b>baca</b> = hanya lihat, <b>tulis</b> = lihat dan ubah. Admin selalu berhak penuh.</small></p>`}
 else{const{data:lg}=await sb.from('audit_log').select('*').order('at',{ascending:false}).limit(200);
  body=`<table><tr><th>Waktu</th><th>Pengguna</th><th>Tabel</th><th>Aksi</th><th>ID</th><th>Rincian</th></tr>${(lg||[]).map(l=>`<tr><td>${new Date(l.at).toLocaleString('id-ID')}</td><td>${E(nm[l.user_id]||'-')}</td><td>${E(l.tabel)}</td><td>${E(l.aksi)}</td><td>${E(l.row_id)}</td><td><small>${E(JSON.stringify(l.detail||{}).slice(0,160))}</small></td></tr>`).join('')}</table>`}
 h.innerHTML=`<div class="pn"><div class="tb"><b>Kelola Pengguna</b><button class="${tab==='u'?'p':''}" id="tu">Pengguna</button><button class="${tab==='l'?'p':''}" id="tl">Log aktivitas (200 terakhir)</button><span style="flex:1"></span><button id="tx">Tutup</button></div><div style="overflow:auto;max-height:75vh">${body}</div></div>`;
 $('#tx').onclick=()=>h.remove();$('#tu').onclick=()=>usersUI('u');$('#tl').onclick=()=>usersUI('l');
 h.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.save,r=h.querySelector(`tr[data-r="${id}"]`),p=ps.find(x=>x.id===id),g=f=>r.querySelector(`[data-f="${f}"]`);
  const ak=Object.assign({},p.akses);r.querySelectorAll('select[data-m]').forEach(s=>ak[s.dataset.m]=s.value);
  const upd={nama:g('nama').value.trim(),role:g('role').value,aktif:g('aktif').checked,akses:ak};
  if(id===me.id){upd.role='admin';upd.aktif=true}
  const{error}=await sb.from('profiles').update(upd).eq('id',id);toast(error?'Gagal: '+error.message:'Tersimpan.',3000)})}
/* ---------- start ---------- */
async function boot(){
 const{data:{session}}=await sb.auth.getSession();if(!session)return login();
 me=session.user;let r=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();
 if(!r.data){await new Promise(x=>setTimeout(x,1500));r=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle()}
 prof=r.data;if(!prof)return msgScreen('Profil akun belum terbentuk. Pastikan schema.sql sudah dijalankan, lalu muat ulang.',1);
 if(!prof.aktif)return msgScreen('Akun <b>'+E(prof.email)+'</b> sudah terdaftar tetapi belum diaktifkan. Hubungi admin untuk mengaktifkan dan memberi hak akses.',1);
 if(SB.akses(O.module)==='tidak')return msgScreen('Anda belum diberi hak akses ke aplikasi ini. Hubungi admin.',1);
 gate('<div class="sbbox"><h2>'+E(O.title||'')+'</h2><p id="sbl">Memuat data…</p></div>');
 const t=setInterval(()=>{const s=$('#sbst');const l=$('#sbl');if(l&&SB._ms)l.textContent=SB._ms},300);
 SB.onStatus=(x)=>{SB._ms=x};await loadAll();clearInterval(t);SB.onStatus=null;gate(null);bar();subscribe();status('✔ Data dimuat '+tm());O.onReady&&O.onReady()}
SB.start=function(o){O=o;
 cols=o.collections.map(c=>Object.assign({},c)).concat((o.singles||[]).map(s=>({key:s.key,table:s.table,mod:s.mod,rt:s.rt,single:1,sid:s.id,get:()=>[Object.assign({},s.get(),{id:s.id})],set:a=>{if(a[0]){const x=Object.assign({},a[0]);delete x.id;s.set(x)}}})));
 if(!C.url||!C.anonKey||!window.supabase){ui();return gate('<div class="sbbox"><h2>Konfigurasi belum diisi</h2><div class="sbmsg">Isi <b>url</b> dan <b>anonKey</b> Supabase di berkas <code>config.js</code> (lihat PANDUAN.md).</div></div>')}
 sb=SB.client=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&me)location.reload()});
 boot()};
})();
