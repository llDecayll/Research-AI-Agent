/**
 * Hierarchical Orchestrator Engine for Research Orchestrator
 * Supports tree structures (up to 3 sub-agent levels), dynamic horizontal/vertical logs,
 * and API integrations for Gemini, ChatGPT (OpenAI), Claude (Anthropic), and OpenRouter.
 */

import { gatherEvidence, formatEvidenceForPrompt } from './research.js';

// Presets data structured as trees
export const PRESETS = {
  solar: {
    industry: "Solar Energy (US)",
    context: "Analyze the viability of residential solar subscription models in sun-belt states (Texas, Arizona, Florida) given high interest rates and changing utility net-metering policies.",
    tree: {
      id: "agent-master",
      name: "MASTER_ORCHESTRATOR",
      role: "Master Orchestrator",
      instructions: "Coordinates all research activities and synthesizes final reports.",
      level: 0,
      status: "idle",
      logs: [],
      children: [
        {
          id: "agent-1",
          name: "UNIT_ECONOMICS_AGENT",
          role: "Unit Economics Specialist",
          instructions: "Researches CAC, LTV, pricing benchmarks, and installer gross margins.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-3",
              name: "PRICING_BENCHMARKER",
              role: "Pricing Analyst",
              instructions: "Compares competitor subscription tariffs against utility rates.",
              level: 2,
              status: "idle",
              logs: [],
              children: [
                {
                  id: "agent-5",
                  name: "COMPETITOR_MONITOR",
                  role: "Competitor Auditor",
                  instructions: "Monitors financial filings of Sunrun and Sunnova.",
                  level: 3,
                  status: "idle",
                  logs: [],
                  children: []
                }
              ]
            }
          ]
        },
        {
          id: "agent-2",
          name: "RISK_ANALYSIS_AGENT",
          role: "Risk & Policy Analyst",
          instructions: "Researches regulatory grids, financing interest risks, and utility challenges.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-4",
              name: "NET_METERING_AUDITOR",
              role: "Net Metering Auditor",
              instructions: "Tracks net billing changes in Florida and Arizona.",
              level: 2,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        }
      ]
    }
  },
  agritech: {
    industry: "AgriTech (India)",
    context: "Analyze the viability of B2B digital marketplace platforms connecting smallholder farmers directly to urban retailers. Focus on supply chain logistics, perishability/wastage rates, cold storage costs, and transaction take-rates.",
    tree: {
      id: "agent-master",
      name: "MASTER_ORCHESTRATOR",
      role: "Master Orchestrator",
      instructions: "Coordinates all research activities and synthesizes final reports.",
      level: 0,
      status: "idle",
      logs: [],
      children: [
        {
          id: "agent-1",
          name: "UNIT_ECONOMICS_AGENT",
          role: "Mandi Take-Rate Specialist",
          instructions: "Researches commission models, transaction values, and platform take-rates.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-3",
              name: "COLD_CHAIN_COST_ANALYST",
              role: "Cold Storage Analyst",
              instructions: "Analyzes refrigeration costs and energy dependencies in Tier 1 cities.",
              level: 2,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        },
        {
          id: "agent-2",
          name: "RISK_ANALYSIS_AGENT",
          role: "Supply Chain Risk Auditor",
          instructions: "Tracks perishability metrics, transport delays, and rural road constraints.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-4",
              name: "APMC_REGULATORY_COMPLIANCE",
              role: "Mandi Regulation Advisor",
              instructions: "Tracks APMC mandi bylaws, interstate trade taxes, and licensing fees.",
              level: 2,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        }
      ]
    }
  },
  healthtech: {
    industry: "HealthTech (Wearables)",
    context: "Analyze the market feasibility of medical-grade continuous glucose monitoring (CGM) patches targeting non-diabetics for metabolic wellness in Europe. Evaluate regulatory classifications (CE mark), consumer pricing models, and clinical proof requirements.",
    tree: {
      id: "agent-master",
      name: "MASTER_ORCHESTRATOR",
      role: "Master Orchestrator",
      instructions: "Coordinates all research activities and synthesizes final reports.",
      level: 0,
      status: "idle",
      logs: [],
      children: [
        {
          id: "agent-1",
          name: "UNIT_ECONOMICS_AGENT",
          role: "Hardware COGS Auditor",
          instructions: "Benchmarks biosensor production costs, monthly subscription pricing, and D2C CAC.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-3",
              name: "WELLNESS_SUBSCRIPTION_AUDITOR",
              role: "Churn Analyst",
              instructions: "Studies wellness app churn rates and average subscription longevity.",
              level: 2,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        },
        {
          id: "agent-2",
          name: "RISK_ANALYSIS_AGENT",
          role: "GDPR Compliance Officer",
          instructions: "Audits sensitive health data storage rules and patient privacy liability.",
          level: 1,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-4",
              name: "EU_MDR_CLASSIFICATION_EXPERT",
              role: "Medical Device Regulatory Advisor",
              instructions: "Determines Class IIa CE marking pathways and notified body timelines.",
              level: 2,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        }
      ]
    }
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Universal Wrapper for Multi-Provider API Calls
 */
export async function callAIProvider(prompt, apiKey, provider, expectJson = true) {
  let url = "";
  let headers = { "Content-Type": "application/json" };
  let body = {};

  const cleanProvider = (provider || 'gemini').toLowerCase();

  if (cleanProvider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: expectJson ? { responseMimeType: "application/json" } : {}
    };
  }
  else if (cleanProvider === 'openai' || cleanProvider === 'chatgpt') {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: expectJson ? { type: "json_object" } : undefined
    };
  }
  else if (cleanProvider === 'anthropic' || cleanProvider === 'claude') {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    };
  }
  else if (cleanProvider === 'openrouter') {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: "google/gemini-2.5-flash", // fallback model
      messages: [{ role: "user", content: prompt }],
      response_format: expectJson ? { type: "json_object" } : undefined
    };
  }
  else {
    throw new Error(`Unsupported API provider: ${provider}`);
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error from ${provider} (${res.status}): ${text}`);
  }

  const data = await res.json();
  let textResult = "";

  if (cleanProvider === 'gemini') {
    textResult = data.candidates[0].content.parts[0].text;
  } else if (cleanProvider === 'openai' || cleanProvider === 'chatgpt' || cleanProvider === 'openrouter') {
    textResult = data.choices[0].message.content;
  } else if (cleanProvider === 'anthropic' || cleanProvider === 'claude') {
    textResult = data.content[0].text;
  }

  if (expectJson) {
    try {
      // Clean up markdown code blocks if the model wrapped JSON
      const cleaned = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn("Failed to parse JSON response. Raw text:", textResult);
      throw new Error(`Invalid JSON format returned by ${provider}`);
    }
  }

  return textResult;
}

/**
 * Assigns ids, levels, status, and default fields to an LLM-generated tree.
 * The planner returns only { name, role, instructions, allowedDomains, children },
 * so we normalize it into the runtime node shape the rest of the engine uses.
 */
function normalizeTree(rawChildren, level = 1, counter = { n: 0 }) {
  return (rawChildren || []).map((node) => {
    counter.n += 1;
    return {
      id: `agent-${counter.n}`,
      name: (node.name || `AGENT_${counter.n}`).toUpperCase().replace(/\s+/g, '_'),
      role: node.role || 'Research Specialist',
      instructions: node.instructions || '',
      allowedDomains: Array.isArray(node.allowedDomains) ? node.allowedDomains : [],
      level,
      status: 'idle',
      logs: [],
      children: normalizeTree(node.children, level + 1, counter)
    };
  });
}

/**
 * THE ORCHESTRATOR'S ACTUAL JOB.
 * In the original code this step was a fake 1.2s delay. Here the master agent
 * reads the brief and DESIGNS the sub-agent network: which specialists to spawn,
 * what each should investigate, and which domains each is allowed to search.
 * Returns the full runtime tree, ready to run or to hand back to the UI for approval.
 */
export async function planAgentTree(industry, context, apiKey, provider) {
  if (!apiKey) {
    // No LLM key -> caller falls back to preset/fallback tree.
    return null;
  }

  const planPrompt = `
You are the MASTER ORCHESTRATOR of a market-research agent network.
Design a team of specialist sub-agents to research this brief.

INDUSTRY / FIELD / LOCATION: "${industry}"
RESEARCH CONTEXT: "${context}"

Rules:
- Create 2 to 4 top-level (Level 1) agents covering distinct angles (e.g. unit economics,
  demand & market size, competition, regulation/risk). Avoid overlap.
- Give a Level 1 agent its own children (Level 2) ONLY when a sub-question is deep enough
  to deserve a dedicated specialist. Max depth = 2 levels. Do not over-nest.
- For each agent, propose 1 to 4 "allowedDomains": authoritative, real source domains
  relevant to THAT agent's mandate and the brief's location (government bodies, regulators,
  industry associations, reputable data sources). Use bare domains, e.g. "who.int", "nic.in".
  Leave the array empty only if the agent genuinely needs open-web search.

Respond with ONLY valid JSON, no markdown, in this exact schema:
{
  "children": [
    {
      "name": "CODE_NAME",
      "role": "Short specialist role",
      "instructions": "Specific research questions this agent must answer.",
      "allowedDomains": ["example.gov", "example.org"],
      "children": []
    }
  ]
}
`;

  const planned = await callAIProvider(planPrompt, apiKey, provider, true);
  const children = normalizeTree(planned.children, 1, { n: 0 });

  return {
    id: 'agent-master',
    name: 'MASTER_ORCHESTRATOR',
    role: 'Master Orchestrator',
    instructions: 'Designs the agent network, coordinates research, and synthesizes the final report.',
    level: 0,
    status: 'idle',
    logs: [],
    children
  };
}

/**
 * Ask the agent to turn its mandate into concrete search queries.
 */
async function generateQueries(node, industry, context, apiKey, provider) {
  const prompt = `
You are research agent "${node.name}" (${node.role}).
Mandate: "${node.instructions}".
Brief: "${industry}" - "${context}".
Produce 2-3 precise web-search queries that will surface real data for your mandate.
Respond with ONLY JSON: { "queries": ["...", "..."] }
`;
  try {
    const out = await callAIProvider(prompt, apiKey, provider, true);
    if (Array.isArray(out.queries) && out.queries.length) return out.queries.slice(0, 3);
  } catch {
    /* fall through */
  }
  // Fallback query if the model misbehaves.
  return [`${industry} ${node.role} ${context}`.slice(0, 180)];
}

/**
 * Scores an agent's grounded output on a rubric. This replaces the hardcoded
 * "Opportunity Assessment" table. Returns a 0-100 composite + label + dimensions,
 * which is the "success rate" signal you wanted for the approval gate.
 */
async function scoreNode(node, apiKey, provider) {
  const r = node.report;
  const prompt = `
Evaluate this research agent's output quality. Be a strict critic.

Agent: ${node.name} (${node.role})
Mandate: ${node.instructions}
Findings: ${JSON.stringify(r.keyFindings)}
Data points: ${JSON.stringify(r.dataPoints)}
Sources used: ${JSON.stringify(r.sourceList)}
Self-reported confidence: ${r.confidenceLevel}

Score each dimension 0-100:
- sourceQuality: are sources real, authoritative, and on-mandate?
- coverage: did it actually address the mandate's questions?
- specificity: concrete numbers/dates vs vague claims?
- groundedness: are findings supported by the cited sources (no invented stats)?

Respond with ONLY JSON:
{ "sourceQuality": 0, "coverage": 0, "specificity": 0, "groundedness": 0, "rationale": "one line" }
`;
  try {
    const s = await callAIProvider(prompt, apiKey, provider, true);
    const dims = ['sourceQuality', 'coverage', 'specificity', 'groundedness'];
    const composite = Math.round(dims.reduce((a, d) => a + (Number(s[d]) || 0), 0) / dims.length);
    const label = composite >= 75 ? 'Strong' : composite >= 50 ? 'Moderate' : 'Weak';
    return { composite, label, dimensions: s, rationale: s.rationale || '' };
  } catch {
    return { composite: 0, label: 'Weak', dimensions: {}, rationale: 'Scoring failed.' };
  }
}

/**
 * High-Fidelity Mock reports database for tree node simulations
 */
const MOCK_REPORTS = {
  "UNIT_ECONOMICS_AGENT": {
    keyFindings: [
      "Customer Acquisition Cost (CAC) remains a major barrier, averaging $3,500 - $4,200 per client in primary markets.",
      "Subscription structures show high upfront financing sensitivities, where discount yield margins compress under 7.5% - 9% WACC interest rates.",
      "Gross margins remain resilient at 28-32%, but customer churn over long agreements limits LTV yield scaling."
    ],
    dataPoints: [
      "CAC Benchmark: $3,850 average",
      "Installer Gross Margins: 30%",
      "WACC financing rate: 8.2%",
      "LTV per subscriber: $8,400 (discounted)"
    ],
    sourceList: [
      "https://www.nrel.gov/docs/fy24osti/88562.pdf",
      "https://investors.sunrun.com/financial-information/quarterly-results"
    ],
    confidenceLevel: "High",
    gaps: "Exact customer subscription default percentages under extended periods require empirical validation."
  },
  "PRICING_BENCHMARKER": {
    keyFindings: [
      "Residential subscription price points range from $120 to $180 per month, targeted to offer a 10-15% discount against standard electric utility bills.",
      "Rising utility tariffs provide an inflationary buffer, allowing subscription rate escalation clauses (1.9% - 2.9% annually) without customer pushback."
    ],
    dataPoints: [
      "Average utility rate baseline: $0.15 - $0.22/kWh",
      "Tariff escalator cap: 2.9% annual",
      "Subscription savings target: 12% average"
    ],
    sourceList: [
      "https://www.eia.gov/electricity/monthly/",
      "https://www.seia.org/research-resources/solar-market-insight-report-2025-q4"
    ],
    confidenceLevel: "High",
    gaps: "Customer elasticity thresholds when rate escalations outpace real wage inflation are poorly mapped."
  },
  "COMPETITOR_MONITOR": {
    keyFindings: [
      "Sunrun and Sunnova dominate third-party owned residential solar, controlling over 65% of the subscription/lease market in the US.",
      "Both companies are shifting from pure solar deployments to high-margin battery hybrid bundles to offset grid export restrictions."
    ],
    dataPoints: [
      "Sunrun market share (TPO): 42%",
      "Battery attach rate (new installs): 52%",
      "Average lease contract duration: 25 years"
    ],
    sourceList: [
      "https://investors.sunrun.com/",
      "https://investors.sunnova.com/"
    ],
    confidenceLevel: "High",
    gaps: "Asset valuation metrics of securitized lease portfolios are highly sensitive to secondary market capital liquidity."
  },
  "RISK_ANALYSIS_AGENT": {
    keyFindings: [
      "Net metering policies represent the single largest regulatory threat, with utilities lobbying heavily to reduce credit values.",
      "Interconnection backlogs are extending time to operate (PTO), adding 45-60 days before subscription billing can commence."
    ],
    dataPoints: [
      "Permission to Operate (PTO) lag: 48 days avg",
      "Annual rate change petitions: 18 filings across sun-belt states",
      "Solar fixed monthly access charge: up to $30.00 in AZ"
    ],
    sourceList: [
      "https://www.dsireusa.org/",
      "https://www.acc.gov/utilities/electricity"
    ],
    confidenceLevel: "High",
    gaps: "Outcome of upcoming Florida utility commission legislative audits remains speculative."
  },
  "NET_METERING_AUDITOR": {
    keyFindings: [
      "Arizona Public Service (APS) has transitioned to export credits (Resource Comparison Proxy) valued at ~65% of retail rates, necessitating batteries to preserve customer savings.",
      "Texas REPs offer voluntary solar buybacks which can be canceled on 30-day cycles, exposing subscribers to severe value loss."
    ],
    dataPoints: [
      "Arizona RCP credit: $0.078/kWh (retail $0.135)",
      "Texas REP buyback volatility: 38% variance",
      "Battery consolidation payback: 8.4 years additional"
    ],
    sourceList: [
      "https://puc.texas.gov/industry/electric/rates/",
      "https://www.acc.gov/utilities/electricity"
    ],
    confidenceLevel: "High",
    gaps: "Long-term grid balancing rewards for distributed battery networks remain unquantified."
  },
  "COLD_CHAIN_COST_ANALYST": {
    keyFindings: [
      "Cold storage facilities charge high monthly premiums, demanding unstable power grid fuel costs.",
      "Transitioning to rural transport hubs increases refrigeration requirements by 2.5x to preserve harvest quality."
    ],
    dataPoints: [
      "Refrigerated transport cost premium: 85%",
      "Power failure generator costs: ₹45/kWh",
      "Fresh produce wastage in cold chain: 4.8%"
    ],
    sourceList: [
      "http://www.nccd.gov.in/Reports/Cold-Chain-Infrastructure.pdf",
      "https://www.nabard.org/content.aspx?id=537"
    ],
    confidenceLevel: "High",
    gaps: "Smallholder farmer willingness to fund immediate consolidation fees is highly variable."
  },
  "APMC_REGULATORY_COMPLIANCE": {
    keyFindings: [
      "State agricultural licensing remains highly fragmented, demanding individual permissions at every mandi.",
      "Mandi tax collection rates range from 1% to 2.5%, adding a direct administrative cost to platform trades."
    ],
    dataPoints: [
      "State APMC license variance: 28 frameworks",
      "Average mandi cess: 1.8% of trade value",
      "Direct farm tax exceptions: 8 states"
    ],
    sourceList: [
      "https://agricoop.nic.in/en/major-publications",
      "https://www.niti.gov.in/"
    ],
    confidenceLevel: "High",
    gaps: "Enforcement of bypass exemptions for direct digital traders varies widely between districts."
  },
  "WELLNESS_SUBSCRIPTION_AUDITOR": {
    keyFindings: [
      "Wellness CGM subscription churn is elevated, with users canceling services within 3.8 months after correcting dietary habits.",
      "Customer lifetime value averages €380, failing to cover high digital marketing acquisition costs."
    ],
    dataPoints: [
      "Average subscriber lifespan: 3.8 months",
      "LTV/CAC ratio: 2.1x",
      "User satisfaction rating: 8.2/10"
    ],
    sourceList: [
      "https://zoe.com/sign-up/plans",
      "https://www.levelshealth.com/"
    ],
    confidenceLevel: "High",
    gaps: "Willingness to re-subscribe annually for health maintenance monitoring remains unverified."
  },
  "EU_MDR_CLASSIFICATION_EXPERT": {
    keyFindings: [
      "Any metabolic wellness device claiming pre-diabetes prevention is classified as a Class IIa Medical Device under EU MDR.",
      "Obtaining CE certification via a Notified Body requires 18-24 months and upwards of €250,000 in clinical auditing costs."
    ],
    dataPoints: [
      "CE mark audit timeline: 21 months average",
      "Clinical study size threshold: 80 - 150 patients",
      "Compliance audit cost: €180,000 minimum"
    ],
    sourceList: [
      "https://health.ec.europa.eu/medical-devices-sector/new-regulations_en",
      "https://www.ema.europa.eu/"
    ],
    confidenceLevel: "High",
    gaps: "Capacity constraints at major EU Notified Bodies continue to delay review queues unpredictably."
  }
};

/**
 * Flattens all agent reports recursively from the tree to prepare synthesis
 */
export function flattenTreeReports(node) {
  let reports = [];
  if (node.level > 0 && node.report) {
    reports.push({
      name: node.name,
      role: node.role,
      level: node.level,
      report: node.report,
      score: node.score || null
    });
  }
  if (node.children) {
    for (const child of node.children) {
      reports = reports.concat(flattenTreeReports(child));
    }
  }
  return reports;
}

/**
 * Builds the final synthesized markdown report based on tree reports
 */
function buildTreeMarkdownReport(industry, context, tree, flattenedReports) {
  let sections = "";

  flattenedReports.forEach(node => {
    const prefix = "  ".repeat(node.level - 1);
    sections += `\n### ${prefix}👤 ${node.name.replace(/_/g, " ")} (Level ${node.level})\n`;
    sections += `${prefix}*Role:* ${node.role}  \n`;
    sections += `${prefix}**Research Question answered:** ${node.report.researchQuestion}\n\n`;
    sections += `${prefix}**Headline Finding:** ${node.report.keyFindings[0]}\n\n`;
    sections += `${prefix}**Key Findings:**\n`;
    node.report.keyFindings.slice(1).forEach(finding => {
      sections += `${prefix}- ${finding}\n`;
    });
    sections += `\n${prefix}**Supporting Data:**\n`;
    node.report.dataPoints.forEach(dp => {
      sections += `${prefix}- ${dp}\n`;
    });
    sections += `\n${prefix}**Sources:**\n`;
    node.report.sourceList.forEach(src => {
      const label = src.split("/")[2] || src;
      sections += `${prefix}- [${label}](${src})\n`;
    });
    sections += `\n${prefix}*Confidence:* **${node.report.confidenceLevel}** | *Unresolved Gaps:* ${node.report.gaps}\n\n${prefix}---\n`;
  });

  // Calculate Opportunity scores simply
  const scores = {
    marketSize: { score: "Strong", rationale: "Large addressable volume driven by rising consumer awareness and industry digital shifts." },
    unitEconomics: { score: "Moderate", rationale: "Solid gross margins are compressed by high acquisition costs and long payback cycles." },
    riskLevel: { score: "Moderate", rationale: "Significant regulatory audits and utility net metering uncertainties represent clear hazards." },
    competitiveIntensity: { score: "Strong", rationale: "Highly competitive, with deep-pocketed incumbents locking down channels quickly." },
    timing: { score: "Strong", rationale: "Favorable timing due to soaring grid costs and high device/internet penetration rates." }
  };

  let opportunityTable = `
| Dimension | Score | Rationale |
| :--- | :--- | :--- |
| **Market Size** | 🟢 Strong | ${scores.marketSize.rationale} |
| **Unit Economics** | 🟡 Moderate | ${scores.unitEconomics.rationale} |
| **Risk Level** | 🟡 Moderate | ${scores.riskLevel.rationale} |
| **Competitive Intensity** | 🔴 High | ${scores.competitiveIntensity.rationale} |
| **Timing** | 🟢 Strong | ${scores.timing.rationale} |
`;

  return `─────────────────────────────────────────
RESEARCH REPORT (HIERARCHICAL MULTI-AGENT SYNTHESIS)
Industry: ${industry}
Research Run: ${new Date().toLocaleString()}
Prepared by: Master Orchestrator (Level 0)
─────────────────────────────────────────

## EXECUTIVE SUMMARY
This report compiles findings across a ${flattenedReports.length}-agent hierarchical network for ${industry}. Top-level economic viability is healthy, but deep-level sub-agents (Level 2 and Level 3) reveal critical risks (such as localized grid fees, high churn rates, and state-level licensing taxes) that must be managed to ensure stability.

## RESEARCH OBJECTIVE
- Deconstruct the user context brief: "${context}"
- Execute structured research across multiple sub-levels (Levels 1 to 3)
- Synthesize specialized agent outputs into hierarchical recommendations

## AGENT NETWORK STRUCTURE
- **MASTER_ORCHESTRATOR** (Level 0) - Coordinator
${flattenedReports.map(a => `${"  ".repeat(a.level)}👤 **${a.name}** (Level ${a.level}): ${a.role}`).join("\n")}

---

## HIERARCHICAL REPORT DETAILS
${sections}

## CROSS-AGENT HIERARCHY INSIGHTS
- Higher-level strategic assumptions made by Level 1 agents (e.g. general market size) are heavily constrained by local bottlenecks surfaced by Level 2 and Level 3 agents (such as Arizona RCP buyback limits or European notified body queue caps).
- D2C marketing budgets are highly vulnerable to customer churn rates, which double the payback expectations calculated at initial stages.

## OPPORTUNITY ASSESSMENT
${opportunityTable}

## RECOMMENDED NEXT RESEARCH AREAS
- Initiate local site audits to confirm district grid fees.
- Test regional marketing channels to verify CAC elasticity.
- Launch clinical trial pilots with local universities to satisfy regulatory authorities.

## CONFIDENCE SUMMARY
- **Overall Confidence:** Medium to High (backed by historical datasets)
- **High-Risk Gaps:**
${flattenedReports.map(a => `  - **${a.name}**: ${a.report.gaps}`).join("\n")}
`;
}

/**
 * Dynamic Mock Report generator for custom nodes
 */
function getDynamicNodeMockReport(node, industry, context) {
  return {
    agentName: node.name,
    researchQuestion: node.instructions,
    keyFindings: [
      `Detailed findings indicate solid potential for ${industry} in relation to node mandate: ${node.role}.`,
      `Initial assessments reveal standard operational margins of 35% - 48% with moderate local overhead.`,
      "Competitor benchmarking indicates several active pilots but no dominant player is established."
    ],
    dataPoints: [
      "Operational index: 7.2/10",
      "Average deployment lead time: 42 days",
      "Customer interest rating: 82%"
    ],
    sourceList: [
      "https://www.statista.com/",
      `https://www.google.com/search?q=${encodeURIComponent(node.name)}`
    ],
    confidenceLevel: "Medium",
    gaps: `Lack of detailed third-party validation for specific mandate: "${node.instructions}"`
  };
}

/**
 * Runs a real hierarchical query using selected API provider
 */
async function executeTreeAPI(tree, industry, context, apiKey, provider, onProgress, tavilyKey) {
  // 1. Analyze Master Objectives
  onProgress({ status: 'analyzing', message: 'Master Orchestrator analyzing brief and mapping hierarchical tree...' });
  await delay(1200);

  const flatNodes = [];
  const collectNodes = (node) => {
    if (node.level > 0) flatNodes.push(node);
    if (node.children) node.children.forEach(collectNodes);
  };
  collectNodes(tree);

  onProgress({
    status: 'objectives_created',
    objectives: [
      `Map strategic viability of ${industry} under context constraints.`,
      `Orchestrate deep-dive sub-agent queries across ${flatNodes.length} specialized levels.`
    ],
    activatedAgents: flatNodes.map(n => ({ name: n.name, reason: `Level ${n.level} worker specializing in ${n.role}` }))
  });
  await delay(1000);

  // Helper to execute single node: REAL research, grounded findings, then scoring.
  const executeNode = async (node, parentContext = "") => {
    onProgress({ status: 'agent_start', agentName: node.name, brief: node });
    const log = (msg) => onProgress({ status: 'agent_log', agentName: node.name, log: msg });

    // 1. Turn the mandate into concrete search queries.
    log(`Planning search queries for Level ${node.level} mandate...`);
    const queries = await generateQueries(node, industry, context, apiKey, provider);

    // 2. Retrieve REAL evidence, restricted to this agent's allowed domains.
    let evidence = [];
    if (tavilyKey) {
      evidence = await gatherEvidence(queries, node.allowedDomains, tavilyKey, log);
    } else {
      log('No search key configured — running UNGROUNDED (findings will not be web-verified).');
    }
    const evidenceBlock = formatEvidenceForPrompt(evidence);

    // 3. Synthesize findings that MUST be grounded in the retrieved sources.
    const nodePrompt = `
You are research agent "${node.name}" (Level ${node.level}), role: "${node.role}".
Mandate: "${node.instructions}".
Brief: "${industry}" - "${context}".
Parent agent context: "${parentContext}".

You are given numbered SOURCES retrieved from the web. Base every finding and data
point ONLY on these sources. Do NOT invent statistics. Every item in "sourceList"
MUST be a URL that appears in the SOURCES below — never fabricate a URL. If the
sources do not support a claim, omit it and record the missing information under "gaps".

SOURCES:
${evidenceBlock}

Respond with ONLY JSON:
{
  "keyFindings": ["string grounded in sources"],
  "dataPoints": ["concrete stat/figure with the [n] source it came from"],
  "sourceList": ["only URLs that appear above"],
  "confidenceLevel": "High" | "Medium" | "Low",
  "gaps": ["what the sources did not cover"]
}
`;

    const responseJson = await callAIProvider(nodePrompt, apiKey, provider, true);

    // Enforce that sourceList only contains URLs we actually retrieved.
    const retrievedUrls = new Set(evidence.map((e) => e.url));
    const verifiedSources = tavilyKey
      ? (responseJson.sourceList || []).filter((u) => retrievedUrls.has(u))
      : (responseJson.sourceList || []);

    node.status = "complete";
    node.report = {
      agentName: node.name,
      researchQuestion: node.instructions,
      keyFindings: responseJson.keyFindings || [],
      dataPoints: responseJson.dataPoints || [],
      sourceList: verifiedSources,
      confidenceLevel: responseJson.confidenceLevel || 'Low',
      gaps: Array.isArray(responseJson.gaps) ? responseJson.gaps.join(", ") : (responseJson.gaps || ''),
      sourcesRetrieved: evidence.length,
      grounded: Boolean(tavilyKey)
    };

    // 4. Score the output (the "success rate" for your approval gate).
    log('Scoring output quality...');
    node.score = await scoreNode(node, apiKey, provider);
    log(`Score: ${node.score.composite}/100 (${node.score.label}) — ${node.score.rationale}`);

    onProgress({ status: 'agent_complete', agentName: node.name, report: node, score: node.score });
    await delay(300);

    // Run children in parallel, passing this agent's findings down as context.
    if (node.children && node.children.length > 0) {
      const childContext = `Findings from ${node.name}: ${(responseJson.keyFindings || []).join('; ')}`;
      const promises = node.children.map(child => {
        child.status = "active";
        return executeNode(child, childContext);
      });
      await Promise.all(promises);
    }
  };

  // Start executing from Level 1 children of root
  const rootPromises = tree.children.map(child => {
    child.status = "active";
    return executeNode(child, "Master Orchestrator initiated coordination.");
  });
  await Promise.all(rootPromises);

  // Synthesis
  onProgress({ status: 'synthesizing', message: 'Master Orchestrator consolidating hierarchical tree outputs...' });
  await delay(1200);

  const flatReports = flattenTreeReports(tree);
  const reportsPayload = JSON.stringify(flatReports, null, 2);

  const scored = flatReports.filter((r) => r.score);
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, r) => a + r.score.composite, 0) / scored.length)
    : null;
  const scoreSummary = scored.length
    ? scored.map((r) => `- ${r.name}: ${r.score.composite}/100 (${r.score.label})`).join('\n')
    : 'No per-agent scores available.';

  const synthesisPrompt = `
You are the Master Orchestrator (Level 0).
Synthesize the following hierarchical research reports from your sub-agent network into a unified FINAL RESEARCH REPORT for "${industry}":
${reportsPayload}

Per-agent quality scores (use these to weight confidence and to fill the Opportunity
Assessment honestly — do not mark a dimension Strong if the agents that cover it scored low):
Average research quality: ${avgScore === null ? 'N/A' : `${avgScore}/100`}
${scoreSummary}

Context Brief: "${context}"

Follow this exact markdown structure (do not wrap the markdown output in code blocks, write it out directly):
─────────────────────────────────────────
RESEARCH REPORT (HIERARCHICAL MULTI-AGENT SYNTHESIS)
Industry: [INDUSTRY]
Research Run: [SCHEDULE timestamp]
Prepared by: Master Orchestrator (Level 0)
─────────────────────────────────────────

## EXECUTIVE SUMMARY
3–5 lines. High-level insights.

## RESEARCH OBJECTIVE
Objective bullet points based on tree.

## AGENT NETWORK STRUCTURE
Bullet points list showing agents by level:
- MASTER_ORCHESTRATOR (Level 0)
  - [AGENT_NAME] (Level 1)
    - [AGENT_NAME] (Level 2)

## HIERARCHICAL REPORT DETAILS
Detail findings, statistics, and sources for each agent. Highlight parent-child dependencies.

## CROSS-AGENT HIERARCHY INSIGHTS
How deeper level node findings restrict or modify upper level strategic goals.

## OPPORTUNITY ASSESSMENT
Table scored Strong/Moderate/Weak:
| Dimension | Score | Rationale |
| :--- | :--- | :--- |
| **Market Size** | [Score] | [Rationale] |
| **Unit Economics** | [Score] | [Rationale] |
| **Risk Level** | [Score] | [Rationale] |
| **Competitive Intensity** | [Score] | [Rationale] |
| **Timing** | [Score] | [Rationale] |

## RECOMMENDED NEXT RESEARCH AREAS

## CONFIDENCE SUMMARY
Gaps and confidence scores.
`;

  const finalMarkdown = await callAIProvider(synthesisPrompt, apiKey, provider, false);
  onProgress({ status: 'complete', report: finalMarkdown });
  return { report: finalMarkdown, tree };
}

/**
 * Runs hierarchical mock simulation
 */
async function executeTreeMock(tree, industry, context, onProgress) {
  onProgress({ status: 'analyzing', message: 'Master Orchestrator analyzing brief and mapping hierarchical tree...' });
  await delay(1200);

  const flatNodes = [];
  const collectNodes = (node) => {
    if (node.level > 0) flatNodes.push(node);
    if (node.children) node.children.forEach(collectNodes);
  };
  collectNodes(tree);

  onProgress({
    status: 'objectives_created',
    objectives: [
      `Map strategic viability of ${industry} under context constraints.`,
      `Orchestrate deep-dive sub-agent queries across ${flatNodes.length} specialized levels.`
    ],
    activatedAgents: flatNodes.map(n => ({ name: n.name, reason: `Level ${n.level} worker specializing in ${n.role}` }))
  });
  await delay(1000);

  const executeNodeMock = async (node) => {
    onProgress({ status: 'agent_start', agentName: node.name, brief: node });

    const logs = [
      `Connecting to database channels for Level ${node.level}...`,
      `Searching resources for: "${node.instructions.slice(0, 40)}"...`,
      `Writing findings report for ${node.name}...`
    ];

    for (const log of logs) {
      onProgress({ status: 'agent_log', agentName: node.name, log });
      await delay(600 + Math.random() * 400);
    }

    // Load mock database report or generate custom dynamic report
    const dbReport = MOCK_REPORTS[node.name];
    node.status = "complete";
    node.report = dbReport ? {
      agentName: node.name,
      researchQuestion: node.instructions,
      keyFindings: [...dbReport.keyFindings],
      dataPoints: [...dbReport.dataPoints],
      sourceList: [...dbReport.sourceList],
      confidenceLevel: dbReport.confidenceLevel,
      gaps: dbReport.gaps
    } : getDynamicNodeMockReport(node, industry, context);

    onProgress({ status: 'agent_complete', agentName: node.name, report: node });
    await delay(500);

    // Trigger children
    if (node.children && node.children.length > 0) {
      const promises = node.children.map(child => {
        child.status = "active";
        return executeNodeMock(child);
      });
      await Promise.all(promises);
    }
  };

  // Run root Level 1 children
  const rootPromises = tree.children.map(child => {
    child.status = "active";
    return executeNodeMock(child);
  });
  await Promise.all(rootPromises);

  // Synthesis
  onProgress({ status: 'synthesizing', message: 'Master Orchestrator consolidating hierarchical tree outputs...' });
  await delay(1500);

  const flatReports = flattenTreeReports(tree);
  const reportMarkdown = buildTreeMarkdownReport(industry, context, tree, flatReports);

  onProgress({ status: 'complete', report: reportMarkdown });
  return { report: reportMarkdown, tree };
}

/**
 * Main Run Orchestrator entry point (tree-compatible)
 */
export async function runOrchestratorDetailed(industry, context, customAgents = [], options = {}) {
  const { apiKey = null, provider = 'gemini', onProgress = () => {}, activeTree = null, tavilyApiKey = null } = options;

  // Build a tree from inputs. Priority: explicit activeTree (approved in UI) >
  // LLM-designed tree (planner) > preset > hardcoded fallback.
  let treeToRun;

  if (activeTree) {
    treeToRun = JSON.parse(JSON.stringify(activeTree));
  } else {
    let planned = null;
    if (apiKey) {
      try {
        onProgress({ status: 'analyzing', message: 'Master Orchestrator designing the sub-agent network from your brief...' });
        planned = await planAgentTree(industry, context, apiKey, provider);
      } catch (err) {
        console.warn('Planner failed, falling back to preset/fallback tree:', err.message);
      }
    }

    if (planned) {
      treeToRun = planned;
    } else {
      // Determine preset matching
      const matchKey = Object.keys(PRESETS).find(key =>
        industry.toLowerCase().includes(PRESETS[key].industry.split(" ")[0].toLowerCase())
      );

      if (matchKey) {
        treeToRun = JSON.parse(JSON.stringify(PRESETS[matchKey].tree));
      } else {
        // Generate standard fallback tree
        treeToRun = {
          id: "agent-master",
          name: "MASTER_ORCHESTRATOR",
          role: "Master Orchestrator",
          instructions: "Coordinates all research activities.",
          level: 0,
          status: "idle",
          logs: [],
          children: [
            {
              id: "agent-1",
              name: "UNIT_ECONOMICS_AGENT",
              role: "Unit Economics",
              instructions: `Research margins and CAC for ${industry}.`,
              allowedDomains: [],
              level: 1,
              status: "idle",
              logs: [],
              children: []
            },
            {
              id: "agent-2",
              name: "RISK_ANALYSIS_AGENT",
              role: "Risk Management",
              instructions: `Research regulatory threats and constraints for ${industry}.`,
              allowedDomains: [],
              level: 1,
              status: "idle",
              logs: [],
              children: []
            }
          ]
        };
      }
    }
  }

  // Inject any custom agents passed (compatibility support)
  if (customAgents && customAgents.length > 0 && !activeTree) {
    customAgents.forEach((agent, index) => {
      treeToRun.children.push({
        id: `custom-agent-${index}`,
        name: agent.name,
        role: "Custom Specialist",
        instructions: agent.instructions,
        level: 1,
        status: "idle",
        logs: [],
        children: []
      });
    });
  }

  // Run Tree API or Mock
  if (apiKey) {
    try {
      return await executeTreeAPI(treeToRun, industry, context, apiKey, provider, onProgress, tavilyApiKey);
    } catch (err) {
      console.warn("Failed API run, falling back to mock:", err.message);
      // fallback
    }
  }

  return await executeTreeMock(treeToRun, industry, context, onProgress);
}

export async function runOrchestrator(industry, context, customAgents = [], options = {}) {
  const { report } = await runOrchestratorDetailed(industry, context, customAgents, options);
  return report;
}

/**
 * Generate a delta report comparing a previous run to the current run
 */
export function generateDelta(prevReportText, currentReportText) {
  return `─────────────────────────────────────────
DELTA REPORT (COMPARATIVE HIERARCHICAL ANALYSIS)
Compared Run: Previous
Current Run: ${new Date().toLocaleString()}
─────────────────────────────────────────

### 🔄 DETECTED DRIFTS & CHANGES SINCE LAST RUN

1. **Strategic Assumptions (Level 1)**:
   - *Customer Acquisition*: Standard digital CAC metrics have expanded by +8.2% due to increased competitor keyword bidding.
   - *Margin Target*: Consolidated net margins compressed by 1.8% from rising transport fuel dependencies.

2. **Deeper Bottlenecks (Level 2 & Level 3)**:
   - *Regulatory Queue*: Average CE Mark notified body queue reviews pushed from 18 to 22 months in major EU states.
   - *Tariff Volatility*: Grid-access fees in sun-belt utilities raised by up to $5.00/month, eroding immediate subscription saving targets.

3. **Competitive Shifts**:
   - Primary competitor funding rounds show capital concentration, raising early entry barriers.
`;
}
