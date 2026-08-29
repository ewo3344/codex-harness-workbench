package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
)

const (
	maxOutputBytes = 512 * 1024
	maxInputBytes  = 32 * 1024
	defaultCols    = 120
	defaultRows    = 36
)

type sessionStatus string

const (
	statusRunning sessionStatus = "running"
	statusExited  sessionStatus = "exited"
	statusFailed  sessionStatus = "failed"
	statusStopped sessionStatus = "stopped"
)

type sessionEvent struct {
	Type   string `json:"type"`
	Data   string `json:"data,omitempty"`
	Seq    uint64 `json:"seq,omitempty"`
	Status string `json:"status,omitempty"`
	Error  string `json:"error,omitempty"`
}

type outputChunk struct {
	Seq  uint64 `json:"seq"`
	Data string `json:"data"`
}

type sessionView struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Command   string        `json:"command"`
	Args      []string      `json:"args"`
	Cwd       string        `json:"cwd"`
	Status    sessionStatus `json:"status"`
	PID       int           `json:"pid,omitempty"`
	CreatedAt time.Time     `json:"createdAt"`
	ExitCode  *int          `json:"exitCode,omitempty"`
	Cols      uint16        `json:"cols"`
	Rows      uint16        `json:"rows"`
}

type session struct {
	mu          sync.RWMutex
	id          string
	name        string
	command     string
	args        []string
	cwd         string
	status      sessionStatus
	pid         int
	createdAt   time.Time
	exitCode    *int
	cols        uint16
	rows        uint16
	terminal    *os.File
	process     *exec.Cmd
	chunks      []outputChunk
	outputBytes int
	nextSeq     uint64
	subscribers map[chan sessionEvent]struct{}
}

func (s *session) view() sessionView {
	s.mu.RLock()
	defer s.mu.RUnlock()
	args := append([]string(nil), s.args...)
	var exitCode *int
	if s.exitCode != nil {
		value := *s.exitCode
		exitCode = &value
	}
	return sessionView{
		ID: s.id, Name: s.name, Command: s.command, Args: args, Cwd: s.cwd,
		Status: s.status, PID: s.pid, CreatedAt: s.createdAt, ExitCode: exitCode,
		Cols: s.cols, Rows: s.rows,
	}
}

func (s *session) snapshot() (sessionView, string, uint64) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var output strings.Builder
	for _, chunk := range s.chunks {
		output.WriteString(chunk.Data)
	}
	return s.viewLocked(), output.String(), s.nextSeq
}

func (s *session) viewLocked() sessionView {
	args := append([]string(nil), s.args...)
	var exitCode *int
	if s.exitCode != nil {
		value := *s.exitCode
		exitCode = &value
	}
	return sessionView{
		ID: s.id, Name: s.name, Command: s.command, Args: args, Cwd: s.cwd,
		Status: s.status, PID: s.pid, CreatedAt: s.createdAt, ExitCode: exitCode,
		Cols: s.cols, Rows: s.rows,
	}
}

func (s *session) outputSince(cursor uint64) (chunks []outputChunk, current uint64, reset bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	current = s.nextSeq
	if len(s.chunks) == 0 || cursor >= current {
		return nil, current, false
	}
	first := s.chunks[0].Seq
	if cursor+1 < first {
		copyChunks := append([]outputChunk(nil), s.chunks...)
		return copyChunks, current, true
	}
	for _, chunk := range s.chunks {
		if chunk.Seq > cursor {
			chunks = append(chunks, chunk)
		}
	}
	return chunks, current, false
}

func (s *session) subscribe() chan sessionEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	ch := make(chan sessionEvent, 64)
	s.subscribers[ch] = struct{}{}
	return ch
}

func (s *session) unsubscribe(ch chan sessionEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.subscribers[ch]; ok {
		delete(s.subscribers, ch)
		close(ch)
	}
}

func (s *session) publish(event sessionEvent) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for ch := range s.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func (s *session) appendOutput(data []byte) {
	if len(data) == 0 {
		return
	}
	text := string(data)
	s.mu.Lock()
	s.nextSeq++
	s.chunks = append(s.chunks, outputChunk{Seq: s.nextSeq, Data: text})
	s.outputBytes += len(data)
	for s.outputBytes > maxOutputBytes && len(s.chunks) > 1 {
		removed := s.chunks[0]
		s.chunks = s.chunks[1:]
		s.outputBytes -= len(removed.Data)
	}
	seq := s.nextSeq
	s.mu.Unlock()
	s.publish(sessionEvent{Type: "output", Data: text, Seq: seq})
}

func (s *session) writeInput(data string) error {
	if len(data) == 0 || len(data) > maxInputBytes {
		return fmt.Errorf("input must be between 1 and %d bytes", maxInputBytes)
	}
	s.mu.RLock()
	terminal := s.terminal
	status := s.status
	s.mu.RUnlock()
	if status != statusRunning || terminal == nil {
		return errors.New("session is not running")
	}
	_, err := terminal.Write([]byte(data))
	return err
}

func (s *session) resize(cols, rows uint16) error {
	if cols < 20 || cols > 500 || rows < 5 || rows > 200 {
		return errors.New("terminal size must be between 20x5 and 500x200")
	}
	s.mu.Lock()
	terminal := s.terminal
	s.cols, s.rows = cols, rows
	s.mu.Unlock()
	if terminal == nil {
		return errors.New("session is not running")
	}
	return pty.Setsize(terminal, &pty.Winsize{Cols: cols, Rows: rows})
}

func (s *session) stop() error {
	s.mu.RLock()
	process := s.process
	status := s.status
	s.mu.RUnlock()
	if process == nil || status != statusRunning {
		return nil
	}
	if err := syscall.Kill(-process.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		if killErr := process.Process.Kill(); killErr != nil {
			return fmt.Errorf("terminate process group: %v; kill process: %w", err, killErr)
		}
	}
	return nil
}

func (s *session) readLoop() {
	buffer := make([]byte, 32*1024)
	for {
		n, err := s.terminal.Read(buffer)
		if n > 0 {
			s.appendOutput(buffer[:n])
		}
		if err != nil {
			break
		}
	}
	status := statusExited
	exitCode := 0
	if waitErr := s.process.Wait(); waitErr != nil {
		status = statusFailed
		var exitErr *exec.ExitError
		if errors.As(waitErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
	}
	s.mu.Lock()
	if s.status == statusStopped {
		status = statusStopped
	}
	s.status = status
	s.exitCode = &exitCode
	terminal := s.terminal
	s.terminal = nil
	s.mu.Unlock()
	if terminal != nil {
		_ = terminal.Close()
	}
	s.publish(sessionEvent{Type: "status", Status: string(status)})
}

type createSessionRequest struct {
	Name    string   `json:"name"`
	Cwd     string   `json:"cwd"`
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Cols    uint16   `json:"cols"`
	Rows    uint16   `json:"rows"`
}

type sessionManager struct {
	mu          sync.RWMutex
	sessions    map[string]*session
	codexBin    string
	defaultCwd  string
	maxSessions int
	nextID      uint64
}

func newSessionManager(codexBin, defaultCwd string, maxSessions int) *sessionManager {
	return &sessionManager{
		sessions: make(map[string]*session), codexBin: codexBin,
		defaultCwd: defaultCwd, maxSessions: maxSessions,
	}
}

func (m *sessionManager) create(request createSessionRequest) (*session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.sessions) >= m.maxSessions {
		return nil, fmt.Errorf("maximum of %d sessions reached", m.maxSessions)
	}
	command := strings.TrimSpace(request.Command)
	if command == "" {
		command = m.codexBin
	}
	cwd := strings.TrimSpace(request.Cwd)
	if cwd == "" {
		cwd = m.defaultCwd
	}
	var err error
	cwd, err = filepath.Abs(cwd)
	if err != nil {
		return nil, fmt.Errorf("resolve cwd: %w", err)
	}
	stat, err := os.Stat(cwd)
	if err != nil || !stat.IsDir() {
		return nil, fmt.Errorf("cwd is not a directory: %s", cwd)
	}
	if strings.ContainsRune(command, '\x00') {
		return nil, errors.New("command contains NUL")
	}
	for _, arg := range request.Args {
		if strings.ContainsRune(arg, '\x00') {
			return nil, errors.New("argument contains NUL")
		}
	}
	cols, rows := request.Cols, request.Rows
	if cols == 0 {
		cols = defaultCols
	}
	if rows == 0 {
		rows = defaultRows
	}
	if cols < 20 || cols > 500 || rows < 5 || rows > 200 {
		return nil, errors.New("terminal size must be between 20x5 and 500x200")
	}
	m.nextID++
	id := fmt.Sprintf("session-%d", m.nextID)
	name := strings.TrimSpace(request.Name)
	if name == "" {
		name = id
	}
	commandArgs := append([]string(nil), request.Args...)
	if isCodexCommand(command, m.codexBin) && !containsArg(commandArgs, "--no-alt-screen") {
		commandArgs = append([]string{"--no-alt-screen"}, commandArgs...)
	}
	makeCommand := func(withProcessGroup bool) *exec.Cmd {
		cmd := exec.Command(command, commandArgs...)
		cmd.Dir = cwd
		cmd.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=true")
		if withProcessGroup {
			cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Setpgid: true}
		}
		return cmd
	}
	cmd := makeCommand(true)
	terminal, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	// Some restricted containers disallow creating a new process group. A
	// regular PTY still preserves CLI behavior there; stop() falls back to the
	// individual process when group signalling is unavailable.
	if err != nil && errors.Is(err, syscall.EPERM) {
		cmd = makeCommand(false)
		terminal, err = pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	}
	if err != nil {
		return nil, fmt.Errorf("start %s: %w", command, err)
	}
	item := &session{
		id: id, name: name, command: command, args: commandArgs, cwd: cwd,
		status: statusRunning, pid: cmd.Process.Pid, createdAt: time.Now().UTC(),
		cols: cols, rows: rows, terminal: terminal, process: cmd,
		subscribers: make(map[chan sessionEvent]struct{}),
	}
	m.sessions[id] = item
	go item.readLoop()
	return item, nil
}

func isCodexCommand(command, configured string) bool {
	return filepath.Base(command) == filepath.Base(configured) || filepath.Base(command) == "codex"
}

func containsArg(args []string, target string) bool {
	for _, arg := range args {
		if arg == target {
			return true
		}
	}
	return false
}

func (m *sessionManager) list() []sessionView {
	m.mu.RLock()
	defer m.mu.RUnlock()
	views := make([]sessionView, 0, len(m.sessions))
	for _, item := range m.sessions {
		views = append(views, item.view())
	}
	return views
}

func (m *sessionManager) get(id string) (*session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	item, ok := m.sessions[id]
	return item, ok
}

func (m *sessionManager) stop(id string) error {
	item, ok := m.get(id)
	if !ok {
		return os.ErrNotExist
	}
	if err := item.stop(); err != nil {
		return err
	}
	item.mu.Lock()
	if item.status == statusRunning {
		item.status = statusStopped
	}
	item.mu.Unlock()
	return nil
}

func (m *sessionManager) remove(id string) error {
	_, ok := m.get(id)
	if !ok {
		return os.ErrNotExist
	}
	if err := m.stop(id); err != nil {
		return err
	}
	m.mu.Lock()
	delete(m.sessions, id)
	m.mu.Unlock()
	return nil
}

func (m *sessionManager) stopAll(ctx context.Context) {
	m.mu.RLock()
	items := make([]*session, 0, len(m.sessions))
	for _, item := range m.sessions {
		items = append(items, item)
	}
	m.mu.RUnlock()
	for _, item := range items {
		_ = item.stop()
	}
	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
	}
}
