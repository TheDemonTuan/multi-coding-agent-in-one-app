package main

import (
	"embed"
	"runtime"
	"runtime/debug"

	"tdt-space/internal/services"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// Optimize Go runtime memory management to reduce startup memory spike
	// Run GC more aggressively (default is 100, we use 20 for lower memory footprint)
	debug.SetGCPercent(20)
	
	// Set memory limit to prevent excessive allocation during startup
	// 512MB soft limit helps control initial memory spike
	debug.SetMemoryLimit(512 * 1024 * 1024)
	
	// Reduce number of OS threads for goroutines (default is GOMAXPROCS)
	// This helps reduce memory overhead from too many concurrent threads
	runtime.GOMAXPROCS(runtime.NumCPU())
}

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
	app := NewApp(terminalSvc, storeSvc, systemSvc, vietnameseIMESvc)

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
			OpenInspectorOnStartup: false,
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
