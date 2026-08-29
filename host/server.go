package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type server struct {
	manager *sessionManager
	token   string
	config  config
}

func newServer(manager *sessionManager, token string, cfg config) http.Handler {
	return &server{manager: manager, token: token, config: cfg}
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		s.health(w)
		return
	}
	if r.URL.Path == "/" || strings.HasPrefix(r.URL.Path, "/assets/") {
		s.serveUI(w, r)
		return
	}
	if r.URL.Path == "/api/v1/info" || strings.HasPrefix(r.URL.Path, "/api/v1/") {
		if !s.authorized(r, false) {
			writeError(w, http.StatusUnauthorized, "missing or invalid bearer token")
			return
		}
		s.api(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/ws/v1/") {
		if !s.authorized(r, true) {
			writeError(w, http.StatusUnauthorized, "missing or invalid bearer token")
			return
		}
		s.websocket(w, r)
		return
	}
	http.NotFound(w, r)
}

func (s *server) authorized(r *http.Request, websocketRequest bool) bool {
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if websocketRequest && authorization == "" {
		authorization = "Bearer " + strings.TrimSpace(r.URL.Query().Get("token"))
	}
	if !strings.HasPrefix(authorization, "Bearer ") {
		return false
	}
	presented := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
	return constantTimeEqual(presented, s.token)
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for index := range []byte(a) {
		result |= a[index] ^ b[index]
	}
	return result == 0
}

func (s *server) health(w http.ResponseWriter) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "service": "codex-remote-workbench", "time": time.Now().UTC(),
	})
}

func (s *server) api(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/v1/info" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "GET required")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"service": "codex-remote-workbench", "version": "0.1.0",
			"codex": s.config.codexBin, "defaultCwd": s.config.defaultCwd,
			"maxSessions": s.config.maxSessions,
		})
		return
	}
	if r.URL.Path == "/api/v1/sessions" {
		s.sessions(w, r)
		return
	}
	prefix := "/api/v1/sessions/"
	if !strings.HasPrefix(r.URL.Path, prefix) {
		writeError(w, http.StatusNotFound, "endpoint not found")
		return
	}
	path := strings.TrimPrefix(r.URL.Path, prefix)
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "session id required")
		return
	}
	item, ok := s.manager.get(parts[0])
	if !ok {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if len(parts) == 1 {
		s.sessionDetail(w, r, item)
		return
	}
	if len(parts) != 2 {
		writeError(w, http.StatusNotFound, "endpoint not found")
		return
	}
	s.sessionAction(w, r, item, parts[1])
}

func (s *server) sessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"sessions": s.manager.list()})
	case http.MethodPost:
		var request createSessionRequest
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := s.manager.create(request)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"session": item.view()})
	default:
		writeError(w, http.StatusMethodNotAllowed, "GET or POST required")
	}
}

func (s *server) sessionDetail(w http.ResponseWriter, r *http.Request, item *session) {
	if r.Method == http.MethodDelete {
		if err := s.manager.remove(item.id); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "GET required")
		return
	}
	view, output, cursor := item.snapshot()
	writeJSON(w, http.StatusOK, map[string]any{"session": view, "output": output, "cursor": cursor})
}

func (s *server) sessionAction(w http.ResponseWriter, r *http.Request, item *session, action string) {
	switch action {
	case "output":
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "GET required")
			return
		}
		cursor, err := strconv.ParseUint(r.URL.Query().Get("cursor"), 10, 64)
		if r.URL.Query().Get("cursor") == "" {
			cursor = 0
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "cursor must be an unsigned integer")
			return
		}
		chunks, current, reset := item.outputSince(cursor)
		view := item.view()
		writeJSON(w, http.StatusOK, map[string]any{
			"session": view, "cursor": current, "reset": reset, "chunks": chunks,
		})
	case "input":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		var request struct {
			Data string `json:"data"`
		}
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := item.writeInput(request.Data); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true})
	case "resize":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		var request struct {
			Cols uint16 `json:"cols"`
			Rows uint16 `json:"rows"`
		}
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := item.resize(request.Cols, request.Rows); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true})
	case "signal":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		var request struct {
			Signal string `json:"signal"`
		}
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if request.Signal != "INT" && request.Signal != "TERM" && request.Signal != "KILL" {
			writeError(w, http.StatusBadRequest, "signal must be INT, TERM, or KILL")
			return
		}
		var signalInput string
		switch request.Signal {
		case "INT":
			signalInput = "\x03"
		case "TERM":
			signalInput = "\x1d"
		case "KILL":
			if err := s.manager.stop(item.id); err != nil {
				writeError(w, http.StatusConflict, err.Error())
				return
			}
		}
		if signalInput != "" {
			if err := item.writeInput(signalInput); err != nil {
				writeError(w, http.StatusConflict, err.Error())
				return
			}
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true})
	case "stop":
		if r.Method != http.MethodDelete && r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST or DELETE required")
			return
		}
		if err := s.manager.stop(item.id); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		writeError(w, http.StatusNotFound, "unknown session action")
	}
}

func (s *server) websocket(w http.ResponseWriter, r *http.Request) {
	prefix := "/ws/v1/sessions/"
	if !strings.HasPrefix(r.URL.Path, prefix) {
		writeError(w, http.StatusNotFound, "endpoint not found")
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, prefix), "/")
	item, ok := s.manager.get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	connection, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer connection.CloseNow()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	var writeMu sync.Mutex
	writeJSONMessage := func(value any) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return wsjson.Write(ctx, connection, value)
	}
	view, output, cursor := item.snapshot()
	if err := writeJSONMessage(map[string]any{
		"type": "snapshot", "session": view, "output": output, "cursor": cursor,
	}); err != nil {
		return
	}
	subscriber := item.subscribe()
	writeDone := make(chan struct{})
	go func() {
		defer close(writeDone)
		for event := range subscriber {
			if err := writeJSONMessage(event); err != nil {
				return
			}
		}
	}()
	for {
		var message struct {
			Type   string `json:"type"`
			Data   string `json:"data"`
			Cols   uint16 `json:"cols"`
			Rows   uint16 `json:"rows"`
			Signal string `json:"signal"`
		}
		if err := wsjson.Read(ctx, connection, &message); err != nil {
			break
		}
		var actionErr error
		switch message.Type {
		case "input":
			actionErr = item.writeInput(message.Data)
		case "resize":
			actionErr = item.resize(message.Cols, message.Rows)
		case "signal":
			if message.Signal == "INT" {
				actionErr = item.writeInput("\x03")
			} else if message.Signal == "KILL" {
				actionErr = s.manager.stop(item.id)
			} else {
				actionErr = fmt.Errorf("unsupported signal %q", message.Signal)
			}
		case "ping":
			actionErr = writeJSONMessage(map[string]string{"type": "pong"})
		default:
			actionErr = fmt.Errorf("unknown message type %q", message.Type)
		}
		if actionErr != nil {
			_ = writeJSONMessage(sessionEvent{Type: "error", Error: actionErr.Error()})
		}
	}
	item.unsubscribe(subscriber)
	<-writeDone
}

func (s *server) serveUI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "GET required")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, workbenchHTML)
}

func decodeJSON(r *http.Request, destination any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 128*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}
