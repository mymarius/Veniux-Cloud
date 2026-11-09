const mockJobs=[];
jest.mock('node-cron',()=>({createTask:jest.fn((expression,callback,options)=>{const job={start:jest.fn(),stop:jest.fn()};mockJobs.push(job);return job;})}));
jest.mock('../src/services/alertRuleEngine',()=>({runAlertRuleEngine:jest.fn()}));
jest.mock('../src/services/aiAnalysisService',()=>({runAIAnalysis:jest.fn()}));
const cron=require('node-cron');
const scheduler=require('../src/jobs/cronJobs');
test('mockJobs stay stopped until startup, run in Istanbul time, and start only once',()=>{
 expect(cron.createTask.mock.calls.map(([expression])=>expression)).toEqual(['0 */6 * * *','0 8 * * *','* * * * *','*/10 * * * *']);
 for(const job of mockJobs) expect(job.start).not.toHaveBeenCalled();
 for(const [, ,options] of cron.createTask.mock.calls) expect(options).toMatchObject({timezone:'Europe/Istanbul',noOverlap:true});
 scheduler.startCronJobs();scheduler.startCronJobs();
 for(const job of mockJobs) expect(job.start).toHaveBeenCalledTimes(1);
 scheduler.stopCronJobs();
 for(const job of mockJobs) expect(job.stop).toHaveBeenCalledTimes(1);
});

