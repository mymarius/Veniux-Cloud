import {motionOn} from '../lib/motion';

// Başlığı harf harf, bulanıklıktan netleşerek yükselen biçimde gösterir. Ekran okuyucu tam metni okur.
export default function RevealText({text,as:Tag='h1',className}){
 const on=motionOn();
 if(!on)return <Tag className={className}>{text}</Tag>;
 return <Tag className={`vx-reveal-text ${className||''}`} aria-label={text}>{[...text].map((ch,i)=><span key={i} aria-hidden="true" style={{'--i':i}}>{ch===' '?' ':ch}</span>)}</Tag>;
}
