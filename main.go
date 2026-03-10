package main

import (
	"embed"
	"runtime"

	"tdt-space/internal/services"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create services (dependency order matters)
	storeSvc := services.NewStoreService()
	terminalSvc := services.NewTerminalService()
	workspaceSvc := services.NewWorkspaceService()
	templateSvc := services.NewTemplateService()
	terminalHistorySvc := services.NewTerminalHistoryService()
	systemSvc := services.NewSystemService()
	vietnameseIMESvc := services.NewVietnameseIMEService()

	// Wire dependencies
	workspaceSvc.Init(storeSvc, terminalSvc)
	templateSvc.Init(storeSvc)
	terminalHistorySvc.Init(storeSvc)
	vietnameseIMESvc.Init(storeSvc)

	// Create App and wire its services
	app := NewApp(terminalSvc, storeSvc, systemSvc)

	frameless := runtime.GOOS == "windows"

	windowsOpts := &windows.Options{
		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
		DisableWindowIcon:    false,
		IsZoomControlEnabled: false,
		DisablePinchZoom:     true,
	}

	err := wails.Run(&options.App{
		Title:  "TDT Space",
		Width:  1400,
		Height: 900,
		WindowStartState: options.Maximised,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 255},
		OnStartup:        app.startup,
		OnBeforeClose:    app.beforeClose,
		OnShutdown:       app.shutdown,
		Frameless:        frameless,
		MinWidth:         800,
		MinHeight:        600,
		Windows:          windowsOpts,
		Debug: options.Debug{
			OpenInspectorOnStartup: true,
		},
		Bind: []interface{}{
			app,
			terminalSvc,
			workspaceSvc,
			templateSvc,
			storeSvc,
			systemSvc,
			vietnameseIMESvc,
			terminalHistorySvc,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
