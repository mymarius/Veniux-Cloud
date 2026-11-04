<?php
declare(strict_types=1);
function siteConversionSuccess(string $type):void {
    if(!in_array($type,['demo','quote','contact','partnership'],true))throw new InvalidArgumentException('Unknown form type');
    // Independent one-use receipt; never a customer, account, or request ID.
    $_SESSION['contact_conversion']=['receipt'=>bin2hex(random_bytes(16)),'form_type'=>$type,'event'=>$type==='partnership'?'partnership_submit':'generate_lead'];
}
function siteTakeConversion():?array {
    $value=$_SESSION['contact_conversion']??null;
    unset($_SESSION['contact_conversion']);
    return is_array($value)?$value:null;
}
