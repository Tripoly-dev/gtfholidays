const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MODEL = 'claude-sonnet-4-5-20250929';
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) { reject(new Error('Use a card image smaller than 8 MB')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Claude API is not configured' });
  try {
    const image = await readBody(req);
    if (!image.length) return res.status(400).json({ error: 'Select a business-card image first' });
    const mediaType = req.headers['content-type'] || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) return res.status(400).json({ error: 'Use a JPEG, PNG, WebP, or GIF image' });
    const prompt = 'Read this business card. Return only one valid JSON object with exactly these string keys: name, title, company, phone, email, website, address, raw_ocr. Use empty strings when a field is absent. Do not infer facts that are not visible. Preserve phone numbers and email addresses exactly when readable.';
    const claude = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } }, { type: 'text', text: prompt }] }] }) });
    if (!claude.ok) { const detail = await claude.json().catch(() => ({})); return res.status(502).json({ error: detail?.error?.message || 'Claude extraction request failed' }); }
    const result = await claude.json();
    const text = result?.content?.find((item) => item.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    return res.status(200).json(JSON.parse(match ? match[0] : text));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process image';
    return res.status(message === 'Use a card image smaller than 8 MB' ? 400 : 502).json({ error: message });
  }
};
module.exports.config = { api: { bodyParser: false } };
