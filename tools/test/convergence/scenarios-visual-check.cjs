// Actual production App with retained Core reports and mocked native IPC. NOT native evidence.
// Run from repository root. Dependencies remain external to product package.json.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const server=require('child_process').spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','tools/test/scenario-browser/vite.config.ts','--host','127.0.0.1','--port','1420'],{cwd:process.cwd(),stdio:'ignore'});process.on('exit',()=>server.kill());await new Promise(r=>setTimeout(r,1800));const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:process.env.CHROMIUM_ARGS_JSON ? JSON.parse(process.env.CHROMIUM_ARGS_JSON) : ['--no-sandbox','--disable-dev-shm-usage'],headless:true});
const out=process.argv[2] || 'docs/evidence/scenarios-convergence/browser';fs.mkdirSync(out,{recursive:true});
for(const [width,height] of [[1672,941],[1280,800]]){
 const p=await b.newPage({viewport:{width,height}});p.on('pageerror',e=>console.log('PAGE ERROR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('BROWSER ERROR',m.text())});
 await p.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html');await p.getByRole('button',{name:'Open Mission',exact:true}).click();await p.locator('.participant-card').first().waitFor();await p.screenshot({path:`${out}/atlas-${width}.png`});
 await p.getByRole('button',{name:'Mission Model',exact:true}).click();await p.locator('.engineering-node').first().waitFor();await p.waitForTimeout(500);await p.screenshot({path:`${out}/model-${width}.png`});
 await p.locator('.workspace-nav').getByRole('button',{name:'Scenarios',exact:true}).click();await p.getByRole('button',{name:'Choose Scenario',exact:true}).click();await p.locator('.scenario-hero').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);await p.screenshot({path:`${out}/declaration-${width}.png`});
 assert.equal(await p.locator('.scenario-representation .react-flow__node').count(),8);
 assert.equal(await p.locator('.scenario-representation .react-flow__edge').count(),0);
 assert.equal(await p.locator('.scenario-atom').count(),8);
 await p.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();
 await p.waitForFunction(()=>window.__convergenceCapture?.dataUrl?.startsWith('data:image/png'));
 const declarationCapture=await p.evaluate(()=>window.__convergenceCapture);
 fs.writeFileSync(`${out}/capture-declaration-${width}.png`,Buffer.from(declarationCapture.dataUrl.split(',')[1],'base64'));
 const declarationBounds=await p.evaluate(()=>window.__convergenceCaptureLayout);
 fs.writeFileSync(`${out}/capture-declaration-bounds-${width}.json`,JSON.stringify(declarationBounds,null,2));
 for(const graph of declarationBounds)for(const n of graph.nodes)assert.ok(n.left>=-1&&n.top>=-1&&n.right<=graph.width+1&&n.bottom<=graph.height+1);
 await p.waitForFunction(()=>!document.body.hasAttribute('data-studio-capture'));
 await p.evaluate(()=>window.__convergenceCapture=null);

 await p.getByLabel('Inspect atom',{exact:true}).selectOption('atom-0008');
 assert.match(await p.locator('.experience-inspector').innerText(),/PASSED/);
 await p.getByRole('button',{name:'Clear inspection',exact:true}).click();

 await p.getByRole('button',{name:'Declared context',exact:true}).click();await p.getByLabel('Inspect represented entity',{exact:true}).selectOption(JSON.stringify(['commands','payload.stop_acquisition']));await p.waitForTimeout(500);await p.screenshot({path:`${out}/context-${width}.png`});
 assert.equal(await p.locator('.scenario-representation .react-flow__node').count(),5);
 assert.equal(await p.locator('.scenario-representation .react-flow__edge').count(),4);
 await p.getByLabel('Inspect represented entity',{exact:true}).selectOption(JSON.stringify(['events','payload.acquisition_completed']));
 await p.getByRole('button',{name:'Return to previous subject',exact:true}).click();
 assert.equal(await p.getByLabel('Inspect represented entity',{exact:true}).inputValue(),JSON.stringify(['commands','payload.stop_acquisition']));
 const camera=await p.locator('.react-flow__viewport').getAttribute('style');
 if(!await p.locator('.scenario-sources').evaluate(e=>e.open))await p.locator('.scenario-sources > summary').click();
 await p.locator('.source-candidate').filter({hasText:'eclipse low power'}).click();
 await p.waitForFunction(()=>document.querySelector('.scenario-hero h2')?.textContent?.includes('Eclipse'));
 await p.locator('.source-candidate').filter({hasText:'payload stop acquisition'}).click();
 await p.waitForFunction(()=>document.querySelector('.scenario-hero h2')?.textContent?.includes('Payload stop'));
 await p.waitForTimeout(300);
 assert.equal(await p.getByRole('button',{name:'Declared context',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await p.locator('.react-flow__viewport').getAttribute('style'),camera);
 if(width===1280)await p.locator('.scenario-sources > summary').click();
 await p.locator('.scenario-representation .engineering-canvas').scrollIntoViewIfNeeded();
 await p.screenshot({path:`${out}/context-reading-${width}.png`});
 await p.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();
 await p.waitForFunction(()=>window.__convergenceCapture?.dataUrl?.startsWith('data:image/png'),{},{timeout:20000});
 const capture=await p.evaluate(()=>window.__convergenceCapture);
 fs.writeFileSync(`${out}/capture-context-${width}.png`,Buffer.from(capture.dataUrl.split(',')[1],'base64'));
 fs.writeFileSync(`${out}/capture-bounds-${width}.json`,JSON.stringify(await p.evaluate(()=>window.__convergenceCaptureLayout),null,2));
 await p.waitForFunction(()=>!document.body.hasAttribute('data-studio-capture'));
 assert.equal(await p.locator('.react-flow__viewport').getAttribute('style'),camera);
 console.log('PASS',width,'8 atoms; 5/4 context; exact expected status; Inspector Return; A-B-A context and camera; Capture camera restoration');

 await p.close();
 const n=await b.newPage({viewport:{width,height}});await n.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html?scenario=failed');await n.getByRole('button',{name:'Open Mission',exact:true}).click();await n.locator('.participant-card').first().waitFor();await n.locator('.workspace-nav').getByRole('button',{name:'Scenarios',exact:true}).click();await n.getByRole('button',{name:'Choose Scenario',exact:true}).click();await n.getByText('Core could not declare this Scenario',{exact:true}).waitFor();await n.screenshot({path:`${out}/negative-${width}.png`});await n.close();
}
for(const width of [960,640]){
 const p=await b.newPage({viewport:{width,height:800}});await p.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html');await p.getByRole('button',{name:'Open Mission',exact:true}).click();await p.locator('.participant-card').first().waitFor();await p.locator('.workspace-nav').getByRole('button',{name:'Scenarios',exact:true}).click();await p.getByRole('button',{name:'Choose Scenario',exact:true}).click();await p.locator('.scenario-hero').waitFor();await p.waitForTimeout(400);
 assert.equal(await p.locator('.scenario-atom').count(),8);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:`${out}/declaration-${width}.png`});
 await p.locator('.scenario-atom').last().locator('summary').first().click();await p.locator('.scenario-atom').last().scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/structured-${width}.png`});console.log('PASS',width,'eight structured atoms accessible; no document overflow');await p.close();
}
await b.close();server.kill();process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});
