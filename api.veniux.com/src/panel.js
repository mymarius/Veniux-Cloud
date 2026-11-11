import './tailwind.css';
import './panel.scss';
let opener=null;
document.querySelectorAll('[data-open-dialog]').forEach(button=>button.addEventListener('click',()=>{opener=button;document.getElementById(button.dataset.openDialog).showModal();}));
document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.addEventListener('close',()=>opener?.focus());
 dialog.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
});
document.querySelectorAll('[data-confirm]').forEach(form=>form.addEventListener('submit',event=>{if(!window.confirm(form.dataset.confirm))event.preventDefault();}));
document.querySelector('[data-search]')?.addEventListener('input',event=>{
 const query=event.target.value.toLocaleLowerCase('tr');
 document.querySelectorAll('[data-search-row]').forEach(row=>{row.hidden=row.dataset.filtered==='1'||!row.textContent.toLocaleLowerCase('tr').includes(query);});
});
document.querySelector('[data-copy-key]')?.addEventListener('click',async event=>{try{await navigator.clipboard.writeText(event.currentTarget.dataset.copyKey);event.currentTarget.textContent='Kopyalandı';}catch{event.currentTarget.textContent='Anahtarı seçerek kopyalayın';}});

// Lisans düzenleme penceresi: satırdaki veriyle doldurulur; süre uzatma ve durum süzgeci.
document.querySelectorAll('[data-open-dialog="edit-license"]').forEach(button=>button.addEventListener('click',()=>{
 const dialog=document.getElementById('edit-license');if(!dialog)return;
 const data=JSON.parse(button.dataset.license||'{}');
 const set=(name,value)=>{const field=dialog.querySelector(`[data-field="${name}"]`);if(field)field.value=value??'';};
 ['id','company','plan','seats','expires','email','notes'].forEach(name=>set(name,data[name]));
 dialog.querySelectorAll('[data-addon]').forEach(box=>{box.checked=(data.addons||[]).includes(box.dataset.addon);});
 const hint=dialog.querySelector('[data-field-hint="seats"]');if(hint)hint.textContent=`Şu an ${data.used||0} etkin terminal var.`;
 const seats=dialog.querySelector('[data-field="seats"]');if(seats)seats.min=String(Math.max(1,data.used||1));
}));
document.querySelectorAll('[data-extend]').forEach(button=>button.addEventListener('click',()=>{
 const input=button.closest('dialog').querySelector('[data-field="expires"]');
 const base=new Date((input.value||new Date().toISOString().slice(0,10))+'T00:00:00Z');
 const today=new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z');
 const from=base<today?today:base;
 from.setUTCMonth(from.getUTCMonth()+Number(button.dataset.extend));
 input.value=from.toISOString().slice(0,10);
}));
document.querySelectorAll('[data-filter]').forEach(chip=>chip.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(other=>other.setAttribute('aria-pressed',String(other===chip)));
 const state=chip.dataset.filter;
 document.querySelectorAll('[data-search-row]').forEach(row=>{row.dataset.filtered=state==='all'||row.dataset.state===state?'':'1';});
 document.querySelector('[data-search]')?.dispatchEvent(new Event('input'));
}));
