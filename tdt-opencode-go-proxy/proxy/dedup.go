package proxy

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/cespare/xxhash/v2"
	"golang.org/x/sync/singleflight"
)

type DeduplicationConfig struct {
	Enabled         bool
	TTL             time.Duration
	EnableStreaming bool
}

type Deduplicator struct {
	group  singleflight.Group
	config *DeduplicationConfig
}

type dedupResponse struct {
	Response *http.Response
	Error    error
}

func NewDeduplicator(config *DeduplicationConfig) *Deduplicator {
	if config.TTL == 0 {
		config.TTL = 30 * time.Second
	}
	return &Deduplicator{
		config: config,
	}
}

func (d *Deduplicator) Do(ctx context.Context, key string, fn func() (*http.Response, error)) (*http.Response, error) {
	if !d.config.Enabled {
		return fn()
	}

	result, err, _ := d.group.Do(key, func() (interface{}, error) {
		return fn()
	})

	if err != nil {
		return nil, err
	}

	resp := result.(*http.Response)
	if resp == nil {
		return nil, nil
	}

	return resp, nil
}

func (d *Deduplicator) DoHash(ctx context.Context, body []byte, endpoint string, fn func() (*http.Response, error)) (*http.Response, error) {
	key := GenerateRequestHash(body, endpoint)
	return d.Do(ctx, key, fn)
}

func GenerateRequestHash(body []byte, endpoint string) string {
	hasher := xxhash.New()
	hasher.Write([]byte(endpoint))
	hasher.Write(body)
	return hex.EncodeToString(hasher.Sum(nil))
}

func HashRequest(body []byte) string {
	h := sha256.New()
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}

type RequestHasher struct{}

func (rh *RequestHasher) HashRequest(body io.Reader) (string, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	return HashRequest(data), nil
}

type StreamDedupConfig struct {
	Enabled bool
}

type StreamDeduplicator struct {
	group  singleflight.Group
	config *StreamDedupConfig
}

func NewStreamDeduplicator(config *StreamDedupConfig) *StreamDeduplicator {
	return &StreamDeduplicator{
		config: config,
	}
}

type streamResult struct {
	Body   io.Reader
	Status int
	Header http.Header
	Error  error
}

func (sd *StreamDeduplicator) Do(ctx context.Context, key string, fn func() (*http.Response, error)) *streamResult {
	result, err, _ := sd.group.Do(key, func() (interface{}, error) {
		resp, err := fn()
		if err != nil {
			return nil, err
		}
		return &streamResult{
			Body:   resp.Body,
			Status: resp.StatusCode,
			Header: resp.Header,
		}, nil
	})

	if err != nil {
		return &streamResult{Error: err}
	}

	return result.(*streamResult)
}

func CreateRequestKey(method, endpoint string, body []byte) string {
	hasher := xxhash.New()
	hasher.Write([]byte(method))
	hasher.Write([]byte(endpoint))
	hasher.Write(body)
	return hex.EncodeToString(hasher.Sum(nil))
}

type RequestKeyBuilder struct{}

func (rkb *RequestKeyBuilder) Build(method, endpoint string, body []byte, params map[string]string) string {
	hasher := xxhash.New()
	hasher.Write([]byte(method))
	hasher.Write([]byte(endpoint))
	if len(body) > 0 {
		hasher.Write(body)
	}
	for k, v := range params {
		hasher.Write([]byte(k))
		hasher.Write([]byte(v))
	}
	return hex.EncodeToString(hasher.Sum(nil))
}

func CopyBody(body io.Reader) (io.Reader, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func BodyMatches(body1, body2 []byte) bool {
	return bytes.Equal(body1, body2)
}

func MustMarshal(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}

type dedupStats struct {
	Requests   int64
	Duplicates int64
	Hits       int64
}

var stats dedupStats

func GetStats() dedupStats {
	return stats
}

func recordDuplicate() {
	stats.Duplicates++
}

func recordRequest() {
	stats.Requests++
}
