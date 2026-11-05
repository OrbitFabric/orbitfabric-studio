// Real App + retained pinned Core reports; IPC/save mocked. NOT native acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const baseline=process.env.UX13_BASELINE==='1';
const dir=path.resolve(`docs/evidence/ux13/${baseline?'before':'after'}`);fs.mkdirSync(dir,{recursive:true});
const near=(a,b,msg,tol=.08)=>assert.ok(Math.abs(a-b)<tol,`${msg}: ${a} != ${b}`);
async function metrics(p){return p.evaluate(()=>{
 const flow=document.querySelector('.mission-model .react-flow'),svg=flow.querySelector('.react-flow__minimap-svg'),panel=svg.parentElement;
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 const t=new DOMMatrix(getComputedStyle(flow.querySelector('.react-flow__viewport')).transform);
 const mask=svg.querySelector('.react-flow__minimap-mask').getAttribute('d').trim().split('M')[2].match(/-?\d*\.?\d+(?:e[+-]?\d+)?/g).map(Number);
 const mm=[...svg.querySelectorAll('.react-flow__minimap-node')].map(e=>({x:+e.getAttribute('x'),y:+e.getAttribute('y'),width:+e.getAttribute('width'),height:+e.getAttribute('height')}));
 const nodes=[...flow.querySelectorAll('.react-flow__node')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.id,x:(r.x-flow.getBoundingClientRect().x-t.e)/t.a,y:(r.y-flow.getBoundingClientRect().y-t.f)/t.a,width:r.width/t.a,height:r.height/t.a}});
 const eyebrow=document.querySelector('.mission-model .eyebrow'),section=eyebrow.closest('.mission-model');
 const range=document.createRange();range.setStart(eyebrow.firstChild,0);range.setEnd(eyebrow.firstChild,1);
 return {flow:rect(flow),panel:rect(panel),svg:rect(svg),svgWidth:svg.width.baseVal.value,svgHeight:svg.height.baseVal.value,viewBox:svg.getAttribute('viewBox').split(' ').map(Number),mask,viewport:{x:t.e,y:t.f,zoom:t.a},nodes,mm,header:{eyebrow:rect(eyebrow),title:rect(section.querySelector('h2')),firstLetter:rect(range),radius:getComputedStyle(section).borderTopLeftRadius,overflow:getComputedStyle(section).overflow},edges:flow.querySelectorAll('.react-flow__edge').length};
 });}
function qualify(m){
 near(m.svgWidth,m.svg.width,'SVG pixel width');near(m.svgHeight,m.svg.height,'SVG pixel height');
 assert.ok(m.svg.right<=m.panel.right+.1&&m.svg.bottom<=m.panel.bottom+.1,'minimap SVG must fit panel');
 near(m.mask[0],-m.viewport.x/m.viewport.zoom,'mask x');near(m.mask[1],-m.viewport.y/m.viewport.zoom,'mask y');near(m.mask[2],m.flow.width/m.viewport.zoom,'mask width');near(m.mask[3],m.flow.height/m.viewport.zoom,'mask height');
 for(const n of m.nodes){const match=m.mm.find(v=>Math.abs(v.x-n.x)<.1&&Math.abs(v.y-n.y)<.1);assert.ok(match,'minimap node position '+n.id);near(match.width,n.width,'measured node width');near(match.height,n.height,'measured node height');}
 near(m.header.eyebrow.x,m.header.title.x,'eyebrow/title alignment');assert.equal(m.header.radius,'0px','borderless Model must not clip first glyph at rounded corner');
}
(async()=>{const results=[],errors=[];let browser;const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','tools/test/scenario-browser/vite.config.ts','--host','127.0.0.1','--port','1420','--strictPort']);
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),15000);server.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}});server.on('exit',c=>{clearTimeout(timer);reject(Error('Vite exit '+c))})});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height] of [[1672,941],[1280,800]]){
 const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:1420/tools/test/scenario-browser/index.html');await p.getByRole('button',{name:'Open Mission',exact:true}).click();await p.locator('.participant-card').first().waitFor();await p.getByRole('button',{name:'Mission Model',exact:true}).click();await p.locator('.engineering-node').first().waitFor();await p.waitForTimeout(700);
 const checks=[];
 async function check(label,shot=false){await p.waitForTimeout(180);const m=await metrics(p);if(!baseline)qualify(m);checks.push({label,...m});if(shot)await p.screenshot({path:path.join(dir,`${label}-${width}.png`)});return m;}
 const initial=await check('initial',true);assert.equal(initial.nodes.length,8);assert.equal(initial.edges,1);await p.locator('.mission-model > header').screenshot({path:path.join(dir,`header-${width}.png`)});
 // Click alone follows standard XYFlow behavior: no centering or camera jump.
 const box=await p.locator('.react-flow__minimap-svg').boundingBox();await p.mouse.click(box.x+35,box.y+25);await p.waitForTimeout(200);let m=await check('minimap-click');assert.deepEqual(m.viewport,initial.viewport);
 // Single deterministic drag checks library pan scale against the visible canvas and node union.
 const v=m.viewport;const left=Math.min(-v.x/v.zoom,...m.nodes.map(n=>n.x)),right=Math.max((m.flow.width-v.x)/v.zoom,...m.nodes.map(n=>n.x+n.width));
 const top=Math.min(-v.y/v.zoom,...m.nodes.map(n=>n.y)),bottom=Math.max((m.flow.height-v.y)/v.zoom,...m.nodes.map(n=>n.y+n.height));
 const scale=Math.max((right-left)/m.svgWidth,(bottom-top)/m.svgHeight);
 await p.mouse.move(box.x+35,box.y+25);await p.mouse.down();await p.mouse.move(box.x+43,box.y+29);await p.mouse.up();m=await check('minimap-pan',true);
 near(m.viewport.x,v.x-8*scale*v.zoom,'pointer drag x',.12);near(m.viewport.y,v.y-4*scale*v.zoom,'pointer drag y',.12);near(m.viewport.zoom,v.zoom,'pan retains zoom');
 if(baseline){results.push({width,height,status:'REPRODUCED',checks});await p.close();continue;}
 await p.mouse.move(box.x+50,box.y+35);await p.mouse.wheel(0,-80);m=await check('minimap-zoom');assert.ok(m.viewport.zoom>v.zoom,'wheel zoom increases zoom');
 await p.locator('.react-flow__controls-fitview').click();await p.waitForTimeout(400);await check('fit',true);
 await p.locator('.react-flow__controls-zoomin').click();await p.waitForTimeout(400);await check('controls-zoom');
 const pane=await p.locator('.react-flow__pane').boundingBox();await p.mouse.move(pane.x+pane.width/2,pane.y+pane.height-35);await p.mouse.down();await p.mouse.move(pane.x+pane.width/2+45,pane.y+pane.height-20);await p.mouse.up();await check('canvas-pan');
 const select=p.getByLabel('Inspect represented entity',{exact:true});await select.selectOption(JSON.stringify(['subsystems','obc']));await p.getByRole('complementary',{name:'Engineering Inspector'}).waitFor();await p.waitForTimeout(400);await check('inspector-open',true);
 await p.getByLabel('Inspector width',{exact:true}).fill('480');await p.waitForTimeout(400);await check('inspector-resize',true);
 const mm=await p.locator('.react-flow__minimap-svg').boundingBox();await p.mouse.move(mm.x+50,mm.y+30);await p.mouse.down();await p.mouse.move(mm.x+45,mm.y+34);await p.mouse.up();const remembered=await check('inspector-minimap-pan');
 await p.getByRole('button',{name:'Overview / Atlas',exact:true}).click();await p.getByRole('button',{name:'Mission Model',exact:true}).click();await p.waitForTimeout(500);m=await check('atlas-return',true);assert.deepEqual(m.viewport,remembered.viewport);
 await p.getByLabel('Mission subsystem orientation',{exact:true}).selectOption(JSON.stringify(['subsystems','obc']));await p.waitForTimeout(400);await check('focused');await p.getByRole('button',{name:'Whole Mission',exact:true}).click();await p.waitForTimeout(400);m=await check('whole-return');assert.deepEqual(m.viewport,remembered.viewport);assert.equal(m.nodes.length,8);assert.equal(m.edges,1);
 await p.getByRole('button',{name:'Investigate inspected subject',exact:true}).click();assert.equal(await p.getByLabel('Anchor',{exact:true}).inputValue(),'subsystems\u0000obc');await check('investigation',true);
 const camera=(await metrics(p)).viewport;await p.getByRole('button',{name:'Capture full current Studio surface as PNG',exact:true}).click();await p.waitForFunction(()=>window.__convergenceCapture?.dataUrl?.startsWith('data:image/png'));await p.waitForFunction(()=>!document.body.hasAttribute('data-studio-capture'));await p.waitForTimeout(250);assert.deepEqual((await metrics(p)).viewport,camera);fs.writeFileSync(path.join(dir,`capture-${width}.png`),Buffer.from((await p.evaluate(()=>window.__convergenceCapture.dataUrl)).split(',')[1],'base64'));await check('capture-restored');
 await p.getByRole('button',{name:'Close investigation',exact:true}).click();await p.getByRole('button',{name:'Clear inspection',exact:true}).click();await p.waitForTimeout(400);await check('inspector-close',true);
 results.push({width,height,status:'PASS',checks});await p.close();
 }assert.deepEqual(errors,[]);
 }catch(e){results.push({status:'FAIL',error:e.stack});process.exitCode=1;}finally{fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({environment:'Chromium; actual App; retained Core reports; mocked IPC/save; NOT native',results,errors},null,2));await browser?.close();server.kill();}
})();
