// プレイヤー名の正規化と検査。DOM・Canvas・保存・通信へ依存しない。

export const PLAYER_NAME_MAX_CHARACTERS = 20;

export function countPlayerNameCharacters(value) {
  return Array.from(String(value ?? '')).length;
}

export function normalizePlayerName(value) {
  return String(value ?? '').trim();
}

export function limitPlayerNameInput(value, maxCharacters = PLAYER_NAME_MAX_CHARACTERS) {
  const safeMax = Number.isInteger(maxCharacters) && maxCharacters >= 0 ? maxCharacters : PLAYER_NAME_MAX_CHARACTERS;
  return Array.from(String(value ?? '')).slice(0, safeMax).join('');
}

export function validatePlayerName(value) {
  const name = normalizePlayerName(value);
  const length = countPlayerNameCharacters(name);
  if (length === 0) return Object.freeze({ valid: false, reason: 'required', name: '', length: 0 });
  if (length > PLAYER_NAME_MAX_CHARACTERS) {
    return Object.freeze({ valid: false, reason: 'too-long', name, length });
  }
  return Object.freeze({ valid: true, reason: null, name, length });
}
