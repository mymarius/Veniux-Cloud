<?php
declare(strict_types=1);
function siteSeoGraph(array $config,array $page,string $path,bool $notFound=false):array {
    $base=rtrim($config['url'],'/');$url=$base.$path;
    if($notFound)return ['@context'=>'https://schema.org','@graph'=>[]];
    $graph=[
        ['@type'=>'Organization','@id'=>$base.'/#organization','name'=>'Veniux Cloud','alternateName'=>'Veniux','url'=>$base,'logo'=>$base.'/assets/logo-hero-420-v2.webp','sameAs'=>['https://discord.gg/WQyxdp7MKW']],
        ['@type'=>'WebSite','@id'=>$base.'/#website','name'=>'Veniux Cloud','alternateName'=>'Veniux','url'=>$base,'inLanguage'=>'tr-TR','publisher'=>['@id'=>$base.'/#organization']],
        ['@type'=>'WebPage','@id'=>$url.'#webpage','url'=>$url,'name'=>$page['title'],'description'=>$page['description'],'inLanguage'=>'tr-TR','isPartOf'=>['@id'=>$base.'/#website'],'about'=>['@id'=>$base.'/#organization']],
    ];
    if($path!=='/')$graph[]=['@type'=>'BreadcrumbList','@id'=>$url.'#breadcrumbs','itemListElement'=>[['@type'=>'ListItem','position'=>1,'name'=>'Ana sayfa','item'=>$base.'/'],['@type'=>'ListItem','position'=>2,'name'=>$page['label'],'item'=>$url]]];
    if($path==='/')$graph[]=['@type'=>'SoftwareApplication','@id'=>$base.'/#software','name'=>'Veniux','applicationCategory'=>'BusinessApplication','applicationSubCategory'=>'Stok, depo ve kasa yönetimi','operatingSystem'=>'Windows, Android','inLanguage'=>'tr-TR','url'=>$base,'publisher'=>['@id'=>$base.'/#organization']];
    if($path==='/')$graph[]=['@type'=>'VideoObject','@id'=>$base.'/#tanitim-video','name'=>'Bir marketin günü, tek ekranda: Veniux','description'=>'Kasa, ödeme, mal kabul, etiket, sayım, sipariş önerisi ve gün sonu; Veniux’un gerçek ekranlarıyla Türkçe seslendirmeli tanıtım. Veriler kurgusal örnek kayıtlardır.','thumbnailUrl'=>[$base.'/assets/veniux-tanitim-poster-v1.webp'],'uploadDate'=>'2026-11-13T17:00:00+03:00','duration'=>'PT49S','contentUrl'=>$base.'/assets/veniux-tanitim-v1.mp4','inLanguage'=>'tr-TR','publisher'=>['@id'=>$base.'/#organization']];
    if($path==='/program-indir')$graph[]=['@type'=>'SoftwareApplication','@id'=>$url.'#application','name'=>'Veniux','alternateName'=>'Veniux Cloud','applicationCategory'=>'BusinessApplication','operatingSystem'=>'Windows 10, Windows 11, Android 8 ve üzeri','url'=>$url,'description'=>$page['description'],'publisher'=>['@id'=>$base.'/#organization']];
    return ['@context'=>'https://schema.org','@graph'=>$graph];
}
function siteSeoHead(array $config,array $page,string $path,bool $indexable):string {
    $escape=static fn(string $s):string=>htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $url=rtrim($config['url'],'/').$path;
    $screenshot=isset($page['image'])&&preg_match('/^product-[a-z]+-v[0-9]+\.jpg$/D',$page['image']);
    $image=rtrim($config['url'],'/').'/assets/'.($screenshot?$page['image']:'logo-hero-420-v2.webp');
    $imageAlt=$screenshot?($page['alt']??'Veniux ürün ekranı, sentetik örnek kayıtlar'):'Veniux Cloud logosu';
    $html='<title>'.$escape($page['title']).'</title><link rel="canonical" href="'.$escape($url).'">';
    $meta=['description'=>$page['description'],'robots'=>$indexable?'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1':'noindex, nofollow','twitter:card'=>$screenshot?'summary_large_image':'summary','twitter:title'=>$page['title'],'twitter:description'=>$page['description'],'twitter:image'=>$image,'twitter:image:alt'=>$imageAlt];
    foreach($meta as $name=>$value)$html.='<meta name="'.$name.'" content="'.$escape($value).'">';
    $og=['type'=>'website','locale'=>'tr_TR','site_name'=>'Veniux Cloud','title'=>$page['title'],'description'=>$page['description'],'url'=>$url,'image'=>$image,'image:secure_url'=>$image,'image:type'=>$screenshot?'image/jpeg':'image/webp','image:width'=>$screenshot?(string)($page['image_width']??1280):'420','image:height'=>$screenshot?(string)($page['image_height']??800):'420','image:alt'=>$imageAlt];
    foreach($og as $name=>$value)$html.='<meta property="og:'.$name.'" content="'.$escape($value).'">';
    if($path==='/')$html.='<meta name="google-site-verification" content="1VEoKi2e_dQVEQ5sQtNMvYgeEXWGkENrJW_KT--Rjl4">';
    return $html;
}
function siteRobots(array $config):string {
    if(!$config['indexable'])return "User-agent: *\nDisallow: /\n";
    return "User-agent: *\nAllow: /\nDisallow: /dosya/\nDisallow: /assets/private/\nSitemap: ".$config['url']."/sitemap.xml\n";
}
function siteSitemap(array $config,array $pages):string {
    $xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    foreach($pages as $path=>$page){
        if(!is_string($path)||!preg_match('~^/(?:[a-z0-9-]+(?:/[a-z0-9-]+)*)?$~D',$path)||preg_match('~^/(?:giris|kayit|indir|dosya|cikis|contact-token|hesap|account|admin|dashboard)(?:/|$)~D',$path)||($page['indexable']??true)===false||($page['sitemap']??true)===false)continue;
        $xml.='<url><loc>'.htmlspecialchars($config['url'].$path,ENT_XML1|ENT_QUOTES,'UTF-8').'</loc>';
        // Deployment mtimes do not prove an editorial change. Omit unknown dates.
        $modified=$page['modified']??null;
        if(is_string($modified)&&preg_match('/^\d{4}-\d{2}-\d{2}$/D',$modified)){
            [$year,$month,$day]=array_map('intval',explode('-',$modified));
            if(checkdate($month,$day,$year)&&$modified<=gmdate('Y-m-d'))$xml.='<lastmod>'.$modified.'</lastmod>';
        }
        $xml.='</url>';
    }
    return $xml.'</urlset>';
}
