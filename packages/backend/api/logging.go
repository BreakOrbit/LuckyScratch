package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(data []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(data)
	r.bytes += n
	return n, err
}

func (s *Server) withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: w}

		next.ServeHTTP(recorder, r)

		status := recorder.status
		if status == 0 {
			status = http.StatusOK
		}
		log.Printf(
			"api request method=%s path=%s status=%d bytes=%d duration=%s remote=%s cf_ray=%s",
			r.Method,
			r.URL.EscapedPath(),
			status,
			recorder.bytes,
			time.Since(startedAt).Round(time.Millisecond),
			clientIP(r),
			r.Header.Get("CF-Ray"),
		)
	})
}

func logServiceError(status int, err error) {
	log.Printf("api service error status=%d err=%v", status, err)
}

func logAPIEvent(event string, fields ...any) {
	parts := []string{"api", "event=" + event}
	for i := 0; i+1 < len(fields); i += 2 {
		key := fmt.Sprint(fields[i])
		value := fmt.Sprint(fields[i+1])
		if strings.TrimSpace(key) == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%q", key, value))
	}
	log.Print(strings.Join(parts, " "))
}

func clientIP(r *http.Request) string {
	if value := r.Header.Get("CF-Connecting-IP"); value != "" {
		return value
	}
	if value := r.Header.Get("X-Forwarded-For"); value != "" {
		return value
	}
	return r.RemoteAddr
}
