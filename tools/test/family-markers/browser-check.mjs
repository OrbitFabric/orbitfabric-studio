// Optional actual-App rendering checks. Requires separately supplied Playwright/Chromium.
// Run from repository root after preparing reports; no production dependencies added.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
await new Promise(r=>setTimeout(r,1000));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-gpu']});
const out=process.argv[2] || 'docs/evidence/j1';
const evidence={browser:b.version(),widths:[],native:'NOT RUN',harness:'Actual App; retained freshly exported pinned Core reports; mocked IPC and file picker'};
try {
 for(const width of [1280,960,640]) {
  const page=await b.newPage({viewport:{width,height:900}});
  async function navigate(name) {const button=page.getByRole('button',{name,exact:true}); if(width===640){await button.focus();await page.keyboard.press('Enter');}else await button.click();}
  await page.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html?evidence=r1');
  await page.getByRole('button',{name:'Open Mission',exact:true}).click();
  await page.getByLabel('Mission Atlas',{exact:true}).waitFor();
  const headerOverlap=await page.evaluate(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent==='Scenarios');const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !e.contains(hit);});
  const atlas=await page.locator('.atlas .family-marker').count();assert.equal(atlas,8);
  await page.screenshot({path:`${out}/atlas-${width}.png`});
  await navigate('Scenarios');
  await page.getByRole('button',{name:'Choose Scenario',exact:true}).click();
  await page.locator('.scenario-atom').first().waitFor();
  assert.equal(await page.locator('.scenario-atom').count(),8);
  const labels=await page.locator('.scenario-atom-heading h3').allTextContents();
  assert.ok(labels.includes('Scenario status expectation'));
  assert.equal(await page.locator('.scenario-workspace [data-family="result"]').count(),0);
  const markers=await page.locator('.scenario-workspace .family-marker').count();
  const overflow=await page.locator('.family-label').evaluateAll(els=>els.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
  assert.deepEqual(overflow,[]);
  await page.screenshot({path:`${out}/scenario-${width}.png`});
  if(width===1280){await page.evaluate(()=>{const orig=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=(cmd,args,...rest)=>{if(cmd==='save_surface_capture_png'){window.__j1Capture=args.dataUrl;return Promise.resolve({path:'/browser-only/capture.png'});}return orig(cmd,args,...rest);};});await page.getByRole('button',{name:'Capture full current Studio surface as PNG'}).click();await page.locator('[data-capture-phase="saved"]').waitFor({timeout:30000});const url=await page.evaluate(()=>window.__j1Capture);writeFileSync(`${out}/scenario-capture.png`,Buffer.from(url.split(',')[1],'base64'));assert.equal(await page.locator('body[data-studio-capture]').count(),0);evidence.surfaceCapture='Chromium render and restoration PASS; native saving and clipboard NOT RUN';}
  // Real keyboard focus on an existing entity button, followed by existing inspection.
  const entity=page.locator('.scenario-entity:not(:disabled)').first();
  await entity.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  assert.ok(await entity.evaluate(e=>e.matches(':focus-visible')));
  const focused=await entity.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,border:getComputedStyle(e).borderColor}));
  const identity=await entity.locator('code').innerText();
  await entity.click();
  assert.ok((await page.locator('body').innerText()).includes(identity.split(':').slice(1).join(':')));
  // Return using the existing route; J1 introduces no Return architecture.
  await navigate('Scenarios');
  const selected=await page.locator('.scenario-entity.is-selected').count();assert.ok(selected>=1);
  await page.addStyleTag({content:'html {filter:grayscale(1)}'});
  await page.screenshot({path:`${out}/scenario-selected-gray-${width}.png`});
  await navigate('Evidence');
  await page.getByRole('button',{name:'Load Integration Result',exact:true}).click();
  await page.locator('.direct-evidence details').first().waitFor();
  await page.getByRole('button',{name:'Load Evidence Set',exact:true}).click();
  await page.getByText('2 retained records',{exact:true}).waitFor();
  assert.equal(await page.locator('.direct-evidence h2 [data-family="result"]').count(),1);
  assert.equal(await page.locator('.direct-evidence h2 [data-family="evidence"]').count(),1);
  await page.locator('.direct-evidence').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/evidence-gray-${width}.png`});
  evidence.widths.push({width,headerPointerOverlap:headerOverlap,navigation:width===640?"keyboard due to header overlap":"pointer",atlasMarkers:atlas,scenarioAtoms:8,scenarioMarkers:markers,overflow,keyboardFocus:focused,selectedEntityLinks:selected,evidenceHeadings:'PASS'});
  await page.close();
 }
 writeFileSync(`${out}/browser.json`,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
} finally {await b.close();server.kill();}
