<?php
if(PHP_SAPI!=='cli'||getenv('LICENSE_TEST_FIXTURE')!=='1')exit(1);
require dirname(__DIR__).'/src/core.php';
$input=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
switch($input['action']){
case 'issue':echo json_encode(issueLicense('Test Firması','BUSINESS_ANNUAL',1,gmdate('Y-m-d',time()+86400*30),1));break;
case 'state':setLicenseState($input['id'],$input['state'],1);break;
case 'alias':sql('UPDATE devices SET alias=? WHERE license_id=?',[$input['alias'],$input['id']]);break;
}
