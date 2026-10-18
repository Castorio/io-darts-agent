/**
 * Cricket phrases for the Darts Caller: closed-field and strong-turn
 * announcements. Shared by the voice pack generator (getDefaultPhrases) and
 * the handler (text + audio file name for a live announcement).
 */
import { scoreToEnglish, scoreToGerman, type PhraseEntry } from './numberWords.js';

export type { PhraseEntry };

/** Cricket number fields, Bull ('25') is handled separately as "bull". */
const CRICKET_NUMBER_FIELDS: readonly string[] = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

const MIN_MARKS = 3;
const MAX_MARKS = 9;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function clampMarks(n: number): number {
  return Math.min(MAX_MARKS, Math.max(MIN_MARKS, n));
}

/** Audio file name for a closed Cricket field ('25' -> closed_bull). */
export function closedFile(field: string): string {
  return field === '25' ? 'closed_bull' : `closed_${field}`;
}

/** Spoken text for a closed Cricket field, e.g. "Twenty closed!" / "Bull geschlossen!". */
export function closedText(field: string, language: string): string {
  const isDe = language === 'de';
  if (field === '25') {
    return isDe ? 'Bull geschlossen!' : 'Bull closed!';
  }
  const number = Number(field);
  const word = capitalize(isDe ? scoreToGerman(number) : scoreToEnglish(number));
  return isDe ? `${word} geschlossen!` : `${word} closed!`;
}

/** Audio file name for a strong Cricket turn, marks clamped to 3..9. */
export function marksFile(n: number): string {
  return `marks_${clampMarks(n)}`;
}

/** Spoken text for a strong Cricket turn, e.g. "Six marks!" / "Sechs Marks!". */
export function marksText(n: number, language: string): string {
  const isDe = language === 'de';
  const clamped = clampMarks(n);
  const word = capitalize(isDe ? scoreToGerman(clamped) : scoreToEnglish(clamped));
  return isDe ? `${word} Marks!` : `${word} marks!`;
}

/**
 * All Cricket phrase entries for a voice pack: 12 closed-field phrases
 * (10..20 plus Bull) and 7 strong-turn phrases (marks 3..9).
 */
export function cricketPhrases(language: string): PhraseEntry[] {
  const phrases: PhraseEntry[] = [];

  for (const field of [...CRICKET_NUMBER_FIELDS, '25']) {
    phrases.push({ filename: closedFile(field), text: closedText(field, language), category: 'cricket' });
  }

  for (let marks = MIN_MARKS; marks <= MAX_MARKS; marks++) {
    phrases.push({ filename: marksFile(marks), text: marksText(marks, language), category: 'cricket' });
  }

  return phrases;
}
