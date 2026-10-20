const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright-core",
);
(async () => {
  const dir = path.resolve(process.env.CONVERGENCE_EVIDENCE_DIR || "docs/evidence/convergence");
  fs.mkdirSync(dir, { recursive: true });
  const reports = JSON.parse(fs.readFileSync(".sp2-acceptance/reports.json"));
  const results = [];
  const errors = [];
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "tools/test/scenario-browser/vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      "1420",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        if (String(d).includes("ready")) resolve();
      });
      server.on("exit", (c) => reject(Error("Vite exit " + c)));
      setTimeout(() => reject(Error("Vite startup timeout")), 10000);
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    for (const width of (process.env.CONVERGENCE_WIDTHS ? process.env.CONVERGENCE_WIDTHS.split(",").map(Number) : [1280, 960, 640])) {
      const p = await browser.newPage({ viewport: { width, height: 1000 } });
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", m=>{if(m.type()==="warn"||m.type()==="error")console.log(m.type(),m.text());});
      try {
        await p.goto(
          "http://127.0.0.1:1420/tools/test/scenario-browser/index.html?evidence=r1",
        );
        await p
          .getByRole("button", { name: "Open Mission", exact: true })
          .click();
        await p
          .getByRole("heading", { name: "Mission Model", exact: true })
          .waitFor();
        await p.locator(".engineering-node").first().waitFor();
        await p.screenshot({ path: path.join(dir, `mission-${width}.png`) });
        const nav = p.locator(".workspace-nav");
        await nav
          .getByRole("button", { name: "Scenarios", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Choose Scenario", exact: true })
          .click();
        await p
          .getByRole("region", { name: "Graphical Scenario declaration" })
          .waitFor();
        await p
          .getByRole("button", { name: "Engineering questions", exact: true })
          .click();
        const panel = p.getByRole("region", {
          name: "Engineering investigation",
        });
        await panel
          .getByRole("button", {
            name: "Include loaded declaration",
            exact: true,
          })
          .click();
        await panel
          .getByLabel("Anchor", { exact: true })
          .selectOption({ label: "commands:payload.stop_acquisition" });
        assert.match(await panel.innerText(), /AVAILABLE · coverage UNKNOWN/);
        assert.match(await panel.innerText(), /atom-0004/);
        const before = await panel
          .getByLabel("Anchor", { exact: true })
          .inputValue();
        await panel
          .getByRole("button", { name: "Inspect atom", exact: true })
          .click();
        const inspector = p.getByRole("dialog", {
          name: "Engineering Inspector",
        });
        if (width === 640)
          await inspector
            .getByRole("button", { name: "Return to context", exact: true })
            .click();
        assert.equal(
          await panel.getByLabel("Anchor", { exact: true }).inputValue(),
          before,
        );
        await p.screenshot({
          path: path.join(dir, `participation-${width}.png`),
        });
        // Close investigation to read the same native Scenario and inspect authored expectation.
        await p
          .getByRole("button", { name: "Engineering questions", exact: true })
          .click();
        await p
          .getByLabel("Inspect atom", { exact: true })
          .selectOption("atom-0008");
        await p.screenshot({
          path: path.join(dir, `scenario-inspector-${width}.png`),
        });
        if (width === 640)
          await p
            .getByRole("button", { name: "Return to context", exact: true })
            .click();
        await p
          .getByRole("button", { name: "Clear inspection", exact: true })
          .click();
        if (width === 1280) {
          await p.getByRole("button", {name:"Capture full current Studio surface as PNG",exact:true}).click();
          await p.waitForFunction(()=>!!window.__convergenceCapture, null, {timeout:30000});
          const capture=await p.evaluate(()=>window.__convergenceCapture);
          fs.writeFileSync(path.join(dir,"scenario-capture.png"),Buffer.from(capture.dataUrl.split(",")[1],"base64"));
          await p.waitForFunction(()=>!document.body.hasAttribute("data-studio-capture"));
          assert.equal(await p.getByLabel("Inspect atom",{exact:true}).count(),1);
        }
        await nav
          .getByRole("button", { name: "Evidence", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Load Integration Result", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Load Evidence Set", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Engineering questions", exact: true })
          .click();
        await panel
          .getByLabel("Question", { exact: true })
          .selectOption("projection");
        await panel
          .getByLabel("Exact Result", { exact: true })
          .selectOption({ index: 1 });
        assert.equal(await panel.locator("tbody tr").count(), 8);
        assert.match(await panel.innerText(), /not_projected/);
        await p.screenshot({ path: path.join(dir, `projection-${width}.png`) });
        await panel
          .getByLabel("Question", { exact: true })
          .selectOption("association");
        assert.match(await panel.innerText(), /Assessment: UNAVAILABLE/);
        await p.screenshot({
          path: path.join(dir, `association-${width}.png`),
        });
        // Load two independent, freshly exported Core declarations via the same native picker.
        for (const name of [
          "adcs_degraded_pointing_payload_inhibit",
          "eclipse_low_power_payload_suspension",
        ]) {
          await panel
            .getByRole("button", { name: "Open native Scenarios", exact: true })
            .click();
          await p.evaluate(
            (v) => (window.__convergenceScenarioPath = v),
            Object.keys(reports.scenarioInvocations).find((k) =>
              k.endsWith(name + ".yaml"),
            ),
          );
          await p
            .getByRole("button", { name: "Choose Scenario", exact: true })
            .click();
          await p.waitForFunction(
            (n) =>
              document
                .querySelector(".scenario-binding")
                ?.textContent.includes(n),
            name,
          );
          await panel
            .getByRole("button", {
              name: "Include loaded declaration",
              exact: true,
            })
            .click();
        }
        await panel
          .getByLabel("Question", { exact: true })
          .selectOption("compare");
        await panel
          .getByLabel("Left operand", { exact: true })
          .selectOption({ index: 2 });
        await panel
          .getByLabel("Right operand", { exact: true })
          .selectOption({ index: 3 });
        assert.match(await panel.innerText(), /ordered atoms: DIFFERENT/);
        await p.screenshot({ path: path.join(dir, `compare-${width}.png`) });
        await panel
          .getByRole("button", {
            name: "Return to previous investigation",
            exact: true,
          })
          .click();
        assert.equal(
          await panel.getByLabel("Right operand", { exact: true }).inputValue(),
          "",
        );
        await panel
          .getByLabel("Question", { exact: true })
          .selectOption("execution");
        assert.match(await panel.innerText(), /UNSUPPORTED/);
        await p
          .getByRole("button", { name: "Engineering questions", exact: true })
          .click();
        for (const label of [
          "Overview",
          "Explore",
          "Relations",
          "Operations",
          "Integrations",
        ]) {
          await nav.getByRole("button", { name: label, exact: true }).click();
          await p.waitForTimeout(80);
        }
        await nav.getByRole("button",{name:"Overview",exact:true}).click();
        await p.getByRole("button",{name:"Engineering questions",exact:true}).click();
        const questionBefore=await panel.getByLabel("Question",{exact:true}).inputValue();
        await panel.getByRole("button",{name:"Open native Scenarios",exact:true}).click();
        await panel.getByRole("button",{name:"Return to investigation context",exact:true}).click();
        assert.equal(await nav.locator('.is-active').innerText(),'Overview');
        assert.equal(await panel.getByLabel("Question",{exact:true}).inputValue(),questionBefore);
        // REGIA continuation: actual Core graph, relation endpoint identity and Return.
        const closeCompact=async()=>{if(width===640&&await p.getByRole("dialog",{name:"Engineering Inspector"}).count())await p.getByRole("button",{name:"Return to context",exact:true}).click();};
        if(await p.getByRole("button",{name:"Clear inspection",exact:true}).count())await p.getByRole("button",{name:"Clear inspection",exact:true}).click();
        await panel.getByLabel("Question",{exact:true}).selectOption("participation");
        await panel.getByLabel("Anchor",{exact:true}).selectOption({label:"subsystems:radiation_payload"});
        const scopeBefore=await panel.locator('.scope-option input:checked').count();
        await p.getByRole("button",{name:"Engineering questions",exact:true}).click();
        const mission=p.getByRole("region",{name:"Mission Model",exact:true});
        await mission.getByRole("button",{name:"Radiation Event Payload",exact:true}).click();
        await closeCompact();
        await mission.getByLabel("Mission representation").selectOption("commands");
        await mission.locator('details summary').click();
        const rel=mission.locator('.experience-relation').filter({hasText:'commands:payload.stop_acquisition'}).first();
        await rel.click({timeout:120000});
        assert.equal(await mission.locator('.react-flow__edge.selected').count(),1);
        assert.equal(await mission.locator('.react-flow__node.selected').count(),0);
        const inspectorPanel=p.locator('.experience-inspector');
        await inspectorPanel.getByRole("button",{name:"From · commands:payload.stop_acquisition",exact:true}).click();
        await closeCompact();
        assert.match(await panel.getByLabel("Investigation subject proposal").innerText(),/Proposed subject: commands:payload.stop_acquisition/);
        assert.match(await panel.getByLabel("Investigation subject proposal").innerText(),/Native selection: subsystems:radiation_payload/);
        await panel.getByRole("button",{name:"Investigate inspected subject",exact:true}).click();
        assert.equal(await panel.getByLabel("Anchor",{exact:true}).inputValue(),'commands\u0000payload.stop_acquisition');
        assert.equal(await panel.locator('.scope-option input:checked').count(),scopeBefore);
        await p.screenshot({path:path.join(dir,`endpoint-anchor-${width}.png`)});
        await p.getByRole("button",{name:"Engineering questions",exact:true}).click();
        await inspectorPanel.getByRole("button",{name:"Return to previous subject",exact:true}).click();
        await closeCompact();
        assert.equal(await mission.locator('.react-flow__edge.selected').count(),1);
        assert.equal(await panel.getByRole("button",{name:"Investigate inspected subject",exact:true}).isDisabled(),true);
        if(width===640)await inspectorPanel.getByRole("button",{name:"Read details",exact:true}).click();
        await inspectorPanel.getByRole("button",{name:"From · commands:payload.stop_acquisition",exact:true}).click();
        await closeCompact();
        // Representation changes retain subject and expose absence without changing Anchor.
        await mission.getByLabel("Mission representation").selectOption("events");
        await mission.getByText(/Inspected subject is outside this representation/).waitFor();
        await p.screenshot({path:path.join(dir,`mission-event-${width}.png`)});
        await mission.getByRole("button",{name:"Show declared neighbors",exact:true}).click({timeout:120000});
        await mission.locator('.react-flow__node.selected').waitFor();
        await mission.getByRole("button",{name:"Show inspected subject",exact:true}).click();
        await inspectorPanel.locator('.experience-inspector-body').evaluate(el=>el.scrollTop=80);
        const readingTop=await inspectorPanel.locator('.experience-inspector-body').evaluate(el=>el.scrollTop);
        const camera=await mission.locator('.react-flow__viewport').getAttribute('style');
        await inspectorPanel.getByRole("button",{name:"Read details",exact:true}).click();
        const dialog=p.getByRole("dialog",{name:"Engineering Inspector"});
        await dialog.waitFor();
        assert.equal(await p.locator('.workspace-primary').evaluate(el=>el.inert),true);
        assert.equal(await inspectorPanel.locator('.experience-inspector-body').evaluate(el=>el.scrollTop),readingTop);
        await p.keyboard.press('Shift+Tab');
        assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
        const keyboardReadingTop=await inspectorPanel.locator('.experience-inspector-body').evaluate(el=>el.scrollTop);
        await p.keyboard.press('Escape');
        assert.equal(await mission.locator('.react-flow__viewport').getAttribute('style'),camera);
        if(width===640)await inspectorPanel.getByRole('button',{name:'Read details',exact:true}).click();
        assert.equal(await inspectorPanel.locator('.experience-inspector-body').evaluate(el=>el.scrollTop),keyboardReadingTop);
        await closeCompact();
        await mission.getByRole("button",{name:"Reset layout",exact:true}).click();
        assert.equal(await mission.locator('.react-flow__viewport').getAttribute('style'),camera);
        await p.screenshot({path:path.join(dir,`mission-neighbors-${width}.png`)});
        await mission.getByRole("button",{name:"Return to family",exact:true}).click();
        // Context projection uses the loaded authoritative declaration, not Lab source fixtures.
        await nav.getByRole("button",{name:"Scenarios",exact:true}).click();
        await p.getByRole("button",{name:"Declared context",exact:true}).click();
        await p.getByRole("button",{name:"Clear inspection",exact:true}).click();
        const scenarioGraph=p.getByRole("region",{name:"Graphical Scenario declaration"});
        await scenarioGraph.locator('.engineering-node').first().waitFor();
        await p.screenshot({path:path.join(dir,`scenario-context-${width}.png`)});
        const cardBounds=await scenarioGraph.locator('.engineering-node').evaluateAll(nodes=>nodes.map(n=>({text:n.innerText,overflow:n.scrollHeight>n.clientHeight+2,horizontal:n.scrollWidth>n.clientWidth+2})));
        assert.ok(cardBounds.every(n=>!n.overflow&&!n.horizontal),JSON.stringify(cardBounds));
        await scenarioGraph.getByLabel("Scenario context focus",{exact:true}).selectOption({label:"commands:payload.stop_acquisition"});
        await scenarioGraph.getByLabel("Inspect represented entity",{exact:true}).selectOption({label:"commands:payload.stop_acquisition"});
        await closeCompact();
        await scenarioGraph.getByRole("button",{name:"Show inspected subject",exact:true}).click();
        await p.screenshot({path:path.join(dir,`scenario-focused-${width}.png`)});
        await p.getByRole("button",{name:"Refresh",exact:true}).click();
        await p.waitForFunction(()=>document.querySelector('.investigation-bar')?.textContent.includes('0 selected declarations'));
        assert.equal(await p.locator('.experience-inspector').count(),0);
        await p.getByRole("button",{name:"Engineering questions",exact:true}).click();
        assert.equal(await panel.getByLabel("Anchor",{exact:true}).inputValue(),'');
        assert.equal(await panel.locator('.scope-option').count(),0);
        assert.equal(await panel.getByRole("button",{name:"Return to investigation context",exact:true}).count(),0);
        results.push({
          width,
          continuation: "PASS: endpoint proposal, exact Anchor, retained Scope, edge-only inspection, subject Return, outside representation, camera/Reset, modal focus, Core Scenario context, generation invalidation",
          cardBounds,
          status: "PASS",
          scope:
            "Actual App; retained Core reports via mocked IPC; mission/scenario/participation/projection/association/compare/Return and native route navigation",
        });
      } catch (e) {
        results.push({ width, status: "FAIL", error: e.message });
        fs.writeFileSync(path.join(dir,`failure-dom-${width}.json`),JSON.stringify(await p.evaluate(()=>({edges:[...document.querySelectorAll('.react-flow__edge')].map(n=>n.outerHTML),nodes:[...document.querySelectorAll('.react-flow__node')].map(n=>({html:n.outerHTML,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})),inspector:document.querySelector('.experience-inspector')?.innerText})),null,2));
        await p.screenshot({ path: path.join(dir, `failure-${width}.png`) });
        throw e;
      } finally {
        await p.close();
      }
    }
    assert.deepEqual(errors, []);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.writeFileSync(
      path.join(dir, "browser.json"),
      JSON.stringify(
        {
          results,
          errors,
          provenance: reports.convergenceProvenance,
          nativeIPC: "NOT RUN",
          WebKitGTK: "NOT RUN",
          WebView2: "NOT RUN",
        },
        null,
        2,
      ),
    );
  }
})();
