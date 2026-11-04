<?php
declare(strict_types=1);
function ownerEmail(): string { return 'mymarius1@gmail.com'; }
function verifyOwnerIdentity(array $input): array {
    rate('owner-identity',5);
    $email=is_string($input['email']??null)?strtolower(trim($input['email'])):'';
    $password=is_string($input['password']??null)?$input['password']:'';
    if(strlen($password)>72)throw new InvalidArgumentException('Geçersiz giriş.');
    $admin=sql('SELECT id,email,password_hash FROM admins WHERE email=? AND enabled=1',[$email])->fetch();
    $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
    if(!password_verify($password,$admin['password_hash']??$dummy)||!$admin||$email!==ownerEmail())return ['valid'=>false];
    audit('owner.identity.login',(string)$admin['id'],(int)$admin['id']);
    return ['valid'=>true,'id'=>(int)$admin['id'],'email'=>$email];
}
