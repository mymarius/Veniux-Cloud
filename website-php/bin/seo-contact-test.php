<?php
declare(strict_types=1);
require __DIR__.'/../seo.php';
require __DIR__.'/../contact.php';
function verify(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
$config=['url'=>'https://veniux.com','indexable'=>true];
$map=siteSitemap($config,[
 '/unknown-date'=>[], '/known-date'=>['modified'=>'2026-01-02'],
 '/invalid-date'=>['modified'=>'2026-02-30'], '/future-date'=>['modified'=>'2999-01-01'],
 '/escaped'=>['modified'=>'<script>'],
]);
verify(substr_count($map,'<lastmod>')===1,'Only verified valid non-future editorial date is emitted');
verify(str_contains($map,'<lastmod>2026-01-02</lastmod>'),'Known editorial date preserved');
verify(substr_count($map,'<url>')===5,'All public URLs retained');
verify(!str_contains(siteRobots(['indexable'=>false]),'Allow: /'),'Preview crawl is blocked when configured');
$_SESSION=['contact_token'=>'synthetic-test-token'];
foreach(['plan','token','website','name','email','company','interest','consent'] as $field){
 $_POST=[$field=>['malformed']];$result=contactSubmit([]);
 verify($result[0]===false&&http_response_code()===422,'Malformed '.$field.' rejected without storage or email');
}
$_POST=['token'=>'wrong'];$result=contactSubmit([]);
verify($result[0]===false&&http_response_code()===403,'CSRF rejection preserved');
