package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tdt-opencode-go-proxy/config"
	"tdt-opencode-go-proxy/middleware"
	"tdt-opencode-go-proxy/proxy"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func main() {
	cfg := config.Load()
	setupLogging(cfg.LogLevel, cfg.LogFile)

	logrus.WithFields(logrus.Fields{
		"port":     cfg.Port,
		"base_url": cfg.BaseURL,
	}).Info("Starting OpenCode Go Proxy Server (Optimized)")

	r := setupRouter(cfg)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  cfg.RequestTimeout,
		WriteTimeout: cfg.RequestTimeout,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Fatalf("Failed to start server: %v", err)
		}
	}()

	logrus.Infof("Server is running on http://localhost:%d", cfg.Port)
	logrus.Infof("Optimizations enabled:")
	logrus.Infof("  - Deduplication: %v", cfg.EnableDeduplication)
	logrus.Infof("  - Caching: %v", cfg.EnableCaching)
	logrus.Infof("  - Retry: %v (max: %d)", cfg.EnableRetry, cfg.MaxRetries)
	logrus.Infof("  - Rate Limit: %.1f RPS", cfg.RateLimitRPS)
	logrus.Infof("  - Max Concurrent: %d", cfg.MaxConcurrentRequests)
	logrus.Infof("API endpoints:")
	logrus.Infof("  - POST /v1/chat/completions (OpenAI-compatible)")
	logrus.Infof("  - POST /v1/messages (Anthropic-compatible)")
	logrus.Infof("  - GET  /v1/models")
	logrus.Infof("  - GET  /health")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logrus.WithError(err).Fatal("Server forced to shutdown")
	}

	logrus.Info("Server exited")
}

func setupRouter(cfg *config.Config) *gin.Engine {
	if cfg.LogLevel == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS())

	if cfg.LogLevel == "debug" {
		r.Use(middleware.Logger())
	}

	proxyClient := proxy.NewClient(cfg)
	apiKeyMiddleware := middleware.NewAPIKey(cfg)

	r.Use(middleware.RateLimit(cfg.RateLimitRPS, cfg.RateLimitBurst))
	r.Use(middleware.ConcurrencyLimit(int64(cfg.MaxConcurrentRequests)))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"version":   "1.1.0",
			"timestamp": time.Now().Unix(),
			"optimizations": gin.H{
				"deduplication": cfg.EnableDeduplication,
				"caching":       cfg.EnableCaching,
				"retry":         cfg.EnableRetry,
				"rate_limit":    cfg.RateLimitRPS,
			},
		})
	})

	api := r.Group("/v1")
	{
		api.Use(apiKeyMiddleware.Middleware())

		api.GET("/models", middleware.CacheResponse(), handleModels)

		api.POST("/chat/completions", proxyClient.HandleChatCompletions)
		api.POST("/messages", proxyClient.HandleMessages)
		api.POST("/messages/count_tokens", proxyClient.HandleCountTokens)
	}

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":        "OpenCode Go Proxy",
			"version":     "1.1.0",
			"description": "Optimized proxy server for OpenCode Go API",
			"endpoints": []string{
				"/v1/chat/completions",
				"/v1/messages",
				"/v1/models",
				"/health",
			},
			"optimizations": gin.H{
				"deduplication":   cfg.EnableDeduplication,
				"caching":         cfg.EnableCaching,
				"retry":           cfg.EnableRetry,
				"rate_limit_rps":  cfg.RateLimitRPS,
				"max_concurrent":  cfg.MaxConcurrentRequests,
				"request_timeout": cfg.RequestTimeout.String(),
				"dial_timeout":    cfg.DialTimeout.String(),
			},
		})
	})

	return r
}

func handleModels(c *gin.Context) {
	models := []map[string]interface{}{
		{
			"id":       "opencode-go/glm-5",
			"object":   "model",
			"created":  1704067200,
			"owned_by": "opencode-go",
		},
		{
			"id":       "opencode-go/kimi-k2.5",
			"object":   "model",
			"created":  1704067200,
			"owned_by": "opencode-go",
		},
		{
			"id":       "opencode-go/minimax-m2.5",
			"object":   "model",
			"created":  1704067200,
			"owned_by": "opencode-go",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}

func setupLogging(level, logFile string) {
	lvl, err := logrus.ParseLevel(level)
	if err != nil {
		lvl = logrus.InfoLevel
	}
	logrus.SetLevel(lvl)

	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})

	if logFile != "" {
		f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			logrus.WithError(err).Warn("Failed to open log file, using stdout")
		} else {
			logrus.SetOutput(f)
		}
	}
}
