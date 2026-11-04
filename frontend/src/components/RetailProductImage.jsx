import {memo,useEffect,useRef,useState} from 'react';
import {Package,Leaf,Coffee,ShoppingBasket,Tag,Wheat,Fish,Sparkles} from 'lucide-react';
import {categoryIcon} from '../lib/posPresentation.mjs';
import api from '../api/client';
const icons={box:Package,leaf:Leaf,cup:Coffee,basket:ShoppingBasket,tag:Tag,bread:Wheat,fish:Fish,clean:Sparkles};
export default memo(function RetailProductImage({product,icon,revision=0}){
 const host=useRef(null),[visible,setVisible]=useState(false),[src,setSrc]=useState('');
 useEffect(()=>{if(!product.image_available)return;if(!window.IntersectionObserver){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'80px'});
  if(host.current)observer.observe(host.current);return()=>observer.disconnect();
 },[product.id,product.image_available]);
 useEffect(()=>{setSrc('');if(!visible||!product.image_available)return;let live=true,url='';const abort=new AbortController();
  api.get('/scanner/pro/products/'+product.id+'/image',{responseType:'blob',signal:abort.signal}).then(r=>{url=URL.createObjectURL(r.data);if(live)setSrc(url);else URL.revokeObjectURL(url);}).catch(()=>{});
  return()=>{live=false;abort.abort();if(url)URL.revokeObjectURL(url);};
 },[visible,product.id,product.image_available,revision]);
 const Icon=icons[categoryIcon(product.category,icon)];
 return <span ref={host} className="pos-product-media">{src?<img loading="lazy" decoding="async" width="256" height="256" src={src} alt={product.name} onError={()=>setSrc('')}/>:<span className="retail-product-placeholder" aria-hidden="true"><Icon size={44} strokeWidth={1.6}/></span>}</span>;
});
