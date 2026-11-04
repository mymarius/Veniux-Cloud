<?php
declare(strict_types=1);
require __DIR__.'/../seo.php';require __DIR__.'/../requestFirewall.php';
$checks=0;function checkIndex(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;echo "PASS $message\n";}
$config=['url'=>'https://veniux.com','indexable'=>true];
$paths=['/'=>[],'/stok-yonetimi'=>[],'/giris'=>[],'/kayit'=>[],'/dosya/windows'=>[],'/admin/rapor'=>[],'/contact-token'=>[],'/indir'=>[],'/preview'=>['indexable'=>false],'/skip-map'=>['sitemap'=>false],'/bad?x=1'=>[],'//evil.test'=>[]];
$xml=siteSitemap($config,$paths);$dom=new DOMDocument();checkIndex($dom->loadXML($xml,LIBXML_NONET),'Sitemap valid XML');checkIndex($dom->documentElement->namespaceURI==='http://www.sitemaps.org/schemas/sitemap/0.9','Sitemap namespace');checkIndex($dom->getElementsByTagName('loc')->length===2,'Private, noindex and noncanonical routes excluded');
checkIndex(str_contains(siteRobots($config),"Allow: /\n"),'Public robots allow');checkIndex(str_contains(siteRobots($config),'Disallow: /dosya/'),'Private download crawl rule preserved');
checkIndex(siteRobots(array_replace($config,['indexable'=>false]))==="User-agent: *\nDisallow: /\n",'Preview crawling disabled');
$page=['title'=>'Stok & depo','description'=>'Ürün takibi','label'=>'Stok'];
checkIndex(str_contains(siteSeoHead($config,$page,'/stok-yonetimi',true),'rel="canonical" href="https://veniux.com/stok-yonetimi"'),'Canonical does not trust Host header');
checkIndex(str_contains(siteSeoHead($config,$page,'/',false),'content="noindex, nofollow"'),'Preview meta noindex');
checkIndex(veniuxFirewallPath('/robots.txt')&&veniuxFirewallPath('/sitemap.xml')&&veniuxFirewallPath('/barkodlu-stok-takibi'),'Public crawler paths accepted');
checkIndex(!veniuxFirewallPath('/.env')&&!veniuxFirewallPath('/%2e%2e/private'),'Security path blocks preserved');
$temp=sys_get_temp_dir().'/veniux-index-policy-'.bin2hex(random_bytes(8));
try{checkIndex(veniuxFirewallQuota($temp,'192.0.2.1',2,2,100),'Rate first request');checkIndex(veniuxFirewallQuota($temp,'192.0.2.1',2,2,100),'Rate second request');checkIndex(!veniuxFirewallQuota($temp,'192.0.2.1',2,2,100),'Rate limit enforced without live flooding');checkIndex(veniuxFirewallQuota($temp,'192.0.2.1',2,2,180),'Rate recovers after window');}finally{foreach(glob($temp.'/*')?:[] as $f)unlink($f);if(is_dir($temp))rmdir($temp);}
foreach(array_slice($argv,1) as $file){$m=new DOMDocument();checkIndex($m->loadXML(file_get_contents($file),LIBXML_NONET),'Downloaded sitemap XML: '.basename($file));checkIndex($m->getElementsByTagName('loc')->length>0,'Downloaded sitemap has URLs');}
echo "PASS $checks indexing policy checks\n";

