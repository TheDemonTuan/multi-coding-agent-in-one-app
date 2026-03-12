package main

import (
	"embed"
	"os"
	"runtime"
	"runtime/debug"

	"tdt-space/internal/services"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

// IsDev returns true if the application is running in development mode
// Wails v3 sets DEV=true when running in development mode via `wails3 dev`
func IsDev() bool {
	return os.Getenv("DEV") == "true"
}

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
	app := NewApp(terminalSvc, storeSvc, systemSvc, workspaceSvc, templateSvc, terminalHistorySvc, vietnameseIMESvc)

	// Determine frameless mode (Windows uses custom title bar)
	frameless := runtime.GOOS == "windows"

	// Build asset options - only embed in production mode
	// In dev mode, Wails uses the Vite dev server URL from wails.json
	isDev := IsDev()
	var assetOptions application.AssetOptions
	if !isDev {
		assetOptions = application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		}
	}

	// Create the Wails application
	wailsApp := application.New(application.Options{
		Name:        "TDT Space",
		Description: "Multi-Agent Terminal for TDT Vibe Coding",
		Services: []application.Service{
			application.NewService(app),
			application.NewService(terminalSvc),
			application.NewService(workspaceSvc),
			application.NewService(templateSvc),
			application.NewService(storeSvc),
			application.NewService(systemSvc),
			application.NewService(vietnameseIMESvc),
			application.NewService(terminalHistorySvc),
		},
		Assets: assetOptions,
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create the main window
	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "TDT Space",
		Width:            1400,
		Height:           900,
		MinWidth:         800,
		MinHeight:        600,
		Frameless:        frameless,
		BackgroundColour: application.NewRGB(30, 30, 46),
		URL:              "/",
	})

	// Maximize window on startup
	window.Maximise()

	// Set up menu using the application's Menu manager
	wailsApp.Menu.SetApplicationMenu(buildMenu(app))

	// Run the application
	err := wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
