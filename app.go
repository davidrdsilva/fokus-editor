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

// appFilePath returns the path to a named file in the app's config directory,
// creating the directory if needed. It lives under the OS user config dir
// (~/.config on Linux, Application Support on macOS, AppData on Windows).
func appFilePath(name string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "fokus-editor")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, name), nil
}

// documentPath returns the path to the single internal document file.
func documentPath() (string, error) { return appFilePath("document.html") }

// configPath returns the path to the appearance settings file, stored next to
// the document.
func configPath() (string, error) { return appFilePath("config.json") }

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

// SaveConfig persists the given appearance settings (a JSON string) to the
// internal store, overwriting any previous save.
func (a *App) SaveConfig(content string) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// LoadConfig returns the previously saved appearance settings as a JSON string,
// or an empty string if none have been saved yet (in which case the frontend
// falls back to the defaults in style.css).
func (a *App) LoadConfig() (string, error) {
	path, err := configPath()
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
