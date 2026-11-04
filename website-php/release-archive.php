<?php
declare(strict_types=1);
function releaseArchivePath(): string {
    return getenv('VENIUX_ARCHIVE_CATALOG') ?: dirname(__DIR__).'/license-private/release-archive.json';
}
function releaseArchiveEntries(): array {
    $file=releaseArchivePath();
    if(!is_file($file))return [];
    $data=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);
    if(($data['schema']??null)!==1||!is_array($data['releases']??null))throw new RuntimeException('Archive unavailable');
    $entries=[];$seen=[];
    foreach($data['releases'] as $row){
        if(!is_array($row)||!in_array($row['platform']??null,['windows','android'],true)||!is_string($row['version']??null)||!preg_match('/\A\d+\.\d+\.\d+\z/D',$row['version']))throw new RuntimeException('Invalid archive');
        $expected=($row['platform']==='windows'?'Veniux-Setup-':'Veniux-Android-').$row['version'].($row['platform']==='windows'?'.exe':'.apk');
        if(!is_int($row['bytes']??null)||$row['bytes']<1||!is_string($row['sha256']??null)||!preg_match('/\A[a-f0-9]{64}\z/D',$row['sha256']))throw new RuntimeException('Invalid archive file');
        $variant=substr($expected,0,-4).'-local-'.substr($row['sha256'],0,12).substr($expected,-4);
        if(!in_array($row['filename']??null,[$expected,$variant],true))throw new RuntimeException('Invalid archive filename');
        $key=$row['platform'].'/'.$row['version'];if(isset($seen[$key]))throw new RuntimeException('Duplicate archive');$seen[$key]=true;
        $entries[]=$row;
    }
    usort($entries,static fn($a,$b)=>version_compare($b['version'],$a['version'])?:strcmp($a['platform'],$b['platform']));
    return $entries;
}
function releaseArchiveFind(string $platform,string $version): ?array {
    foreach(releaseArchiveEntries() as $row)if($row['platform']===$platform&&$row['version']===$version)return $row;
    return null;
}
