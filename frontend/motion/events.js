// Contrato de eventos Go ↔ WebView2 usado pelo ULTRA MOTION X no OtimizaPC.
// Espelha backend/motionevents/events.go — mantenha os dois em sincronia.
//
// Regra: o backend emite ESTADOS confirmados no Windows; a interface nunca
// conclui "salvo/ativado/restaurado" por conta própria.

export const EVENTS = Object.freeze({
  // Clipes (Chico Clips Studio)
  CLIP_SAVE_REQUESTED: 'clip.save.requested',
  CLIP_SAVE_VALIDATED: 'clip.save.validated', // arquivo existe e foi validado
  CLIP_SAVE_FAILED: 'clip.save.failed',

  // Otimização (Optimization Integrity Engine)
  OPTIMIZE_REQUESTED: 'optimize.requested',   // usuário confirmou
  OPTIMIZE_STARTED: 'optimize.started',       // operação real começou
  OPTIMIZE_PROGRESS: 'optimize.progress',     // { done, total } — etapas reais
  OPTIMIZE_CONFIRMED: 'optimize.confirmed',   // { verified, total } após releitura
  OPTIMIZE_FAILED: 'optimize.failed',

  // Diagnóstico
  SCAN_STARTED: 'scan.started',
  SCAN_FINISHED: 'scan.finished',             // { findings }
  SCAN_FAILED: 'scan.failed',

  // Modo Jogo (somente renovação visual)
  GAME_DETECTED: 'game.detected',             // { name }
  GAME_ACTIVATED: 'game.activated',
  GAME_ACTIVATION_FAILED: 'game.activation.failed',
  GAME_SESSION_ENDED: 'game.session.ended',
  GAME_RESTORED: 'game.restored',
  GAME_RESTORE_FAILED: 'game.restore.failed',

  // Safe Restore
  RESTORE_REQUESTED: 'restore.requested',
  RESTORE_VERIFIED: 'restore.verified',
  RESTORE_FAILED: 'restore.failed',

  // Diversos
  NOTIFY: 'notify',                           // { level, title, body }
  ISLAND_ACTIVITY: 'island.activity',         // { kind, state, ... }
  APP_VISIBILITY: 'app.visibility',           // { state: 'minimized' | 'restored' }
  THEME_CHANGED: 'theme.changed',             // { accent, mode }
});

/** Comandos UI → Go (enviados por HostBridge.send). */
export const COMMANDS = Object.freeze({
  CLIP_SAVE: 'clip.save.request',
  OPTIMIZE: 'optimize.request',
  RESTORE: 'restore.request',
  SETTINGS_SET: 'settings.set',
});
