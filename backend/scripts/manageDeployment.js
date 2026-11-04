const fs=require('fs'),path=require('path'),service=require('../src/services/deploymentService');
const args=process.argv.slice(2),command=args.shift();function option(key){const i=args.indexOf('--'+key);return i>=0?args[i+1]:null;}
(async()=>{if(Number(process.versions.node.split('.')[0])!==24)throw Error('Doğrulanan çalışma ortamı Node.js 24.x gerektirir.');const data=option('data-dir');if(!data||!path.isAbsolute(data))throw Error('--data-dir mutlak veri klasörü gerekli.');const options=option('migrations-dir')?{migrationsPath:path.resolve(option('migrations-dir'))}:{};let result;
 if(command==='init'){let input='';for await(const chunk of process.stdin)input+=chunk;result=await service.initialize(data,JSON.parse(input.replace(/^\uFEFF/,'')),options);}
 else if(command==='adopt'){if(!option('legacy-backend'))throw Error('--legacy-backend gerekli.');result=await service.adopt(data,option('legacy-backend'));}
 else if(command==='update')result=await service.update(data,options);
 else if(command==='check')result=service.check(data,options);
 else if(command==='restore')result=await service.restore(data,option('snapshot'),option('confirm'),options);
 else if(command==='repair')result=service.repair(data,option('confirm'));
 else if(command==='stop'){const file=path.join(data,'server.json');if(!fs.existsSync(file)){console.log('Sunucu zaten kapalı.');return;}const running=JSON.parse(fs.readFileSync(file,'utf8'));if(!service.alive(running.pid)){fs.unlinkSync(file);console.log('Sunucu kapalı.');return;}const response=await fetch(`http://127.0.0.1:${running.port}/api/local-runtime/shutdown`,{method:'POST',headers:{'x-runtime-token':running.token},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Sunucu durdurulamadı; güncelleme başlamadı.');for(let i=0;i<100&&service.alive(running.pid);i++)await new Promise(r=>setTimeout(r,100));if(service.alive(running.pid))throw Error('API kapanışı bekleniyor; güncelleme başlamadı.');result={status:'stopped'};}
 else throw Error('Komut: init, update, check, restore, repair, stop.');console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error('İşlem tamamlanmadı: '+error.message);process.exitCode=1;});
