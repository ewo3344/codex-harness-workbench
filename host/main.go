package main

import (
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type config struct {
	addr        string
	token       string
	codexBin    string
	defaultCwd  string
	maxSessions int
}

func main() {
	defaultCwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("get working directory: %v", err)
	}

	cfg := config{}
	flag.StringVar(&cfg.addr, "addr", envOr("CRW_ADDR", "127.0.0.1:8787"), "HTTP/WebSocket listen address")
	flag.StringVar(&cfg.token, "token", os.Getenv("CRW_TOKEN"), "bearer token; CRW_TOKEN is preferred for deployments")
	flag.StringVar(&cfg.codexBin, "codex", envOr("CRW_CODEX_BIN", "codex"), "Codex executable used for the default session")
	flag.StringVar(&cfg.defaultCwd, "cwd", envOr("CRW_WORKSPACE", defaultCwd), "default working directory for new sessions")
	flag.IntVar(&cfg.maxSessions, "max-sessions", 16, "maximum concurrent PTY sessions")
	flag.Parse()

	cfg.defaultCwd, err = filepath.Abs(cfg.defaultCwd)
	if err != nil {
		log.Fatalf("resolve cwd: %v", err)
	}
	if stat, statErr := os.Stat(cfg.defaultCwd); statErr != nil || !stat.IsDir() {
		log.Fatalf("default cwd is not a directory: %s", cfg.defaultCwd)
	}
	if cfg.maxSessions < 1 || cfg.maxSessions > 128 {
		log.Fatal("max-sessions must be between 1 and 128")
	}
	if strings.TrimSpace(cfg.token) == "" {
		cfg.token, err = newToken()
		if err != nil {
			log.Fatalf("generate token: %v", err)
		}
		log.Printf("CRW_TOKEN=%s", cfg.token)
	}

	manager := newSessionManager(cfg.codexBin, cfg.defaultCwd, cfg.maxSessions)
	server := newServer(manager, cfg.token, cfg)

	log.Printf("Codex Remote Workbench listening on http://%s", cfg.addr)
	log.Printf("default Codex executable: %s; default cwd: %s", cfg.codexBin, cfg.defaultCwd)
	if err := http.ListenAndServe(cfg.addr, server); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read crypto/rand: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
