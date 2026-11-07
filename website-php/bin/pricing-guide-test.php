<?php
declare(strict_types=1);
require __DIR__.'/../pricing.php';
$cases=[[1,5,3,'baslangic'],[1,5,4,'isletme'],[2,1,1,'isletme'],[1,6,1,'isletme'],[3,15,10,'isletme'],[4,1,1,'kurumsal'],[50,250,100,'kurumsal'],[51,1,1,null],[1,251,1,null],[1,1,101,null]];
$fail=0;
foreach($cases as [$w,$u,$d,$want]){$got=sitePlanFor($w,$u,$d);if($got!==$want){$fail++;echo "FAIL $w/$u/$d\n";}}
foreach([['2',2],['0',null],['-1',null],['1.5',null],['abc',null],['<x>',null],[['a'],null],[null,null]] as [$in,$want])if(siteCount($in)!==$want){$fail++;echo "FAIL count\n";}
echo $fail?"FAILED\n":"PASS pricing guide\n";exit($fail?1:0);
