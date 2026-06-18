package main

import (
	"context"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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

// configPath returns the path to the appearance settings file in the app's
// config directory.
func configPath() (string, error) { return appFilePath("config.json") }

// htmlFilter is the file-type filter for the save/open dialogs. Documents are
// self-contained HTML (see the frontend's compile/decompile).
var htmlFilter = runtime.FileFilter{
	DisplayName: "HTML Document (*.html)",
	Pattern:     "*.html;*.htm",
}

// SaveDialog shows a native "save as" dialog and returns the chosen path, or an
// empty string if the user cancels.
func (a *App) SaveDialog(defaultName string) (string, error) {
	home, _ := os.UserHomeDir()
	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:                "Save document",
		DefaultFilename:      defaultName,
		DefaultDirectory:     home,
		CanCreateDirectories: true,
		Filters:              []runtime.FileFilter{htmlFilter},
	})
}

// OpenDialog shows a native "open file" dialog and returns the chosen path, or
// an empty string if the user cancels.
func (a *App) OpenDialog() (string, error) {
	home, _ := os.UserHomeDir()
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Open document",
		DefaultDirectory: home,
		Filters: []runtime.FileFilter{
			htmlFilter,
			{DisplayName: "All files (*)", Pattern: "*"},
		},
	})
}

// WriteDocument writes the compiled HTML document to the given path.
func (a *App) WriteDocument(path, content string) error {
	return os.WriteFile(path, []byte(content), 0o644)
}

// ReadDocument returns the contents of the file at the given path.
func (a *App) ReadDocument(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ConfirmDiscard asks the user whether to discard unsaved changes, returning
// true only if they explicitly confirm.
func (a *App) ConfirmDiscard() (bool, error) {
	result, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Unsaved changes",
		Message:       "Discard unsaved changes?",
		Buttons:       []string{"Discard", "Cancel"},
		DefaultButton: "Cancel",
		CancelButton:  "Cancel",
	})
	if err != nil {
		return false, err
	}
	// On Linux/GTK a QuestionDialog ignores the custom Buttons and shows native
	// Yes/No, returning "Yes"/"No"; macOS/Windows return our own labels. Accept
	// either affirmative.
	return result == "Discard" || result == "Yes", nil
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
