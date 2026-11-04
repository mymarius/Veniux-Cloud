import pathlib,tempfile,subprocess,os,json,urllib.request,urllib.error,hashlib,base64,time,socket
root=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='update-check-',dir=root/'.local') as work:
    work=pathlib.Path(work)
    router=work/'router.php'
    source=(root/'api.veniux.com/src/updates.php').as_posix()
    router.write_text('''<?php
function dataDir(){return __DIR__;}
function rate($a,$b){}
function verifyOwnerIdentity($input){return ['valid'=>($input['password']??'')==='test-only-password','id'=>1];}
function audit($a,$b,$c){}
function sql($s,$a){return new class{function fetch(){return ['id'=>1];}};}
function jsonOut($a,$status=200){http_response_code($status);header('Content-Type: application/json');echo json_encode($a);exit;}
require '''+repr(source)+''';
try{updateDispatch(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));}catch(Throwable $e){jsonOut(['error'=>$e->getMessage()],400);}
''',encoding='utf-8')
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    server=subprocess.Popen(['C:/xampp/php/php.exe','-S',f'127.0.0.1:{port}',str(router)],cwd=work,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    def request(path,method='GET',data=None,token=None):
        headers={'Content-Type':'application/octet-stream'}
        if token:headers['X-Veniux-Publish-Token']=token
        req=urllib.request.Request(f'http://127.0.0.1:{port}/updates/'+path,data=data,method=method,headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    try:
        for _ in range(50):
            try:request('files/android.json');break
            except OSError:time.sleep(.1)
        assert request('upload/Veniux-test.exe','PUT',b'x')[0]==401
        assert request('session','POST',json.dumps({'password':'wrong'}).encode())[0]==401
        status,data=request('session','POST',json.dumps({'password':'test-only-password'}).encode());assert status==200
        token=json.loads(data)['token'];binary=b'installer-test'
        assert request('upload/Veniux-test.exe','PUT',binary,token)[0]==200
        assert request('upload/Veniux-test.exe','PUT',b'overwrite',token)[0]==400
        manifest={'version':'9.0.0','filename':'Veniux-test.exe','bytes':len(binary),'sha512':base64.b64encode(hashlib.sha512(binary).digest()).decode()}
        bad={**manifest,'sha512':'invalid'}
        assert request('upload/windows.json','PUT',json.dumps(bad).encode(),token)[0]==400
        assert request('files/latest.yml')[0]==404
        assert request('upload/windows.json','PUT',json.dumps(manifest).encode(),token)[0]==200
        assert b'version: 9.0.0' in request('files/latest.yml')[1]
        assert request('upload/windows.json','PUT',json.dumps(manifest).encode(),token)[0]==400
        assert request('files/session-'+hashlib.sha256(token.encode()).hexdigest())[0]==404
        assert request('upload/Veniux-test.apk','PUT',binary,token)[0]==200
        mobile={'version':'9.0.0','versionCode':900,'filename':'Veniux-test.apk','bytes':len(binary),'sha256':hashlib.sha256(binary).hexdigest()}
        assert request('upload/android.json','PUT',json.dumps(mobile).encode(),token)[0]==200
        assert json.loads(request('files/android.json')[1])==mobile
        upload_id='c'*32
        assert request(f'chunk/{upload_id}/Veniux-chunk.exe/0','PUT',b'first',token)[0]==200
        assert request(f'chunk/{upload_id}/Veniux-chunk.exe/0','PUT',b'wrong-order',token)[0]==400
        assert request(f'chunk/{upload_id}/Veniux-chunk.exe/5','PUT',b'second',token)[0]==200
        assert request('files/Veniux-chunk.exe')[0]==404
        assert request(f'finish/{upload_id}/Veniux-chunk.exe','POST',b'{"bytes":11}',token)[0]==200
        assert request('files/Veniux-chunk.exe')[1]==b'firstsecond'
        print('PASS: authentication, immutable binaries, hash rejection, publication, downgrade rejection, private-token protection, Android feed')
    finally:server.terminate();server.wait(timeout=5)
