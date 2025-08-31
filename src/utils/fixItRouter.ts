// Centralized mapping from audit recommendations to tools + context
// Keeps routing consistent across dashboard grid and tool modal

export interface FixItRoute {
  toolId: string;
  context?: Record<string, any>;
}

const lower = (s: any) => (typeof s === 'string' ? s.toLowerCase() : '');

const extractDomain = (url: string): string => {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
};

export function mapRecommendationToTool(
  recommendation: any,
  opts?: { selectedWebsite?: string }
): FixItRoute {
  const action = lower(recommendation?.action_type);
  const title = lower(recommendation?.title);
  const desc = lower(recommendation?.description);
  const text = `${title} ${desc}`;

  const selectedWebsite = opts?.selectedWebsite || '';
  const domain = extractDomain(selectedWebsite);

  // 1) Schema / Structured Data (highest priority)
  if (
    action.includes('schema') ||
    text.includes('schema') ||
    text.includes('structured data') ||
    text.includes('json-ld')
  ) {
    return { toolId: 'schema', context: { contentType: 'Article' } };
  }

  // 2) Content optimization / editor (avoid hijacking schema mentions)
  if (
    action.includes('content-optimizer') ||
    action.includes('content') ||
    text.includes('optimiz') ||
    text.includes('readability') ||
    text.includes('structure') ||
    text.includes('heading') ||
    (text.includes('meta') && !text.includes('schema'))
  ) {
    return { toolId: 'editor', context: { url: selectedWebsite, hint: recommendation?.title } };
  }

  // 3) Entities / Topics
  if (action.includes('entity') || text.includes('entity') || text.includes('entities') || text.includes('topic')) {
    return { toolId: 'entities' };
  }

  // 4) Citations / Mentions
  if (action.includes('citation') || text.includes('citation') || text.includes('mention')) {
    return { toolId: 'citations' };
  }

  // 5) Prompts / Conversational
  if (
    action.includes('voice') ||
    text.includes('voice') ||
    text.includes('assistant') ||
    text.includes('conversational') ||
    action.includes('prompt') ||
    text.includes('prompt')
  ) {
    return { toolId: 'prompts', context: domain ? { topic: domain } : {} };
  }

  // 6) Generator (FAQs/snippets/etc.)
  if (action.includes('generate') || text.includes('generate') || text.includes('faq') || text.includes('snippet')) {
    return {
      toolId: 'generator',
      context: {
        topic: recommendation?.title || (domain ? `Content for ${domain}` : 'New content'),
        targetKeywords: ''
      }
    };
  }

  // 8) Fallback to editor
  return { toolId: 'editor', context: { url: selectedWebsite, hint: recommendation?.title } };
}

