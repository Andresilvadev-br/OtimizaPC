package motionevents

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"
)

type sink struct {
	mu   sync.Mutex
	msgs []Event
}

func (s *sink) post(raw string) error {
	var ev Event
	if err := json.Unmarshal([]byte(raw), &ev); err != nil {
		return err
	}
	s.mu.Lock()
	s.msgs = append(s.msgs, ev)
	s.mu.Unlock()
	return nil
}

func newTest() (*Emitter, *sink) {
	s := &sink{}
	e := NewEmitter(s.post)
	e.now = func() time.Time { return time.UnixMilli(1000) }
	return e, s
}

func TestEnvelopeAndSeq(t *testing.T) {
	e, s := newTest()
	if err := e.Emit(OptimizeStarted, "o1", nil); err != nil {
		t.Fatal(err)
	}
	if err := e.Progress("o1", 2, 5); err != nil {
		t.Fatal(err)
	}
	if len(s.msgs) != 2 {
		t.Fatalf("esperava 2 eventos, veio %d", len(s.msgs))
	}
	if s.msgs[0].Channel != Channel || s.msgs[0].Seq != 1 || s.msgs[1].Seq != 2 || s.msgs[0].TS != 1000 {
		t.Fatalf("envelope incorreto: %+v", s.msgs)
	}
}

func TestInvalidType(t *testing.T) {
	e, _ := newTest()
	if err := e.Emit("<script>", "", nil); err == nil {
		t.Fatal("tipo inválido deveria falhar")
	}
}

func TestConfirmationsRequireVerification(t *testing.T) {
	e, s := newTest()
	for name, err := range map[string]error{
		"clip":    e.ClipValidated("c", "x.mp4", false),
		"game":    e.GameActivated("g", "Jogo", false),
		"restore": e.GameRestored("g", false),
		"undo":    e.RestoreVerified("r", false),
	} {
		if !errors.Is(err, ErrUnverified) {
			t.Errorf("%s: esperava ErrUnverified, veio %v", name, err)
		}
	}
	if len(s.msgs) != 0 {
		t.Fatalf("nenhum evento deveria sair sem verificação: %+v", s.msgs)
	}
}

func TestOptimizeResult(t *testing.T) {
	e, s := newTest()
	if err := e.OptimizeResult("o", Verification{Verified: 2, Total: 3}); err != nil {
		t.Fatal(err)
	}
	if err := e.OptimizeResult("o2", Verification{Verified: 0, Total: 3}); err != nil {
		t.Fatal(err)
	}
	if err := e.OptimizeResult("o3", Verification{Verified: 4, Total: 3}); err == nil {
		t.Fatal("verificação impossível deveria falhar")
	}
	if s.msgs[0].Type != OptimizeConfirmed || s.msgs[1].Type != OptimizeFailed {
		t.Fatalf("tipos incorretos: %s, %s", s.msgs[0].Type, s.msgs[1].Type)
	}
}

func TestProgressBounds(t *testing.T) {
	e, _ := newTest()
	if err := e.Progress("o", 6, 5); err == nil {
		t.Fatal("progresso acima do total deveria falhar")
	}
	if err := e.Progress("o", 1, 0); err == nil {
		t.Fatal("total zero deveria falhar")
	}
}

func TestConcurrentSeqIsUniqueAndOrdered(t *testing.T) {
	e, s := newTest()
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _ = e.Emit(Notify, "", nil) }()
	}
	wg.Wait()
	for i, ev := range s.msgs {
		if ev.Seq != uint64(i+1) {
			t.Fatalf("seq fora de ordem na posição %d: %d", i, ev.Seq)
		}
	}
}

func TestParseCommand(t *testing.T) {
	cmd, ok, err := ParseCommand(`{"channel":"umx","type":"clip.save.request","id":"c1","payload":{"source":"ui"}}`)
	if err != nil || !ok || cmd.Type != CmdClipSave || cmd.ID != "c1" {
		t.Fatalf("comando incorreto: %+v %v %v", cmd, ok, err)
	}
	if _, ok, err := ParseCommand(`{"channel":"outro","type":"x"}`); ok || err != nil {
		t.Fatal("outro canal deveria ser ignorado sem erro")
	}
	if _, _, err := ParseCommand(`não é json`); err == nil {
		t.Fatal("json inválido deveria falhar")
	}
}
