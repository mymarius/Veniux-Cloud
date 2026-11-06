<?php
declare(strict_types=1);
// Sürümleri ve notları güncelleme kanalından okur; okunamazsa yayındaki değerler kalır.
return static function(array $catalog): array {
    $dir=getenv('VENIUX_UPDATES_DIR')?:dirname(__DIR__).'/license-private/updates';
    $valid=static fn($v):bool=>is_string($v)&&preg_match('/\A\d+\.\d+\.\d+\z/D',$v)===1;
    $live=[];
    foreach(['windows','android'] as $platform){
        $file=$dir.'/'.$platform.'.json';
        if(!is_file($file))continue;
        $data=json_decode((string)@file_get_contents($file),true);
        if(is_array($data)&&$valid($data['version']??null))$live[$platform]=$data['version'];
    }
    if(count($live)<2&&!getenv('VENIUX_UPDATES_DIR')){
        $cache=sys_get_temp_dir().DIRECTORY_SEPARATOR.'veniux-live-downloads-'.md5(__DIR__).'.json';
        $remote=null;
        if(is_file($cache)&&time()-(int)filemtime($cache)<600)$remote=json_decode((string)@file_get_contents($cache),true);
        if(!is_array($remote)){
            $remote=[];
            $context=stream_context_create(['http'=>['timeout'=>2],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
            foreach(['windows','android'] as $platform){
                $data=json_decode((string)@file_get_contents('https://api.veniux.com/updates/files/'.$platform.'.json',false,$context),true);
                if(is_array($data)&&$valid($data['version']??null))$remote[$platform]=$data['version'];
            }
            @file_put_contents($cache,(string)json_encode($remote),LOCK_EX);
        }
        $live+=$remote;
    }
    foreach($live as $platform=>$version){
        if(isset($catalog['downloads'][$platform])&&version_compare($version,(string)$catalog['downloads'][$platform],'>'))$catalog['downloads'][$platform]=$version;
    }
    $notes=is_file($dir.'/release-notes.json')?json_decode((string)@file_get_contents($dir.'/release-notes.json'),true):null;
    if(is_array($notes)&&($notes['schema']??null)===1&&is_array($notes['releases']??null)){
        $rows=[];
        foreach($notes['releases'] as $row){
            if(!is_array($row)||!$valid($row['version']??null)||!is_string($row['title']??null)||!is_string($row['date']??null)||!is_string($row['notice']??null)||!is_array($row['items']??null)||!is_array($row['platforms']??null))continue;
            $row['items']=array_values(array_filter($row['items'],'is_string'));
            $row['platforms']=array_values(array_intersect($row['platforms'],['windows','android']));
            $rows[]=$row;
        }
        if($rows)$catalog['releases']=$rows;
    }
    return $catalog;
};
