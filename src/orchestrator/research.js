/**
 * Real web research layer.
 *
 * This is the piece the original prototype was missing: the sub-agents never
 * actually retrieved anything, so their "findings" and "sources" were
 * hallucinated by the LLM. This module performs live web search (via Tavily)
 * and returns real passages + real URLs that the agent is then forced to
 * ground its findings in.
 *
 * Why Tavily: it is a single search API built for agents — it returns ranked
 * result snippets AND supports `include_domains`, which is exactly how we
 * enforce each sub-agent's "allowed websites" rule. You can swap this for
 * Brave/SerpAPI/Bing by reimplementing webSearch() and keeping the same
 * return shape.
 */

const TAVILY_URL = 'https://api.tavily.com/search';

/**
 * Run a single search, restricted to allowedDomains when provided.
 * Returns a normalized array of { title, url, content }.
 */
export async function searchOnce(query, allowedDomains, tavilyKey, maxResults = 5) {
  const body = {
    api_key: tavilyKey,
    query,
    search_depth: 'advanced',
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false
  };

  if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
    body.include_domains = allowedDomains;
  }

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    content: r.content || ''
  }));
}

/**
 * Run several queries (e.g. the ones the agent generated), dedupe by URL,
 * and return a flat evidence list the agent can cite from.
 */
export async function gatherEvidence(queries, allowedDomains, tavilyKey, onLog = () => {}) {
  const seen = new Set();
  const evidence = [];

  for (const query of queries) {
    onLog(`Searching${allowedDomains?.length ? ` [${allowedDomains.join(', ')}]` : ''}: "${query}"`);
    let results = [];
    try {
      results = await searchOnce(query, allowedDomains, tavilyKey);
    } catch (err) {
      onLog(`Search error for "${query}": ${err.message}`);
      continue;
    }

    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      evidence.push(r);
    }
  }

  onLog(`Collected ${evidence.length} unique sources.`);
  return evidence;
}

/**
 * Compact the evidence into a numbered context block for the LLM prompt.
 * Numbering lets us instruct the model to cite only [n] sources that exist.
 */
export function formatEvidenceForPrompt(evidence) {
  if (!evidence.length) return 'NO SOURCES RETRIEVED.';
  return evidence
    .map((e, i) => `[${i + 1}] ${e.title}\nURL: ${e.url}\nExcerpt: ${e.content}`)
    .join('\n\n');
}
