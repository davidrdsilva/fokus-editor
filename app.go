package main

import (
	"context"
	"os"
	"path/filepath"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// documentPath returns the path to the single internal document file, creating
// its containing directory if needed. It lives under the OS user config dir
// (~/.config on Linux, Application Support on macOS, AppData on Windows).
func documentPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "fokus-editor")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "document.html"), nil
}

// SaveDocument persists the given compiled HTML document to the internal store,
// overwriting any previous save.
func (a *App) SaveDocument(content string) error {
	path, err := documentPath()
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// LoadDocument returns the previously saved HTML document, or an empty string
// if nothing has been saved yet.
func (a *App) LoadDocument() (string, error) {
	path, err := documentPath()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}
