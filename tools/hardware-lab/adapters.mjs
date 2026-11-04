import {EventEmitter} from 'node:events';
export function assertLab(){if(process.env.NODE_ENV!=='test'||process.env.VENIUX_HARDWARE_LAB!=='1')throw Error('Hardware lab is test-only');}
export class VirtualHid {
 constructor(onKey){assertLab();this.onKey=onKey;this.connected=true;}
 scan(text,terminator='Enter'){if(!this.connected)throw Error('Simulated reader disconnected');for(const key of [...text,terminator])this.onKey({key,ctrlKey:false,altKey:false,metaKey:false,isComposing:false});}
 disconnect(){this.connected=false;}
}
export class VirtualSerialPort extends EventEmitter {
 static async list(){assertLab();return [{path:'LAB-COM1',manufacturer:'Software simulation'}];}
 constructor(options){super();assertLab();this.options=options;VirtualSerialPort.instance=this;}
 open(cb){this.opened=true;cb();}
 close(cb){this.opened=false;cb();this.emit('close');}
 receive(bytes){if(!this.opened)throw Error('Port disconnected');this.emit('data',Buffer.from(bytes));}
 fail(){this.emit('error',Error('Simulated cable failure'));}
}
