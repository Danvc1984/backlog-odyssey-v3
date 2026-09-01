export interface FuzzyMatchResult {
  matched: boolean;
  score: number;
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function damerauLevenshtein(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols));
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
      if (
        row > 1 &&
        col > 1 &&
        a[row - 1] === b[col - 2] &&
        a[row - 2] === b[col - 1]
      ) {
        matrix[row][col] = Math.min(
          matrix[row][col],
          matrix[row - 2][col - 2] + 1,
        );
      }
    }
  }
  return matrix[rows - 1][cols - 1];
}

function tokenFuzzyDistance(queryToken: string, nameToken: string): number | null {
  const distance = damerauLevenshtein(queryToken, nameToken);
  const maxLength = Math.max(queryToken.length, nameToken.length);
  if (maxLength === 0) return 0;
  const allowed = Math.max(1, Math.floor(maxLength / 3));
  if (distance <= allowed && distance <= maxLength / 2) {
    return distance;
  }
  return null;
}

export function fuzzyMatch(query: string, name: string): FuzzyMatchResult {
  const q = normalizeForSearch(query);
  const n = normalizeForSearch(name);
  if (!q || !n) return { matched: false, score: 0 };

  if (n.includes(q)) {
    const whole = damerauLevenshtein(q, n);
    const wholeLength = Math.max(q.length, n.length);
    return { matched: true, score: Math.max(1 - whole / wholeLength, 0.98) };
  }

  const qTokens = q.split(" ").filter((token) => token.length > 0);
  const nTokens = n.split(" ").filter((token) => token.length > 0);

  const allTokensContained =
    qTokens.length > 0 &&
    qTokens.every((token) => nTokens.some((nameToken) => nameToken.includes(token)));
  if (allTokensContained) {
    return { matched: true, score: 0.9 };
  }

  const wholeLength = Math.max(q.length, n.length);
  const wholeDistance = damerauLevenshtein(q, n);
  const maxWholeDistance = Math.max(1, Math.floor(q.length / 3));
  if (wholeDistance <= maxWholeDistance) {
    return { matched: true, score: 1 - wholeDistance / wholeLength };
  }

  const tokenMatches = qTokens.filter((token) =>
    nTokens.some((nameToken) => tokenFuzzyDistance(token, nameToken) !== null),
  ).length;
  if (qTokens.length > 0 && tokenMatches >= Math.ceil(qTokens.length / 2)) {
    return { matched: true, score: Math.max(1 - wholeDistance / wholeLength, 0.6) };
  }

  return { matched: false, score: Math.max(0, 1 - wholeDistance / wholeLength) };
}