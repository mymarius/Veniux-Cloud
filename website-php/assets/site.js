'use strict';
import {bootConversions} from './conversion.mjs';
bootConversions(window,document);
// Section navigation scrolls without adding a fragment to the address bar.
function scrollToSection(hash){
  let id;try{id=decodeURIComponent(hash.slice(1));}catch{return false;}
  const target=document.getElementById(id);if(!target)return false;
  target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  return true;
}
document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');if(!link||link.target||link.hasAttribute('download'))return;
  const url=new URL(link.href,location.href);
  if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search&&url.hash&&document.getElementById(decodeURIComponent(url.hash.slice(1)))){
    event.preventDefault();scrollToSection(url.hash);
  }
});
if(location.hash){const fragment=location.hash;history.replaceState(history.state,'',location.pathname+location.search);requestAnimationFrame(()=>scrollToSection(fragment));}
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.price-card,.pricing-compare,.pricing-faq,.overview>div,.principle-grid article').forEach(el=>el.classList.add('reveal'));
document.querySelectorAll('.pricing-grid,.solution-grid,.principle-grid,.overview').forEach(group=>{
 [...group.children].forEach((el,index)=>el.style.setProperty('--reveal-delay',`${index*90}ms`));
});
if (!reduced.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), {threshold: 0.08});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('mobile-menu');
if(toggle&&menu){
const drawer=document.createElement('dialog');
drawer.className='mobile-drawer';drawer.setAttribute('aria-label','Veniux gezinme menüsü');
const drawerTop=document.createElement('div');drawerTop.className='drawer-top';
const drawerTitle=document.createElement('strong');drawerTitle.textContent='Veniux Cloud';
const drawerClose=document.createElement('button');drawerClose.type='button';drawerClose.className='drawer-close';drawerClose.setAttribute('aria-label','Menüyü kapat');drawerClose.textContent='×';
drawerTop.append(drawerTitle,drawerClose);drawer.append(drawerTop);menu.after(drawer);drawer.append(menu);
let closeTimer;
function closeMenu(){
 if(!drawer.open)return;
 toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Menüyü aç');
 drawer.classList.add('closing');
 clearTimeout(closeTimer);closeTimer=setTimeout(()=>{drawer.close();menu.hidden=true;drawer.classList.remove('closing');toggle.focus();},reduced.matches?0:180);
}
function openMenu(){
 clearTimeout(closeTimer);drawer.classList.remove('closing');menu.hidden=false;
 toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Menüyü kapat');
 if(!drawer.open)drawer.showModal();drawerClose.focus();
}
toggle.addEventListener('click',()=>drawer.open?closeMenu():openMenu());
drawerClose.addEventListener('click',closeMenu);
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
drawer.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
drawer.addEventListener('click',event=>{if(event.target===drawer){const r=drawer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMenu();}});
window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
}
const steps = [
 ['↓','İLK ADIM / MAL KABUL','Her şey bir kayıtla başlar.','Ürünü, miktarı ve lot bilgisini kaydedin. Girişin hangi depoya yapıldığını görün.','Mal kabul alanı'],
 ['▦','İKİNCİ ADIM / DEPO & RAF','Her ürünün yeri belli.','Raf ve lokasyon kayıtlarıyla ürünün bulunduğu yeri takip edin. Depolar arası hareketleri görün.','Ana depo · Raf A-02'],
 ['↗','ÜÇÜNCÜ ADIM / SATIŞ & TAKİP','Hareketi kayda dönüştürün.','Satış ve stok hareketlerini birlikte takip edin. Ürünün lot bilgisiyle geçmişini inceleyin.','Satış ve stok kayıtları'],
];
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activate(index,focus=false){
 tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
 const step=steps[index];
 document.querySelector('.demo-symbol').textContent=step[0];
 ['demo-kicker','demo-title','demo-body','demo-location'].forEach((id,i)=>document.getElementById(id).textContent=step[i+1]);
 document.getElementById('flow-panel').setAttribute('aria-labelledby','tab-'+index);
 document.querySelectorAll('.demo-timeline span').forEach((el,i)=>el.classList.toggle('active',i===index));
 if(focus)tabs[index].focus();
}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activate(index));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();activate(next,true);}});});
let scheduled=false;
const progressBar=document.querySelector('.scroll-progress');
let progressTotal=0;
function measureProgress(){progressTotal=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);}
function updateProgress(){if(!progressBar){scheduled=false;return;}progressBar.style.transform=`scaleX(${progressTotal>0?Math.min(1,window.scrollY/progressTotal):0})`;scheduled=false;}
window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateProgress);}},{passive:true});
// Measure after the initial frame, rather than flushing layout after startup writes.
function refreshProgress(){requestAnimationFrame(()=>requestAnimationFrame(()=>{measureProgress();updateProgress();}));}
window.addEventListener('load',refreshProgress,{once:true});
window.addEventListener('resize',refreshProgress,{passive:true});
if('ResizeObserver' in window)new ResizeObserver(refreshProgress).observe(document.body);
const sectors = [
 {label:'MAĞAZA / GÜNLÜK AKIŞ',title:'Gününüz satışla başlar. Stokla devam eder.',description:'Kasa işlemleri, ürün hareketleri ve vardiya kayıtlarını bir arada izleyin. Satılan ürünün stok geçmişine aynı çalışma alanından ulaşın.',points:['Kasa ve perakende satış','Ürün ve barkod kayıtları','Vardiya ve hareket takibi'],link:'/stok-yonetimi',linkText:'Stok çözümünü incele'},
 {label:'DEPO / OPERASYON AKIŞI',title:'Bir kabul kaydı. Bir sonraki hareketin başlangıcı.',description:'Gelen ürünü kaydedin, lokasyonunu takip edin ve transfer geçmişini inceleyin. Sayım ve sevkiyat adımlarına aynı depo çalışma alanından ulaşın.',points:['Mal kabul ve lot kayıtları','Raf, lokasyon ve transfer','Sayım ve sevkiyat takibi'],link:'/depo-yonetimi',linkText:'Depo çözümünü incele'},
 {label:'STOK / ÜRÜN & MİAT',title:'Her lotun bir tarihi. Her kaydın bir yeri var.',description:'Ürün kataloğunu lot ve miat bilgileriyle birlikte değerlendirin. Yaklaşan son kullanma tarihlerini ve stok hareketlerini görün.',points:['Ürün kataloğu ve lot bilgileri','Son kullanma tarihi görünümü','Kontrollü ürün/stok aktarımı'],link:'/lot-miat-takibi',linkText:'Lot ve miat çözümünü incele'},
];
document.querySelectorAll('[data-sector]').forEach(button=>button.addEventListener('click',()=>{
 const index=Number(button.dataset.sector), sector=sectors[index];
 document.querySelectorAll('[data-sector]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
 document.getElementById('sector-label').textContent=sector.label;
 document.getElementById('sector-title').textContent=sector.title;
 document.getElementById('sector-description').textContent=sector.description;
 const list=document.getElementById('sector-points');list.replaceChildren(...sector.points.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 const link=document.getElementById('sector-link');link.href=sector.link;link.textContent=sector.linkText+' ↗';
 document.querySelector('.fit-number').textContent=String(index+1).padStart(2,'0');
}));
const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
const art=document.querySelector('.hero-art');
if(!reduced.matches && finePointer.matches && art){
 art.addEventListener('pointermove',event=>{const r=art.getBoundingClientRect();art.style.setProperty('--pointer-x',((event.clientX-r.left)/r.width-.5)*12+'px');art.style.setProperty('--pointer-y',((event.clientY-r.top)/r.height-.5)*12+'px');});
 art.addEventListener('pointerleave',()=>{art.style.setProperty('--pointer-x','0px');art.style.setProperty('--pointer-y','0px');});
}
const themeButton=document.querySelector('.theme-toggle');
function updateThemeButton(){const dark=document.documentElement.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Açık temaya geç':'Koyu temaya geç');themeButton.querySelector('span').textContent=dark?'☀':'◐';document.querySelector('meta[name="theme-color"]').setAttribute('content',dark?'#142322':'#f8f8f3');}
if(themeButton){themeButton.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('veniux-site-theme',theme);}catch{}updateThemeButton();});
updateThemeButton();}
reduced.addEventListener('change',event=>{
 if(event.matches){document.documentElement.classList.remove('js-motion');document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));}
});
const contactForm=document.querySelector('.contact-form');
if(contactForm){
 let sending=false, refreshed=false;
 contactForm.addEventListener('submit',async event=>{
  if(refreshed){refreshed=false;return;}
  event.preventDefault();if(sending)return;sending=true;
  const button=contactForm.querySelector('button[type="submit"]');button.disabled=true;
  let feedback=contactForm.querySelector('.client-feedback');
  if(!feedback){feedback=document.createElement('p');feedback.className='form-feedback error client-feedback';feedback.setAttribute('role','alert');contactForm.prepend(feedback);}feedback.hidden=true;
  try{
   const response=await fetch('/contact-token',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('token');const data=await response.json();
   if(!/^[a-f0-9]{64}$/.test(data.token))throw new Error('token');
   contactForm.elements.token.value=data.token;refreshed=true;button.disabled=false;contactForm.requestSubmit(button);
  }catch{feedback.textContent='Bağlantı doğrulanamadı. Bilgileriniz korunuyor; tekrar deneyebilirsiniz.';feedback.hidden=false;feedback.tabIndex=-1;feedback.focus();button.disabled=false;}
  finally{sending=false;}
 });
}

const motionControl=document.querySelector('.motion-control');
function setMotionState(paused){
 document.documentElement.classList.toggle('motion-paused',paused);
 if(motionControl){motionControl.setAttribute('aria-pressed',String(paused));motionControl.textContent=paused?'Animasyonları başlat':'Animasyonları durdur';}
 document.querySelectorAll('.signal-map svg').forEach(svg=>{if(paused||reduced.matches)svg.pauseAnimations?.();else svg.unpauseAnimations?.();});
}
if(motionControl)motionControl.addEventListener('click',()=>setMotionState(!document.documentElement.classList.contains('motion-paused')));
if(art&&'IntersectionObserver' in window)new IntersectionObserver(entries=>{for(const entry of entries)art.classList.toggle('motion-idle',!entry.isIntersecting);},{threshold:0}).observe(art);
document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('motion-paused',document.hidden||motionControl?.getAttribute('aria-pressed')==='true');});
reduced.addEventListener('change',()=>setMotionState(reduced.matches));
if(reduced.matches)setMotionState(true);
