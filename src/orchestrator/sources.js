/**
 * Source-agent adapters (Phase 2).
 *
 * Each research agent now has a `source` (web, google, instagram, reddit,
 * facebook, youtube, website). The adapter for that source decides HOW the
 * agent retrieves evidence:
 *   - which domains the search is restricted to,
 *   - how the agent's queries are rewritten before searching (e.g. advanced
 *     Google operators, or platform-scoped phrasing),
 *   - which retrieval backend is used.
 *
 * Today every adapter runs on the single Tavily key the app already stores —
 * platform agents simply restrict Tavily to that platform's domain, which
 * genuinely differentiates the sources without requiring a separate API key
 * per platform. Native connectors (YouTube Data API, Reddit API, Apify for
 * Instagram, Playwright for site scraping) can be slotted into ADAPTERS later
 * without touching the engine — the engine only calls gatherEvidenceForSource().
 */

import { searchOnce } from './research.js';

/**
 * Per-source profile: the platform domains to scope to, a human label, and a
 * query transformer that reshapes the agent's queries for that source.
 */
export const SOURCE_PROFILES = {
  web: {
    label: 'Open Web',
    domains: [],
    transform: (q) => q
  },
  google: {
    label: 'Google Advanced Search',
    domains: [],
    // Encourage precise retrieval with quoted phrases for multi-word queries.
    transform: (q) => (/\s/.test(q) && !q.includes('"') ? `"${q}"` : q)
  },
  instagram: {
    label: 'Instagram',
    domains: ['instagram.com'],
    transform: (q) => `${q} instagram profile OR reel OR post`
  },
  reddit: {
    label: 'Reddit',
    domains: ['reddit.com'],
    transform: (q) => `${q} reddit discussion OR review OR recommendation`
  },
  facebook: {
    label: 'Facebook',
    domains: ['facebook.com'],
    transform: (q) => `${q} facebook page OR review`
  },
  youtube: {
    label: 'YouTube',
    domains: ['youtube.com'],
    transform: (q) => `${q} youtube video OR review`
  },
  website: {
    // Scoped to whatever domains the user attached to the agent (allowedDomains).
    label: 'Specific Websites',
    domains: [],
    transform: (q) => q
  }
};

/**
 * Resolve the effective profile for a node's source, defaulting to open web.
 */
export function getSourceProfile(source) {
  return SOURCE_PROFILES[source] || SOURCE_PROFILES.web;
}

/**
 * Retrieve evidence for one agent, routed through its source adapter.
 *
 * @param {string}   source         agent.source (web|google|instagram|...)
 * @param {string[]} queries        the agent's generated search queries
 * @param {string[]} allowedDomains domains attached to the agent in the UI
 * @param {string}   tavilyKey      Tavily API key (required for real retrieval)
 * @param {Function} onLog          progress logger
 * @returns {Promise<Array<{title,url,content,source}>>}
 */
export async function gatherEvidenceForSource(source, queries, allowedDomains, tavilyKey, onLog = () => {}) {
  const profile = getSourceProfile(source);

  // Platform sources force their own domain; the `website` source uses the
  // user-supplied allowedDomains; open web/google use allowedDomains if any.
  const scopeDomains =
    profile.domains.length > 0
      ? profile.domains
      : (Array.isArray(allowedDomains) ? allowedDomains : []);

  const seen = new Set();
  const evidence = [];

  onLog(`Source: ${profile.label}${scopeDomains.length ? ` [restricted to ${scopeDomains.join(', ')}]` : ' [open web]'}`);

  for (const rawQuery of queries) {
    const query = profile.transform(rawQuery);
    onLog(`Searching: "${query}"`);

    let results = [];
    try {
      results = await searchOnce(query, scopeDomains, tavilyKey);
    } catch (err) {
      onLog(`Search error for "${query}": ${err.message}`);
      continue;
    }

    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      evidence.push({ ...r, source: profile.label });
    }
  }

  onLog(`Collected ${evidence.length} unique sources from ${profile.label}.`);
  return evidence;
}
