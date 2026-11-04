const express = require('express');
const router = express.Router();
const {authMiddleware,requireRole}=require('../middlewares/authMiddleware');
const rateLimit=require('express-rate-limit');
const visitor=require('../services/visitorAssistant');
if(process.env.VENIUX_CLOUD_SERVICE==='1')router.use(authMiddleware,requireRole('admin','manager'));
router.get('/visitor', (req,res)=>res.json(visitor.welcome()));
router.post('/speech',rateLimit({windowMs:60000,max:10,message:{error:'Ses istek sınırına ulaşıldı. Biraz sonra deneyin.'}}),async(req,res,next)=>{
 try{const profile=req.body.profile;const audio=await (profile==='google-soft'||profile==='google-warm'?require('../services/googleSpeechService').synthesize(req.body.text,profile.slice(7)):require('../services/fishSpeechService').synthesize(req.body.text,profile));res.set('Cache-Control','no-store').type('audio/wav').send(audio);}catch(error){next(error);}
});
router.post('/visitor/chat',rateLimit({windowMs:60000,max:10,message:{error:'Bir dakika sonra tekrar deneyin.'}}),async(req,res,next)=>{
 try{res.json(await visitor.chat(req.body));}catch(error){next(error);}
});
router.use(authMiddleware,requireRole('admin','manager'));
router.get('/status',(req,res)=>res.json({configured:Boolean(process.env.NVIDIA_API_KEY),service:'assistant',code:process.env.NVIDIA_API_KEY?'CONFIGURED':'AI_NOT_CONFIGURED'}));
const monitor=require('../services/assistantMonitor');
router.get('/capabilities',(req,res)=>res.json({operations:require('../services/assistantSystemOperations').list(req.user)}));
router.post('/actions/files',rateLimit({windowMs:60000,max:5}),require('express').raw({type:'application/octet-stream',limit:'500mb'}),async(req,res,next)=>{try{res.status(201).json(await require('../services/assistantSystemOperations').upload(req.user,req.body,decodeURIComponent(req.get('x-file-name')||''),req.get('x-upload-type')));}catch(e){next(e);}});
// The authenticated registry supplies an exact server-generated path. A configured
// data directory may contain a hidden parent (e.g. .local); no user path is accepted.
router.get('/actions/result-files/:id',(req,res,next)=>{try{const file=require('../services/assistantSystemOperations').download(req.user,req.params.id);res.download(file.path,file.filename,{dotfiles:'allow'});}catch(e){next(e);}});
router.get('/overview',async(req,res,next)=>{try{res.json(await monitor.overview(req.user));}catch(e){next(e);}});
router.post('/actions/prepare',rateLimit({windowMs:60000,max:20}),async(req,res,next)=>{try{res.json(await monitor.prepare(req.user,req.body,{headers:req.headers}));}catch(e){next(e);}});
router.post('/actions/execute',rateLimit({windowMs:60000,max:10}),async(req,res,next)=>{try{res.json(await monitor.execute(req.user,req.body,{headers:req.headers}));}catch(e){next(e);}});
router.use(rateLimit({windowMs:60000,max:20,message:{error:'AI istek sınırı aşıldı. Bir dakika sonra deneyin.'}}));
const { chatWithAI, getInventoryForecast } = require('../controllers/aiController');
const { runAIAnalysis } = require('../services/aiAnalysisService');

router.post('/chat', chatWithAI);
router.get('/forecast', getInventoryForecast);

// Manual trigger for background AI Health check
router.post('/trigger-analysis', async (req, res) => {
  try {
    const result = await runAIAnalysis(req.user.tenantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
