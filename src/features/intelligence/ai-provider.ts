import 'server-only';

export interface SummaryContext {
  profile: Record<string, string | undefined>;
  reports: Array<{ name: string; date: string; type: string; status: string }>;
  observations: Array<{ test: string; value: string; unit?: string; range?: string; confidence: string; source: string }>;
  uncertainties: string[];
}

export interface SafeSummary { overview: string; observations: string[]; uncertainties: string[]; sources: string[] }

export interface AIProvider { summarize(context: SummaryContext): Promise<SafeSummary> }

const forbidden = /\b(diagnos(?:e|is|ed|ing)|disease|prognosis|treat(?:ment|ment plan)?|prescri(?:be|ption)|increase|decrease|change|stop|start|take|dosage|dose)\b/i;

function safeSummary(value: unknown, context: SummaryContext): SafeSummary {
  const parsed = value as Partial<SafeSummary>;
  const fields = [parsed.overview, ...(parsed.observations ?? []), ...(parsed.uncertainties ?? [])];
  if (!fields.every(item => typeof item === 'string' && item.length <= 1200 && !forbidden.test(item))) throw new Error('The generated explanation did not pass the safety review.');
  const sources = (parsed.sources ?? []).filter((item): item is string => typeof item === 'string' && context.reports.some(report => report.name === item));
  return { overview: parsed.overview || 'No summary is available yet.', observations: parsed.observations ?? [], uncertainties: parsed.uncertainties ?? context.uncertainties, sources };
}

export class GeminiProvider implements AIProvider {
  async summarize(context: SummaryContext): Promise<SafeSummary> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('AI summary is not configured.');
    const prompt = `You are an informational summarizer, not a medical professional. Use only the supplied context. Return JSON with exactly overview (string), observations (string[]), uncertainties (string[]), sources (string[]). Do not diagnose, recommend treatment or medication actions, give dosage instructions, invent facts or ranges, or imply clinical certainty. Mention that this is informational and human review matters.\nCONTEXT:${JSON.stringify(context)}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }), cache: 'no-store' });
    if (!response.ok) throw new Error('AI summary service is temporarily unavailable.');
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('AI summary returned no usable content.');
    try { return safeSummary(JSON.parse(text), context); } catch { throw new Error('The generated explanation did not pass the safety review.'); }
  }
}

export function fallbackSummary(context: SummaryContext): SafeSummary {
  return { overview: `This informational view contains ${context.observations.length} extracted observation(s) from ${context.reports.length} source report(s). It is not a diagnosis or treatment plan.`, observations: context.observations.slice(0, 12).map(item => `${item.test}: ${item.value}${item.unit ? ` ${item.unit}` : ''}${item.range ? ` (source range: ${item.range})` : ''}.`), uncertainties: context.uncertainties, sources: context.reports.map(item => item.name) };
}
