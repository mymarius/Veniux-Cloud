<?php
declare(strict_types=1);
// Profil fotoğrafı. Dosyalar web kökü dışındaki panel veri klasöründe (avatars/) tutulur ve yalnız oturum açmış sahibine
// /panel/foto ya da /yonetim/foto üzerinden verilir. Tür: c = müşteri, a = yönetici, o = site sahibi hesabı.
// Yükleme: yalnız JPEG/PNG/WebP; GD varsa kare kırpılıp 320 px JPEG olarak yeniden kodlanır (EXIF ve gömülü içerik atılır).

const VP_AVATAR_MAX = 2097152;

function vp_avatar_file(string $kind,string $id): string {
    $kind=in_array($kind,['c','a','o'],true)?$kind:'c';
    $dir=vp_data_dir().'/avatars';
    if(!is_dir($dir)&&!@mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Fotoğraf klasörü oluşturulamadı');
    return $dir.'/'.$kind.'-'.preg_replace('/[^A-Za-z0-9]/','',$id).'.jpg';
}
function vp_avatar_url(string $area,string $kind,string $id): string {
    try{$f=vp_avatar_file($kind,$id);}catch(Throwable){return '';}
    return is_file($f)?($area==='admin'?'/yonetim/foto':'/panel/foto').'?v='.(int)filemtime($f):'';
}
function vp_avatar_delete(string $kind,string $id): void { try{@unlink(vp_avatar_file($kind,$id));}catch(Throwable){} }

/** Yüklenen dosyayı doğrular ve kaydeder. Hata metni ya da null (başarı) döner. */
function vp_avatar_store(string $kind,string $id,array $file): ?string {
    if(($file['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return 'Bir fotoğraf seçin.';
    if(($file['error']??1)!==UPLOAD_ERR_OK)return 'Fotoğraf yüklenemedi. Daha küçük bir dosya deneyin.';
    $tmp=(string)($file['tmp_name']??'');
    if($tmp===''||!is_uploaded_file($tmp)||(int)($file['size']??0)>VP_AVATAR_MAX)return 'Fotoğraf en fazla 2 MB olabilir.';
    $info=@getimagesize($tmp);
    if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true))return 'Yalnız JPEG, PNG veya WebP fotoğraf yükleyebilirsiniz.';
    [$w,$h]=$info;
    if($w<32||$h<32||$w>8000||$h>8000)return 'Fotoğraf boyutu geçersiz (en az 32, en çok 8000 piksel).';
    $dest=vp_avatar_file($kind,$id);
    if(function_exists('imagecreatefromstring')&&function_exists('imagejpeg')){
        $src=@imagecreatefromstring((string)file_get_contents($tmp));
        if(!$src)return 'Fotoğraf okunamadı.';
        $side=min($w,$h);$sx=intdiv($w-$side,2);$sy=intdiv($h-$side,2);$size=320;
        $out=imagecreatetruecolor($size,$size);
        imagefill($out,0,0,imagecolorallocate($out,255,253,248)); // saydam alanlar kâğıt rengine
        imagecopyresampled($out,$src,0,0,$sx,$sy,$size,$size,$side,$side);
        $ok=imagejpeg($out,$dest.'.tmp',86);
        if(!$ok||!@rename($dest.'.tmp',$dest)){@unlink($dest.'.tmp');return 'Fotoğraf kaydedilemedi.';}
        @chmod($dest,0600);
        return null;
    }
    // GD yoksa yalnız küçük bir JPEG ham olarak kabul edilir.
    if($info[2]!==IMAGETYPE_JPEG||(int)$file['size']>307200||$w>1024||$h>1024)return 'Sunucuda görsel işleme kapalı: en çok 1024 piksel ve 300 KB bir JPEG yükleyin.';
    if(!@move_uploaded_file($tmp,$dest))return 'Fotoğraf kaydedilemedi.';
    @chmod($dest,0600);
    return null;
}

/** Oturum sahibinin fotoğrafını gönderir. */
function vp_avatar_serve(string $kind,string $id): void {
    $f=vp_avatar_file($kind,$id);
    if(!is_file($f)){http_response_code(404);echo 'Yok';return;}
    header('Content-Type: image/jpeg');header('X-Content-Type-Options: nosniff');header('Content-Length: '.filesize($f));
    header('Cache-Control: private, max-age=86400');header_remove('X-Robots-Tag');
    readfile($f);
}

/** Profil sayfalarında gösterilen fotoğraf kartı. */
function vp_avatar_card(string $area,string $kind,string $id,string $name): void {
    $url=vp_avatar_url($area,$kind,$id);
    echo '<section class="vp-card vp-avatar-card"><div class="vp-card-head"><h2>Profil fotoğrafı</h2></div><div class="vp-avatar-edit">';
    echo '<span class="vp-avatar vp-avatar--xl">'.($url?'<img src="'.e($url).'" alt="" width="96" height="96">':e(vp_initials($name))).'</span>';
    echo '<form method="post" enctype="multipart/form-data" class="vp-form vp-avatar-form">'.vp_csrf_field().'<input type="hidden" name="op" value="foto">';
    echo '<label class="vp-field"><span>Fotoğraf seçin</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required><small>JPEG, PNG veya WebP, en çok 2 MB. Kare olarak kırpılır.</small></label>';
    echo '<div class="vp-form-foot"><button class="vp-btn" type="submit">Yükle</button></div></form></div>';
    if($url)echo '<form method="post" class="vp-inline">'.vp_csrf_field().'<input type="hidden" name="op" value="foto_sil"><button class="vp-btn vp-btn--sm vp-btn--ghost" type="submit">Fotoğrafı kaldır</button></form>';
    echo '</section>';
}

/** Profil sayfasındaki foto işlemleri. İşlem yapıldıysa true döner (çağıran yönlendirir). */
function vp_avatar_post(string $kind,string $id): bool {
    $op=vp_post('op',10);
    if($op==='foto'){$err=vp_avatar_store($kind,$id,$_FILES['photo']??[]);if($err)vp_flash($err,'err');else vp_flash('Profil fotoğrafınız güncellendi.');return true;}
    if($op==='foto_sil'){vp_avatar_delete($kind,$id);vp_flash('Profil fotoğrafı kaldırıldı.');return true;}
    return false;
}
