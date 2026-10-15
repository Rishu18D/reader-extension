import { Readability } from '@mozilla/readability';

const STOP_WORDS = new Set([
  'the','is','at','which','on','and','a','an','in','to','of','it','for','as','with',
  'that','this','by','from','be','are','was','were','or','has','had','have','but',
  'not','what','all','were','when','can','said','there','use','each','which','she',
  'do','how','their','if','will','up','other','about','out','many','then','them',
  'these','so','some','her','would','make','like','him','into','time','has','look',
  'two','more','write','go','see','number','no','way','could','people','my','than',
  'first','water','been','call','who','oil','its','now','find','long','down','day',
  'did','get','come','made','may','part'
]);

export function extractArticle() {
  // Clone document to prevent Readability mutations on live DOM
  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article || !article.textContent) {
    const rawText = document.body?.innerText?.trim() || '';
    const keywords = extractKeywords(rawText, 8);
    return {
      title: document.title,
      content: document.body?.innerHTML || '',
      rawText,
      excerpt: '',
      keywords,
      crux: extractCruxSentences(rawText, keywords, 4)
    };
  }

  const rawText = article.textContent;
  const keywords = extractKeywords(rawText, 8);
  const crux = extractCruxSentences(rawText, keywords, 4);

  return {
    title: article.title || document.title,
    byline: article.byline,
    content: article.content,
    rawText: rawText,
    keywords,
    crux
  };
}

function extractKeywords(text, topN = 8) {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};

  words.forEach((w) => {
    if (!STOP_WORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

function extractCruxSentences(text, topKeywords, sentenceCount = 4) {
  // Regex to split into full sentences
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  if (sentences.length <= sentenceCount) return sentences.map(s => s.trim());

  const keywordSet = new Set(topKeywords);

  const scored = sentences.map((sentence, index) => {
    const trimmed = sentence.trim();
    const words = trimmed.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    
    // Score based on frequency of top article keywords
    let matchCount = 0;
    words.forEach((w) => {
      if (keywordSet.has(w)) matchCount += 1;
    });

    const score = words.length > 5 && words.length < 50 ? matchCount / Math.sqrt(words.length) : 0;
    return { sentence: trimmed, score, index };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}