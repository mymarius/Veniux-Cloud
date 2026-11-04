jest.mock('../src/services/medicines/safeDownload',()=>({fetchSafely:jest.fn()}));
jest.mock('../src/config/database',()=>({query:jest.fn()}));
const {fetchSafely}=require('../src/services/medicines/safeDownload');
const db=require('../src/config/database');
const {matchProduct}=require('../src/services/medicines/manufacturerImages');
const {lookup}=require('../src/services/medicines/barcodeImages');
beforeEach(()=>{jest.clearAllMocks();process.env.TEST_MEDICINE_IMAGE_LOOKUP='1';});
afterAll(()=>delete process.env.TEST_MEDICINE_IMAGE_LOOKUP);
test('manufacturer match normalizes Turkish spelling but retains dose and formulation',()=>{
 const products=[{name:'POLİFLEKS % 0.4 LİDODEKS % 5 DEKSTROZ İÇİNDE İ.V. İNFÜZYON İÇİN ÇÖZELTİ'}];
 const medicine={company:'POLİFARMA İLAÇ SAN.',name:'% 0,4 LIDODEKS %5 DEKSTROZ İÇİNDE I.V. İNFÜZYON İÇİN ÇÖZELTİ, 250 ML SETLİ'};
 expect(matchProduct(medicine,products)).toBe(products[0]);
 expect(matchProduct({...medicine,name:medicine.name.replace('0,4','0,8')},products)).toBeNull();
 expect(matchProduct({...medicine,company:'Başka firma'},products)).toBeNull();
 expect(matchProduct(medicine,[...products,...products])).toBeNull();
});
test('only existing barcode images are saved and simultaneous lookups share a request',async()=>{
 const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
 fetchSafely.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({buffer:png});
 db.query.mockResolvedValue({rows:[{image_url:'https://www.ilacdepo.com.tr/assets/urun/8690000000001.png'}]});
 const medicine={id:1,barcode:'8690000000001'};
 const results=await Promise.all([lookup(medicine),lookup(medicine)]);
 expect(results[0]).toContain('8690000000001.png');expect(results[1]).toBe(results[0]);
 expect(fetchSafely).toHaveBeenCalledTimes(2);
 expect(db.query.mock.calls[0][0]).toContain('image_url IS NULL AND image_local_path IS NULL');
});
test('missing and invalid images are never stored; negative results are cached',async()=>{
 fetchSafely.mockResolvedValue({buffer:Buffer.from('<html>not a photo</html>')});
 const medicine={id:2,barcode:'8690000000002'};
 expect(await lookup(medicine)).toBeNull();expect(await lookup(medicine)).toBeNull();
 expect(fetchSafely).toHaveBeenCalledTimes(3);expect(db.query).not.toHaveBeenCalled();
 expect(await lookup({id:3,barcode:'../other'})).toBeNull();
 expect(fetchSafely).toHaveBeenCalledTimes(3);
});
