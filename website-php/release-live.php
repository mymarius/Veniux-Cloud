<?php
declare(strict_types=1);
// İndirme sürümlerini canlı güncelleme kanalından okur; kanala ulaşılamazsa yayındaki değer kalır.
return static function(array $catalog): array {
    $cache=sys_get_temp_dir().DIRECTORY_SEPARATOR.'veniux-live-downloads-'.md5(__DIR__).'.json';
    $live=null;
    if(is_file($cache)&&time()-(int)filemtime($cache)<600)$live=json_decode((string)@file_get_contents($cache),true);
    if(!is_array($live)){
        $live=[];
        $context=stream_context_create(['http'=>['timeout'=>2,'ignore_errors'=>false],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
        foreach(['windows','android'] as $platform){
            $data=json_decode((string)@file_get_contents('https://api.veniux.com/updates/files/'.$platform.'.json',false,$context),true);
            if(is_array($data)&&is_string($data['version']??null)&&preg_match('/^\d+\.\d+\.\d+$/',$data['version']))$live[$platform]=$data['version'];
        }
        @file_put_contents($cache,(string)json_encode($live),LOCK_EX);
    }
    foreach($live as $platform=>$version){
        if(isset($catalog['downloads'][$platform])&&version_compare($version,(string)$catalog['downloads'][$platform],'>'))$catalog['downloads'][$platform]=$version;
    }
    return $catalog;
};
