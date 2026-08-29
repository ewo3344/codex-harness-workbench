package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func testConfig() config {
	cwd, _ := os.Getwd()
	return config{addr: "127.0.0.1:0", token: "test-token", codexBin: "codex", defaultCwd: cwd, maxSessions: 4}
}

func TestInfoRequiresBearerToken(t *testing.T) {
	cfg := testConfig()
	server := newServer(newSessionManager(cfg.codexBin, cfg.defaultCwd, cfg.maxSessions), cfg.token, cfg)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/info", nil)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d, want 401", response.Code)
	}

	request = httptest.NewRequest(http.MethodGet, "/api/v1/info", nil)
	request.Header.Set("Authorization", "Bearer "+cfg.token)
	response = httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated status = %d, want 200: %s", response.Code, response.Body.String())
	}
}

func TestCreateSessionAddsNoAltScreenForCodex(t *testing.T) {
	temporary := t.TempDir()
	manager := newSessionManager("codex", temporary, 2)
	manager.codexBin = "/bin/echo"
	item, err := manager.create(createSessionRequest{Command: "/bin/echo", Cwd: temporary})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, item, statusExited, 2*time.Second)
	_, output, _ := item.snapshot()
	if !strings.Contains(output, "--no-alt-screen") {
		t.Fatalf("Codex-compatible process did not receive --no-alt-screen: %q", output)
	}
}

func TestSessionOutputCursorAndInput(t *testing.T) {
	temporary := t.TempDir()
	manager := newSessionManager("codex", temporary, 2)
	item, err := manager.create(createSessionRequest{
		Name: "shell", Command: "/bin/sh", Args: []string{"-c", "printf ready; read line; printf ' got:%s' \"$line\""}, Cwd: temporary,
	})
	if err != nil {
		t.Fatal(err)
	}
	waitForOutput(t, item, "ready", 2*time.Second)
	if err := item.writeInput("remote\n"); err != nil {
		t.Fatal(err)
	}
	waitForOutput(t, item, "got:remote", 2*time.Second)
	chunks, cursor, reset := item.outputSince(0)
	if reset || cursor == 0 || len(chunks) == 0 {
		t.Fatalf("unexpected cursor response: reset=%v cursor=%d chunks=%d", reset, cursor, len(chunks))
	}
	if err := manager.remove(item.id); err != nil {
		t.Fatal(err)
	}
}

func TestHTTPCreateAndOutput(t *testing.T) {
	temporary := t.TempDir()
	cfg := testConfig()
	cfg.defaultCwd = temporary
	manager := newSessionManager("codex", temporary, 2)
	server := newServer(manager, cfg.token, cfg)

	body := strings.NewReader(`{"name":"echo","command":"/bin/echo","args":["hello"]}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/sessions", body)
	request.Header.Set("Authorization", "Bearer "+cfg.token)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", response.Code, response.Body.String())
	}
	var envelope struct {
		Session sessionView `json:"session"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	waitForOutput(t, mustGet(t, manager, envelope.Session.ID), "hello", 2*time.Second)

	request = httptest.NewRequest(http.MethodGet, "/api/v1/sessions/"+envelope.Session.ID+"/output?cursor=0", nil)
	request.Header.Set("Authorization", "Bearer "+cfg.token)
	response = httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "hello") {
		t.Fatalf("output response = %d %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPost, "/api/v1/sessions/"+envelope.Session.ID+"/stop", nil)
	request.Header.Set("Authorization", "Bearer "+cfg.token)
	response = httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("stop status = %d: %s", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodDelete, "/api/v1/sessions/"+envelope.Session.ID, nil)
	request.Header.Set("Authorization", "Bearer "+cfg.token)
	response = httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("delete status = %d: %s", response.Code, response.Body.String())
	}
}

func TestWebSocketSnapshot(t *testing.T) {
	temporary := t.TempDir()
	cfg := testConfig()
	manager := newSessionManager("codex", temporary, 2)
	item, err := manager.create(createSessionRequest{
		Name: "stream", Command: "/bin/sh", Args: []string{"-c", "printf websocket; sleep 1"}, Cwd: temporary,
	})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(newServer(manager, cfg.token, cfg))
	defer httpServer.Close()
	wsURL := "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/ws/v1/sessions/" + item.id + "?token=" + cfg.token
	connection, _, err := websocket.Dial(context.Background(), wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.CloseNow()
	var snapshot struct {
		Type   string `json:"type"`
		Output string `json:"output"`
	}
	if err := wsjson.Read(context.Background(), connection, &snapshot); err != nil {
		t.Fatal(err)
	}
	if snapshot.Type != "snapshot" {
		t.Fatalf("WebSocket first event type = %q", snapshot.Type)
	}
	waitForOutput(t, item, "websocket", 2*time.Second)
}

func TestStopTerminatesProcess(t *testing.T) {
	temporary := t.TempDir()
	manager := newSessionManager("codex", temporary, 2)
	item, err := manager.create(createSessionRequest{
		Name: "long", Command: "/bin/sh", Args: []string{"-c", "printf started; sleep 30"}, Cwd: temporary,
	})
	if err != nil {
		t.Fatal(err)
	}
	waitForOutput(t, item, "started", 2*time.Second)
	if err := manager.stop(item.id); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, item, statusStopped, 2*time.Second)
}

func mustGet(t *testing.T, manager *sessionManager, id string) *session {
	t.Helper()
	item, ok := manager.get(id)
	if !ok {
		t.Fatalf("session %s not found", id)
	}
	return item
}

func waitForOutput(t *testing.T, item *session, expected string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		_, output, _ := item.snapshot()
		if strings.Contains(output, expected) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	_, output, _ := item.snapshot()
	t.Fatalf("timed out waiting for %q in %q", expected, output)
}

func waitForStatus(t *testing.T, item *session, expected sessionStatus, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if item.view().Status == expected {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for status %q (got %q)", expected, item.view().Status)
}
