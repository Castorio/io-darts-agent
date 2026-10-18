/**
 * Number-to-words conversion shared by the voice pack generator and the
 * Cricket phrases. Lives in its own module so VoicePackGenerator.ts and
 * cricketPhrases.ts can both depend on it without importing each other.
 */

/**
 * Phrase entry for generation
 */
export interface PhraseEntry {
  filename: string;
  text: string;
  category: string;
}

/**
 * Convert number to English text
 */
export function scoreToEnglish(score: number): string {
  if (score === 0) return 'No score';

  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (score < 20) return ones[score];
  if (score < 100) {
    const t = Math.floor(score / 10);
    const o = score % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  }

  const h = Math.floor(score / 100);
  const r = score % 100;
  const hundredPart = h === 1 ? 'one hundred' : `${ones[h]} hundred`;

  if (r === 0) return hundredPart;
  return `${hundredPart} and ${scoreToEnglish(r)}`;
}

/**
 * Convert number to German text
 */
export function scoreToGerman(score: number): string {
  if (score === 0) return 'Null';

  const ones = [
    '', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
    'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn',
    'siebzehn', 'achtzehn', 'neunzehn',
  ];
  const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  if (score < 20) return ones[score];
  if (score < 100) {
    const t = Math.floor(score / 10);
    const o = score % 10;
    if (o === 0) return tens[t];
    if (o === 1) return `einund${tens[t]}`;
    return `${ones[o]}und${tens[t]}`;
  }

  const h = Math.floor(score / 100);
  const r = score % 100;
  const hundredPart = h === 1 ? 'einhundert' : `${ones[h]}hundert`;

  if (r === 0) return hundredPart;
  return `${hundredPart}${scoreToGerman(r)}`;
}
