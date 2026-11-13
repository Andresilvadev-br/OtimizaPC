// Preferências de movimento: salvas localmente e espelhadas no backend Go
// (AppData), para sobreviver a reinstalação/atualização via OtimizaPC Setup.

import { COMMANDS } from './events.js';

const PREFIX = 'otimizapc.';

/**
 * Chaves de perfil de versões anteriores (4.x). Ajuste se o motor antigo
 * usava outro nome — se nenhuma existir, o padrão é Ultra (Plano 5.0 §6.10).
 */
export const LEGACY_PROFILE_KEYS = ['ultraMotion.profile', 'motionProfile', 'otimizapc.motion'];
const LEGACY_VALUES = {
  ultra: 'ultra', balanced: 'balanced', performance: 'performance',
  equilibrado: 'balanced', desempenho: 'performance', alto: 'ultra',
};

export function createSettingsStorage({ bridge = null, initial = globalThis.__otimizapcSettings ?? null } = {}) {
  const local = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
  return {
    get(key) {
      // 1) Valor injetado pelo Go na inicialização (fonte de verdade em AppData).
      if (initial && Object.prototype.hasOwnProperty.call(initial, key)) return initial[key];
      try { return local?.getItem(PREFIX + key) ?? null; } catch { return null; }
    },
    set(key, value) {
      try { local?.setItem(PREFIX + key, String(value)); } catch { /* sem armazenamento local */ }
      if (initial) initial[key] = String(value);
      bridge?.send(COMMANDS.SETTINGS_SET, { key, value: String(value) });
    },
  };
}

/** Migração 4.9.x → 5.0: preserva escolha manual antiga; senão nada (→ Ultra). */
export function migrateLegacyProfile(storage, key = 'umx.profile') {
  if (storage.get(key)) return null;
  let local = null;
  try { local = globalThis.localStorage ?? null; } catch { local = null; }
  for (const legacyKey of LEGACY_PROFILE_KEYS) {
    let raw = null;
    try { raw = local?.getItem(legacyKey) ?? null; } catch { raw = null; }
    const mapped = raw ? LEGACY_VALUES[String(raw).toLowerCase()] : null;
    if (mapped) {
      storage.set(key, mapped);
      return mapped;
    }
  }
  return null;
}
