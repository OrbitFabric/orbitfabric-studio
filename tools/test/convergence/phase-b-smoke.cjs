// Focused preservation smoke, retained Core fixtures + mocked IPC, not native evidence.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const server=require('child_process').spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','tools/test/scenario-browser/vite.config.ts','--host','127.0.0.1','--port','1420'],{stdio:'ignore'});
 let browser;
 try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html');
 await page.getByRole('button',{name:'Open Mission',exact:true}).click();
 await page.locator('.participant-card').first().waitFor();
 await page.locator('.workspace-nav').getByRole('button',{name:'Scenarios',exact:true}).click();
 await page.getByRole('button',{name:'Choose Scenario',exact:true}).click();
 await page.locator('.scenario-hero').waitFor();
 const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
 for(const context of [false,true]){
 if(context)await page.getByRole('button',{name:'Declared context',exact:true}).click();
 await page.locator('.react-flow__node').first().waitFor();
 await page.waitForTimeout(350);
 const before=await page.locator('.react-flow__viewport').getAttribute('style');
 const snap=await page.evaluate(()=>{
  const live=document.querySelector('.studio-capture-surface');
  window.__cloneCheck=null;
  const obs=new MutationObserver(()=>{
   const clone=document.querySelector('[data-scenario-capture]');if(!clone)return;
   window.__cloneCheck={atoms:clone.querySelectorAll('.scenario-atom').length,
    openAtoms:clone.querySelectorAll('.scenario-atom > details[open]').length,
    candidates:clone.querySelectorAll('.source-candidate').length,
    nodes:clone.querySelectorAll('.react-flow__node').length,
    edges:clone.querySelectorAll('.react-flow__edge').length,
    camera:clone.querySelector('.react-flow__viewport').style.transform,
    graphWidth:clone.querySelector('.react-flow').getBoundingClientRect().width,
    liveWidth:live.querySelector('.react-flow').getBoundingClientRect().width};
  });obs.observe(document.body,{childList:true,subtree:true});window.__smokeObserver=obs;
 });
 await page.evaluate(()=>window.__convergenceCapture=null);
 await page.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();
 await page.waitForFunction(()=>window.__convergenceCapture?.dataUrl?.startsWith('data:image/png'),null,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('[data-scenario-capture-host]'));
 const check=await page.evaluate(()=>{window.__smokeObserver.disconnect();return window.__cloneCheck;});
 assert.equal(check.atoms,8);assert.equal(check.openAtoms,8);assert.equal(check.candidates,5);
 assert.equal(check.nodes,context?5:8);assert.equal(check.edges,context?4:0);
 assert.equal(check.graphWidth,check.liveWidth);
 assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),before);
 assert.equal(await page.locator('.scenario-sources').evaluate(e=>e.open),false);
 const capture=await page.evaluate(()=>window.__convergenceCapture);
 fs.writeFileSync(`${out}/${context?'context':'declaration'}.png`,Buffer.from(capture.dataUrl.split(',')[1],'base64'));
 console.log('PASS capture',context?'context':'declaration',JSON.stringify(check));
 await page.waitForFunction(()=>document.querySelector('.capture-action').dataset.capturePhase==='idle');
 }
 await page.locator('.scenario-sources > summary').click();
 assert.ok(await page.locator('.source-candidate code').first().evaluate(e=>e.scrollWidth<=e.clientWidth));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS exact filenames readable at 1280 CSS px / DPR 2');
 // A save error must discard the detached copy without changing live state.
 await page.evaluate(()=>window.__convergenceFailCapture=true);
 const camera=await page.locator('.react-flow__viewport').getAttribute('style');
 await page.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.capture-action').dataset.capturePhase==='failed');
 assert.equal(await page.locator('[data-scenario-capture-host]').count(),0);
 assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),camera);
 console.log('PASS save-failure cleanup and camera preservation');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
