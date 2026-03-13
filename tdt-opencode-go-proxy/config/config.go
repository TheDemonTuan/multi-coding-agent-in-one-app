package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

type Config struct {
	Port     int
	APIKey   string
	BaseURL  string
	LogLevel string
	LogFile  string

	RequestTimeout        time.Duration
	DialTimeout           time.Duration
	TLSHandshakeTimeout   time.Duration
	ResponseHeaderTimeout time.Duration

	MaxConcurrentRequests int
	RateLimitRPS          float64
	RateLimitBurst        int

	EnableDeduplication bool
	DeduplicationTTL    time.Duration

	EnableCaching bool
	CacheTTL      time.Duration

	EnableRetry         bool
	MaxRetries          int
	RetryInitialBackoff time.Duration
	RetryMaxBackoff     time.Duration
	RetryMultiplier     float64
}

func Load() *Config {
	loadEnvFile()

	cfg := &Config{
		Port:     getEnvInt("OPENCODE_PROXY_PORT", 8080),
		APIKey:   getEnvString("OPENCODE_API_KEY", ""),
		BaseURL:  getEnvString("OPENCODE_BASE_URL", "https://opencode.ai/zen/go"),
		LogLevel: getEnvString("OPENCODE_PROXY_LOG_LEVEL", "info"),
		LogFile:  getEnvString("OPENCODE_PROXY_LOG_FILE", ""),

		RequestTimeout:        getEnvDuration("OPENCODE_REQUEST_TIMEOUT", 120*time.Second),
		DialTimeout:           getEnvDuration("OPENCODE_DIAL_TIMEOUT", 30*time.Second),
		TLSHandshakeTimeout:   getEnvDuration("OPENCODE_TLS_HANDSHAKE_TIMEOUT", 10*time.Second),
		ResponseHeaderTimeout: getEnvDuration("OPENCODE_RESPONSE_HEADER_TIMEOUT", 10*time.Second),

		MaxConcurrentRequests: getEnvInt("OPENCODE_MAX_CONCURRENT_REQUESTS", 50),
		RateLimitRPS:          getEnvFloat("OPENCODE_RATE_LIMIT_RPS", 100),
		RateLimitBurst:        getEnvInt("OPENCODE_RATE_LIMIT_BURST", 200),

		EnableDeduplication: getEnvBool("OPENCODE_ENABLE_DEDUPLICATION", true),
		DeduplicationTTL:    getEnvDuration("OPENCODE_DEDUP_TTL", 30*time.Second),

		EnableCaching: getEnvBool("OPENCODE_ENABLE_CACHING", true),
		CacheTTL:      getEnvDuration("OPENCODE_CACHE_TTL", 5*time.Minute),

		EnableRetry:         getEnvBool("OPENCODE_ENABLE_RETRY", true),
		MaxRetries:          getEnvInt("OPENCODE_MAX_RETRIES", 3),
		RetryInitialBackoff: getEnvDuration("OPENCODE_RETRY_INITIAL_BACKOFF", 500*time.Millisecond),
		RetryMaxBackoff:     getEnvDuration("OPENCODE_RETRY_MAX_BACKOFF", 5*time.Second),
		RetryMultiplier:     getEnvFloat("OPENCODE_RETRY_MULTIPLIER", 2.0),
	}

	if cfg.APIKey == "" {
		logrus.Fatal("OPENCODE_API_KEY is required. Please set it in .env file or environment variable.")
	}

	logrus.Infof("Configuration loaded:")
	logrus.Infof("  - Request timeout: %v", cfg.RequestTimeout)
	logrus.Infof("  - Max concurrent requests: %d", cfg.MaxConcurrentRequests)
	logrus.Infof("  - Rate limit: %.1f RPS (burst: %d)", cfg.RateLimitRPS, cfg.RateLimitBurst)
	logrus.Infof("  - Deduplication: %v", cfg.EnableDeduplication)
	logrus.Infof("  - Caching: %v", cfg.EnableCaching)
	logrus.Infof("  - Retry: %v (max: %d)", cfg.EnableRetry, cfg.MaxRetries)

	return cfg
}

func loadEnvFile() {
	paths := []string{
		".env",
		".env.local",
	}

	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		paths = append(paths,
			filepath.Join(execDir, ".env"),
			filepath.Join(execDir, ".env.local"),
		)
	}

	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			logrus.Infof("Loaded environment from: %s", path)
			return
		}
	}
}

func (c *Config) IsValid() bool {
	return c.APIKey != "" && c.Port > 0 && c.Port < 65536
}

func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			return floatVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if strings.ToLower(value) == "true" {
			return true
		}
		if strings.ToLower(value) == "false" {
			return false
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
