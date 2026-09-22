const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        reject(new Error('Use a card image smaller than 8 MB'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

module.exports = async function extractBusinessCard(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return response.status(503).json({ error: 'Claude API is not configured' });
  }

  try {
    const image = await readBody(request);
    if (!image.length) return response.status(400).json({ error: 'Select a business-card image first' });

    const mediaType = request.headers['content-type'] || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
      return response.status(400).json({ error: 'Use a JPEG, PNG, WebP, or GIF image' });
    }

    const prompt = 'Read this business card. Return only one valid JSON object with exactly these string keys: name, title, company, phone, email, website, address, raw_ocr. Use empty strings when a field is absent. Do not infer facts that are not visible. Preserve phone numbers and email addresses exactly when readable.';
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!claudeResponse.ok) {
      const detail = await claudeResponse.json().catch(() => ({}));
      return response.status(502).json({ error: detail?.error?.message || 'Claude extraction request failed' });
    }

    const result = await claudeResponse.json();
    const text = result?.content?.find((item) => item.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    return response.status(200).json(JSON.parse(match ? match[0] : text));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process image';
    return response.status(message === 'Use a card image smaller than 8 MB' ? 400 : 502).json({ error: message });
  }
};

module.exports.config = { api: { bodyParser: false } };
