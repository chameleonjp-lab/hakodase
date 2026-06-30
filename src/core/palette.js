// 色パレットと記号。色だけに頼らず記号を併記して色覚に配慮する。
// hex はデータとして持つだけ（DOM 非依存）。描画側が利用する。

export const PALETTE = [
  { id: 0, name: 'red', hex: '#e5484d', symbol: '●' },
  { id: 1, name: 'blue', hex: '#3b82f6', symbol: '▲' },
  { id: 2, name: 'green', hex: '#30a46c', symbol: '■' },
  { id: 3, name: 'amber', hex: '#f5a623', symbol: '◆' },
  { id: 4, name: 'purple', hex: '#8e4ec6', symbol: '★' },
  { id: 5, name: 'teal', hex: '#14b8a6', symbol: '＋' },
];

export function colorOf(id) {
  return PALETTE[id % PALETTE.length];
}
