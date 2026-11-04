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
 document.querySelectorAll('[data-search-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('tr').includes(query);});
});
document.querySelector('[data-copy-key]')?.addEventListener('click',async event=>{try{await navigator.clipboard.writeText(event.currentTarget.dataset.copyKey);event.currentTarget.textContent='Kopyalandı';}catch{event.currentTarget.textContent='Anahtarı seçerek kopyalayın';}});
