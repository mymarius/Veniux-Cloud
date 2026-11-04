<?php
declare(strict_types=1);
require __DIR__.'/../contact.php';require __DIR__.'/../conversion.php';
function ok(bool $value,string $name):void{if(!$value)throw new RuntimeException($name);echo "PASS $name\n";}
foreach(['demo','quote','contact','partnership'] as $type){siteConversionSuccess($type);$v=siteTakeConversion();ok($v['form_type']===$type&&preg_match('/^[a-f0-9]{32}$/D',$v['receipt'])===1,'Independent receipt for '.$type);ok(siteTakeConversion()===null,'Server flash consumed once');}
$_SESSION=['contact_token'=>'test-token'];$_POST=['token'=>'test-token','name'=>'Synthetic','email'=>'only@example.invalid','interest'=>'stok','consent'=>'1','form_type'=>'demo'];
$result=contactSubmit(['request_dir'=>dirname(__DIR__)]);
ok(!$result[0]&&http_response_code()===503,'Unsafe storage rejected');ok(siteTakeConversion()===null,'Storage failure produces no conversion');
$_POST['form_type']=['malformed'];$result=contactSubmit([]);ok(!$result[0]&&http_response_code()===422,'Invalid form type rejected');ok(siteTakeConversion()===null,'Malformed request produces no conversion');
