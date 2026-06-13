#!/usr/bin/env node

/**
 * Hierarchical CLI Tool for Research Orchestrator
 * Supports tree structures and multi-provider settings (Gemini, ChatGPT, Claude, OpenRouter).
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { runOrchestrator, PRESETS } from './src/orchestrator/engine.js';

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}i${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✔${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✖${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.magenta}=== ${msg} ===${colors.reset}\n`),
  section: (title) => console.log(`\n${colors.bold}${colors.cyan}--- ${title} ---${colors.reset}`)
};

function showHelp() {
  console.log(`
${colors.bold}${colors.cyan}Research Orchestrator Hierarchical CLI${colors.reset}
Usage:
  npm run cli -- [options]
  node cli.js [options]

Options:
  -i, --industry <name>      The industry to research (e.g. "Solar Energy")
  -c, --context <brief>      Detailed context or research brief
  -o, --output <filename>    Filename to save output report (default: research_report.md)
  -p, --provider <name>      API Provider: gemini | openai | anthropic | openrouter (default: gemini)
  -k, --key <api_key>        API Key for the selected provider (otherwise defaults to Mock mode)
  -h, --help                 Show help menu
`);
  process.exit(0);
}

// Parse args
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
}

let industry = "";
let context = "";
let output = "research_report.md";
let provider = "gemini";
let apiKey = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--industry' || args[i] === '-i') {
    industry = args[++i];
  } else if (args[i] === '--context' || args[i] === '-c') {
    context = args[++i];
  } else if (args[i] === '--output' || args[i] === '-o') {
    output = args[++i];
  } else if (args[i] === '--provider' || args[i] === '-p') {
    provider = args[++i].toLowerCase();
  } else if (args[i] === '--key' || args[i] === '-k') {
    apiKey = args[++i];
  }
}

// Interactive helper
const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
};

async function start() {
  log.header("HIERARCHICAL RESEARCH ORCHESTRATOR");

  const isInteractive = !industry && !context;
  let activeTree = null;

  if (isInteractive) {
    console.log(`${colors.dim}No inputs provided. Entering interactive setup...${colors.reset}\n`);
    
    console.log(`${colors.bold}Choose a Hierarchical Industry Preset:${colors.reset}`);
    console.log(" 1) Solar Energy (US) - 4 Agents (Levels 0-3)");
    console.log(" 2) AgriTech (India) - 3 Agents (Levels 0-2)");
    console.log(" 3) HealthTech (Wearables) - 3 Agents (Levels 0-2)");
    console.log(" 4) [Custom Industry] - Default 2-agent Tree");
    
    const choice = await askQuestion(`${colors.bold}Select option (1-4): ${colors.reset}`);
    
    if (choice === '1') {
      industry = PRESETS.solar.industry;
      context = PRESETS.solar.context;
      activeTree = PRESETS.solar.tree;
    } else if (choice === '2') {
      industry = PRESETS.agritech.industry;
      context = PRESETS.agritech.context;
      activeTree = PRESETS.agritech.tree;
    } else if (choice === '3') {
      industry = PRESETS.healthtech.industry;
      context = PRESETS.healthtech.context;
      activeTree = PRESETS.healthtech.tree;
    } else {
      industry = await askQuestion(`${colors.bold}Enter Industry Name: ${colors.reset}`);
      context = await askQuestion(`${colors.bold}Enter Context / Research Brief:${colors.reset}\n> `);
    }

    if (!industry || !context) {
      log.error("Industry and Context brief are required. Exiting.");
      process.exit(1);
    }

    const provInput = await askQuestion(`\nSelect Provider (1: Gemini, 2: OpenAI, 3: Claude, 4: OpenRouter): `);
    if (provInput === '2') provider = 'openai';
    else if (provInput === '3') provider = 'anthropic';
    else if (provInput === '4') provider = 'openrouter';
    else provider = 'gemini';

    const keyInput = await askQuestion(`Enter ${provider.toUpperCase()} API Key (leave empty for Mock Mode): `);
    if (keyInput) apiKey = keyInput;

    const outputInput = await askQuestion(`Output report filename (default: ${output}): `);
    if (outputInput) output = outputInput;
  } else {
    // Non-interactive preset check
    const matchKey = Object.keys(PRESETS).find(key => 
      industry.toLowerCase().includes(PRESETS[key].industry.split(" ")[0].toLowerCase())
    );
    if (matchKey) {
      activeTree = PRESETS[matchKey].tree;
    }
  }

  // Display summary
  console.log(`\n${colors.bold}Configuration Summary:${colors.reset}`);
  console.log(`- ${colors.bold}Industry:${colors.reset} ${industry}`);
  console.log(`- ${colors.bold}Context:${colors.reset} ${context}`);
  console.log(`- ${colors.bold}API Provider:${colors.reset} ${provider.toUpperCase()}`);
  console.log(`- ${colors.bold}Mode:${colors.reset} ${apiKey ? 'Live API Run' : 'Simulated Mock Run'}`);
  console.log(`- ${colors.bold}Output Path:${colors.reset} ${output}`);

  // Spinner states
  let activeSpinnerMsg = "";
  let spinnerInterval = null;
  let activeAgentName = null;
  let activeAgentLevel = 1;
  let currentLog = "";

  const startSpinner = (msg) => {
    if (spinnerInterval) clearInterval(spinnerInterval);
    activeSpinnerMsg = msg;
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    spinnerInterval = setInterval(() => {
      let indent = "  ".repeat(activeAgentLevel);
      let agentSuffix = activeAgentName ? ` [${colors.yellow}${activeAgentName}${colors.reset} L${activeAgentLevel}]` : "";
      let logSuffix = currentLog ? ` (${colors.dim}${currentLog}${colors.reset})` : "";
      process.stdout.write(`\r\x1b[2K${indent}\x1b[36m${frames[i]}\x1b[0m ${activeSpinnerMsg}${agentSuffix}${logSuffix}`);
      i = (i + 1) % frames.length;
    }, 80);
  };

  const stopSpinner = (msg, success = true) => {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    let indent = "  ".repeat(activeAgentLevel);
    const sym = success ? `${colors.green}✔${colors.reset}` : `${colors.red}✖${colors.reset}`;
    process.stdout.write(`\r\x1b[2K${indent}${sym} ${msg}\n`);
    currentLog = "";
    activeAgentName = null;
  };

  log.header("HIERARCHICAL RUN COMMENCING");

  try {
    const reportText = await runOrchestrator(industry, context, [], {
      apiKey,
      provider,
      activeTree,
      onProgress: (evt) => {
        switch (evt.status) {
          case 'analyzing':
            activeAgentLevel = 0;
            startSpinner(evt.message);
            break;
          case 'objectives_created':
            stopSpinner("Strategic objectives identified by Master Orchestrator.");
            log.section("RESEARCH OBJECTIVES");
            evt.objectives.forEach(obj => console.log(`  • ${obj}`));
            console.log("");
            activeAgentLevel = 0;
            startSpinner("Deploying worker agent sub-levels...");
            break;
          case 'agent_start':
            activeAgentName = evt.agentName;
            activeAgentLevel = evt.brief.level || 1;
            startSpinner(`Starting agent research...`);
            break;
          case 'agent_log':
            activeAgentName = evt.agentName;
            currentLog = evt.log;
            break;
          case 'agent_complete':
            activeAgentLevel = evt.report.level || 1;
            stopSpinner(`Agent ${colors.bold}${evt.agentName}${colors.reset} finished (Level ${activeAgentLevel}).`);
            break;
          case 'synthesizing':
            activeAgentLevel = 0;
            startSpinner(evt.message);
            break;
          case 'complete':
            activeAgentLevel = 0;
            stopSpinner("Synthesis of hierarchical findings finalized.");
            break;
        }
      }
    });

    // Write output report
    const outputPath = path.resolve(process.cwd(), output);
    fs.writeFileSync(outputPath, reportText, 'utf8');

    log.header("RESEARCH REPORT OUTPUT SUCCESS");
    log.success(`Unified Markdown Report compiled to: ${colors.bold}${outputPath}${colors.reset}\n`);

    // Output sample
    console.log(`${colors.dim}Previewing first 20 lines of the report:${colors.reset}\n`);
    console.log(reportText.split('\n').slice(0, 20).join('\n'));
    console.log(`\n${colors.dim}...[Remainder of report written to file]...${colors.reset}\n`);

  } catch (error) {
    if (spinnerInterval) stopSpinner("Error during orchestration", false);
    log.error(`Orchestrator crashed: ${error.message}`);
    process.exit(1);
  }
}

start();
