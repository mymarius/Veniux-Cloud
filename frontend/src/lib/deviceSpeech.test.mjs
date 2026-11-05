import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSpeechText,pickTurkishVoice,speakOnDevice,stopDeviceSpeech,DeviceSpeechUnavailable} from './deviceSpeech.mjs';

function browserEnv(voices,outcome='end'){
  const spoken=[];
  class Utterance{constructor(text){this.text=text;}}
  return {spoken,SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>voices,cancelled:0,cancel(){this.cancelled++;},speak(u){spoken.push(u);u.onstart?.();if(outcome==='end')u.onend?.();else if(outcome==='error')u.onerror?.({error:'synthesis-failed'});}}};
}

test('metin okunacak hale getirilir',()=>{
  assert.equal(cleanSpeechText('**Veniux** [panel](/x)  hazır'),'Veniuks panel hazır');
});

test('yalnız Türkçe ses seçilir',()=>{
  assert.equal(pickTurkishVoice([{lang:'en-US',name:'A'}]),null);
  assert.equal(pickTurkishVoice([{lang:'en-US',name:'A'},{lang:'tr-TR',name:'Tolga'}]).name,'Tolga');
  assert.equal(pickTurkishVoice([{lang:'tr-TR',name:'Tolga'},{lang:'tr_TR',name:'Filiz'}]).name,'Filiz');
});

test('tarayıcı sesi konuşur ve başlangıcı bildirir',async()=>{
  const env=browserEnv([{lang:'tr-TR',name:'Tolga'}]);let started=false;
  await speakOnDevice('Merhaba',{env,onStart:()=>{started=true;}});
  assert.equal(env.spoken[0].text,'Merhaba');assert.equal(started,true);
});

test('Türkçe ses yoksa anlaşılır hata verir',async()=>{
  await assert.rejects(speakOnDevice('Merhaba',{env:browserEnv([{lang:'en-US',name:'A'}]),voiceTimeout:1}),DeviceSpeechUnavailable);
  await assert.rejects(speakOnDevice('Merhaba',{env:{}}),DeviceSpeechUnavailable);
});

test('çalma hatası yukarı iletilir',async()=>{
  await assert.rejects(speakOnDevice('Merhaba',{env:browserEnv([{lang:'tr-TR',name:'T'}],'error')}),DeviceSpeechUnavailable);
});

test('Android köprüsü konuşma bitene kadar bekler',async()=>{
  let polls=0,said='';
  const VeniuxAndroid={speechState:()=>'ready',speak:t=>{said=t;return true;},isSpeaking:()=>++polls<3};
  await speakOnDevice('Stok azaldı',{env:{VeniuxAndroid},pollMs:1});
  assert.equal(said,'Stok azaldı');assert.ok(polls>=3);
});

test('Android sesi hazır değilse hata verir',async()=>{
  const VeniuxAndroid={speechState:()=>'unavailable',speak:()=>true,isSpeaking:()=>false};
  await assert.rejects(speakOnDevice('Merhaba',{env:{VeniuxAndroid},pollMs:1}),DeviceSpeechUnavailable);
});

test('durdurma iki yolu da keser',()=>{
  let android=0,browser=0;
  stopDeviceSpeech({VeniuxAndroid:{stopSpeaking:()=>android++},speechSynthesis:{cancel:()=>browser++}});
  assert.equal(android,1);assert.equal(browser,1);
});
