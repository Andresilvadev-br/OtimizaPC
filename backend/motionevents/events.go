// Package motionevents define o contrato de eventos que o backend Go do
// OtimizaPC envia à interface (WebView2) para o motor ULTRA MOTION X.
//
// Regras do Plano 5.0 aplicadas aqui:
//   - O backend emite ESTADOS (iniciou, progrediu, confirmado, falhou),
//     nunca frames de animação.
//   - Eventos de confirmação (Confirmed/Validated/Activated/Restored/Verified)
//     só devem ser emitidos depois da releitura independente no Windows.
//     Por isso eles têm funções próprias que exigem a evidência verificada.
//   - Cada evento leva id de correlação e seq monotônico: a interface descarta
//     duplicados e nunca anuncia um estado antigo.
//
// O mesmo contrato está em frontend/motion/events.js.
package motionevents

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sync"
	"sync/atomic"
	"time"
)

// Channel identifica as mensagens do motor de movimento na ponte WebView2.
const Channel = "umx"

// Tipos de evento (espelham EVENTS em frontend/motion/events.js).
const (
	ClipSaveRequested = "clip.save.requested"
	ClipSaveValidated = "clip.save.validated"
	ClipSaveFailed    = "clip.save.failed"

	OptimizeRequested = "optimize.requested"
	OptimizeStarted   = "optimize.started"
	OptimizeProgress  = "optimize.progress"
	OptimizeConfirmed = "optimize.confirmed"
	OptimizeFailed    = "optimize.failed"

	ScanStarted  = "scan.started"
	ScanFinished = "scan.finished"
	ScanFailed   = "scan.failed"

	GameDetected         = "game.detected"
	GameActivated        = "game.activated"
	GameActivationFailed = "game.activation.failed"
	GameSessionEnded     = "game.session.ended"
	GameRestored         = "game.restored"
	GameRestoreFailed    = "game.restore.failed"

	RestoreRequested = "restore.requested"
	RestoreVerified  = "restore.verified"
	RestoreFailed    = "restore.failed"

	Notify         = "notify"
	IslandActivity = "island.activity"
	AppVisibility  = "app.visibility"
	ThemeChanged   = "theme.changed"
)

// Comandos UI → Go (recebidos pelo handler de mensagens do WebView2).
const (
	CmdClipSave    = "clip.save.request"
	CmdOptimize    = "optimize.request"
	CmdRestore     = "restore.request"
	CmdSettingsSet = "settings.set"
)

// Event é o envelope JSON entregue à interface.
type Event struct {
	Channel string `json:"channel"`
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Seq     uint64 `json:"seq"`
	TS      int64  `json:"ts"`
	Payload any    `json:"payload,omitempty"`
}

// Command é uma mensagem recebida da interface.
type Command struct {
	Channel string          `json:"channel"`
	Type    string          `json:"type"`
	ID      string          `json:"id,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Poster entrega o JSON ao WebView2. Exemplos:
//   - ICoreWebView2.PostWebMessageAsJson(json)
//   - w.Eval("window.__umx.receive(" + json + ")") em bindings que só oferecem Eval.
type Poster func(json string) error

var typePattern = regexp.MustCompile(`^[a-z0-9_.:-]{1,96}$`)

// ErrUnverified indica tentativa de anunciar sucesso sem evidência verificada.
var ErrUnverified = errors.New("motionevents: confirmação exige verificação real no Windows")

// Emitter serializa e envia eventos com seq monotônico. Seguro para goroutines.
type Emitter struct {
	post Poster
	seq  atomic.Uint64
	now  func() time.Time
	mu   sync.Mutex // garante a ordem de entrega igual à ordem de seq
}

// NewEmitter cria um emissor. post não pode ser nil.
func NewEmitter(post Poster) *Emitter {
	if post == nil {
		panic("motionevents: Poster nil")
	}
	return &Emitter{post: post, now: time.Now}
}

// Emit envia um evento de estado genérico.
func (e *Emitter) Emit(eventType, id string, payload any) error {
	if !typePattern.MatchString(eventType) {
		return fmt.Errorf("motionevents: tipo inválido %q", eventType)
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	ev := Event{
		Channel: Channel,
		Type:    eventType,
		ID:      id,
		Seq:     e.seq.Add(1),
		TS:      e.now().UnixMilli(),
		Payload: payload,
	}
	raw, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("motionevents: serializar %s: %w", eventType, err)
	}
	return e.post(string(raw))
}

// Progress envia progresso real (etapas concluídas de um total conhecido).
func (e *Emitter) Progress(id string, done, total int) error {
	if total <= 0 || done < 0 || done > total {
		return fmt.Errorf("motionevents: progresso inválido %d/%d", done, total)
	}
	return e.Emit(OptimizeProgress, id, map[string]int{"done": done, "total": total})
}

// Verification resume a releitura independente de um conjunto de ajustes.
type Verification struct {
	Verified int `json:"verified"` // ajustes relidos e confirmados
	Total    int `json:"total"`    // ajustes tentados
}

// OptimizeResult anuncia o resultado SOMENTE a partir da verificação.
// Resultados parciais (Verified < Total) são enviados como tal; a interface
// mostra "N de M verificados" em vez de um sucesso único.
func (e *Emitter) OptimizeResult(id string, v Verification) error {
	if v.Total <= 0 || v.Verified < 0 || v.Verified > v.Total {
		return fmt.Errorf("motionevents: verificação inválida %d/%d", v.Verified, v.Total)
	}
	if v.Verified == 0 {
		return e.Emit(OptimizeFailed, id, map[string]any{"message": "Nenhum ajuste pôde ser confirmado.", "verified": 0, "total": v.Total})
	}
	return e.Emit(OptimizeConfirmed, id, v)
}

// ClipValidated anuncia um clipe salvo apenas se o arquivo foi validado.
func (e *Emitter) ClipValidated(id, name string, fileValidated bool) error {
	if !fileValidated {
		return ErrUnverified
	}
	return e.Emit(ClipSaveValidated, id, map[string]string{"name": name})
}

// GameActivated anuncia o Modo Jogo ativo apenas com o estado confirmado.
func (e *Emitter) GameActivated(id, gameName string, stateConfirmed bool) error {
	if !stateConfirmed {
		return ErrUnverified
	}
	return e.Emit(GameActivated, id, map[string]string{"name": gameName})
}

// GameRestored anuncia a restauração apenas após confirmar os valores originais.
func (e *Emitter) GameRestored(id string, restoreConfirmed bool) error {
	if !restoreConfirmed {
		return ErrUnverified
	}
	return e.Emit(GameRestored, id, nil)
}

// RestoreVerified anuncia uma reversão do Safe Restore já relida no Windows.
func (e *Emitter) RestoreVerified(id string, stateMatchesOriginal bool) error {
	if !stateMatchesOriginal {
		return ErrUnverified
	}
	return e.Emit(RestoreVerified, id, nil)
}

// Failed envia uma falha com mensagem legível (sem dados pessoais).
func (e *Emitter) Failed(eventType, id, code, message string) error {
	return e.Emit(eventType, id, map[string]string{"code": code, "message": message})
}

// ParseCommand decodifica uma mensagem da interface (WebMessageReceived).
// Mensagens de outros canais devolvem ok=false sem erro.
func ParseCommand(raw string) (cmd Command, ok bool, err error) {
	if err = json.Unmarshal([]byte(raw), &cmd); err != nil {
		return Command{}, false, fmt.Errorf("motionevents: comando inválido: %w", err)
	}
	if cmd.Channel != Channel {
		return Command{}, false, nil
	}
	if !typePattern.MatchString(cmd.Type) {
		return Command{}, false, fmt.Errorf("motionevents: tipo de comando inválido %q", cmd.Type)
	}
	return cmd, true, nil
}
