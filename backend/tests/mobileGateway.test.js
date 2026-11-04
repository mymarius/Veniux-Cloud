const gateway=require('../src/services/mobileGateway');
test('mobile transport accepts only private IPv4 peers',()=>{
 for(const ip of ['192.168.1.4','10.0.0.2','172.16.2.1','172.31.2.1','::ffff:192.168.1.4'])expect(gateway.privateIP(ip)).toBe(true);
 for(const ip of ['8.8.8.8','172.32.1.1','192.169.1.1','2001:db8::1',''])expect(gateway.privateIP(ip)).toBe(false);
});
test('gateway starts disabled and an unpaired request cannot authorize web activation',()=>{
 expect(gateway.status().enabled).toBe(false);expect(gateway.pairing().codes).toEqual([]);
 expect(gateway.isCompanion({get:()=>'',socket:{remoteAddress:'127.0.0.1'}})).toBe(false);
});
