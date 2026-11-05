// Actual production App, retained Core reports, mocked IPC. NOT native evidence.
// Requires the existing prepare.py export and a separately installed Playwright.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
(async()=>{
 const dir=path.resolve(process.env.VISUAL_SLICE_EVIDENCE_DIR||'docs/evidence/visual-slice-1/browser');fs.mkdirSync(dir,{recursive:true});
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','tools/test/scenario-browser/vite.config.ts','--host','127.0.0.1','--port','1420','--strictPort'],{stdio:'pipe'});
 let browser;const errors=[],results=[];
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),15000);server.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve();}});server.on('exit',c=>{clearTimeout(timer);reject(Error('Vite exit '+c));});});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const [width,height] of [[1672,941],[1280,800]]){
   const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));
   await p.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html');
   await p.getByRole('button',{name:'Open Mission',exact:true}).click();
   await p.locator('.participant-card').first().waitFor();
   assert.equal(await p.locator('.participant-card').count(),7);
   await p.screenshot({path:path.join(dir,`A-${width}.png`)});
   await p.getByRole('button',{name:'Mission Model',exact:true}).click();
   await p.locator('.engineering-node').first().waitFor();
   await p.waitForTimeout(700);
   await p.waitForFunction(()=>document.querySelectorAll('.react-flow__node').length===8);
   assert.equal(await p.locator('.react-flow__edge').count(),1);
   await p.screenshot({path:path.join(dir,`M-${width}.png`)});
   const select=p.getByLabel('Inspect represented entity',{exact:true});
   await select.selectOption(JSON.stringify(['subsystems','obc']));
   await p.getByRole('complementary',{name:'Engineering Inspector'}).waitFor();
   assert.match(await p.locator('.investigation-bar').innerText(),/Choose a question or acquire an exact subject/);
   await p.screenshot({path:path.join(dir,`M-inspected-${width}.png`)});
   await p.getByRole('button',{name:'Investigate inspected subject',exact:true}).click();
   assert.equal(await p.getByLabel('Anchor',{exact:true}).inputValue(),'subsystems\u0000obc');
   await p.screenshot({path:path.join(dir,`M-investigation-${width}.png`)});
   const camera=await p.locator('.react-flow__viewport').getAttribute('style');
   await p.getByRole('button',{name:'Overview / Atlas',exact:true}).click();
   await p.getByRole('button',{name:'Mission Model',exact:true}).click();
   await p.locator('.engineering-node').first().waitFor();
   await p.waitForTimeout(700);
   assert.equal(await p.locator('.react-flow__viewport').getAttribute('style'),camera);
   await p.screenshot({path:path.join(dir,`M-return-${width}.png`)});
   const scrolls=await p.evaluate(()=>[...document.querySelectorAll('.workspace-primary,.investigation-content,.experience-inspector-body')].map(e=>({className:e.className,top:e.scrollTop,left:e.scrollLeft})));
   await p.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();
   await p.waitForFunction(()=>window.__convergenceCapture?.dataUrl?.startsWith('data:image/png'));
   const capture=await p.evaluate(()=>window.__convergenceCapture);
   fs.writeFileSync(path.join(dir,`C-${width}.png`),Buffer.from(capture.dataUrl.split(',')[1],'base64'));
   await p.waitForFunction(()=>!document.body.hasAttribute('data-studio-capture'));
   assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('.workspace-primary,.investigation-content,.experience-inspector-body')].map(e=>({className:e.className,top:e.scrollTop,left:e.scrollLeft}))),scrolls);
   assert.equal(await p.locator('.react-flow__viewport').getAttribute('style'),camera);
   for(const route of ['Operations','Explore','Relations','Scenarios','Integrations','Evidence','Overview']){
    await p.locator('.workspace-nav').getByRole('button',{name:route,exact:true}).click();
    assert.equal(await p.locator('.studio-capture-surface .investigation-panel').count(),1);
   }
   results.push({width,height,status:'PASS',captureFilename:capture.filename,environment:'Chromium actual App; retained Core; mocked IPC/save; NOT native'});await p.close();
  }
  assert.deepEqual(errors,[]);
 }catch(e){results.push({status:'FAIL_OR_NOT_RUN',error:String(e)});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,errors},null,2)+'\n');await browser?.close();server.kill();}
})();
