package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

const (
	siteOrigin = "https://fortnite-chestcounter.vercel.app"
	validHost  = "127.0.0.1:" + port
)

type request struct {
	method, path, host, origin string
}

func (q request) do(h http.Handler) *httptest.ResponseRecorder {
	if q.method == "" {
		q.method = http.MethodGet
	}
	if q.host == "" {
		q.host = validHost
	}
	req := httptest.NewRequest(q.method, q.path, nil)
	req.Host = q.host
	if q.origin != "" {
		req.Header.Set("Origin", q.origin)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func writeFile(t *testing.T, path, content string, modified time.Time) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, modified, modified); err != nil {
		t.Fatal(err)
	}
}

// demosFixture builds a Demos folder holding two replays and a few things that
// must not be shared, next to a secret file one level above it.
func demosFixture(t *testing.T) (folder string, h http.Handler) {
	t.Helper()
	root := t.TempDir()
	folder = filepath.Join(root, "Demos")
	modified := time.Date(2026, 11, 21, 22, 39, 11, 0, time.UTC)

	writeFile(t, filepath.Join(root, "secret.replay"), "TOP SECRET", modified)
	writeFile(t, filepath.Join(folder, "UnsavedReplay-2026.11.21-22.39.11.replay"), "replay one", modified)
	writeFile(t, filepath.Join(folder, "Saved-Match.REPLAY"), "replay two!", modified)
	writeFile(t, filepath.Join(folder, "notes.txt"), "not a replay", modified)
	writeFile(t, filepath.Join(folder, "a..b.replay"), "odd name", modified)
	writeFile(t, filepath.Join(folder, "folder.replay", "inside.replay"), "in a directory named like a replay", modified)
	writeFile(t, filepath.Join(folder, "sub", "nested.replay"), "in a subfolder", modified)
	if err := os.Symlink(filepath.Join(root, "secret.replay"), filepath.Join(folder, "link.replay")); err != nil {
		t.Logf("symlink not available, skipping that fixture: %v", err)
	}

	t.Setenv("CHESTLOG_DEMOS", folder)
	got, err := demosFolder()
	if err != nil {
		t.Fatal(err)
	}
	return got, newHandler(got, "1.2.3")
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %v\n%s", err, rec.Body)
	}
	return body
}

func TestOriginAllowlist(t *testing.T) {
	cases := map[string]bool{
		siteOrigin: true,
		"https://chestcounter-git-feature-abe54s-projects.vercel.app": true,
		"https://chestcounter-9x7k2-abe54s-projects.vercel.app":       true,
		"http://127.0.0.1:4180": true,
		"http://localhost:5173": true,
		"http://localhost:80":   true,

		"https://evil.com": false,
		"https://chestcounter-x-abe54s-projects.vercel.app.evil.com": false,
		"https://evil.com/https://fortnite-chestcounter.vercel.app":  false,
		"http://fortnite-chestcounter.vercel.app":                    false,
		"https://fortnite-chestcounter.vercel.app.evil.com":          false,
		"https://xfortnite-chestcounter.vercel.app":                  false,
		"https://fortnite-chestcounter.vercel.app/":                  false,
		"https://chestcounter-X-abe54s-projects.vercel.app":          false,
		"https://chestcounter-x-someone-projects.vercel.app":         false,
		"http://localhost":             false,
		"http://localhost.evil.com:80": false,
		"https://localhost:5173":       false,
		"http://127.0.0.1.evil.com:80": false,
		"null":                         false,
		"":                             false,
	}
	for origin, want := range cases {
		if got := originAllowed(origin); got != want {
			t.Errorf("originAllowed(%q) = %v, want %v", origin, got, want)
		}
	}
}

func TestHostGuard(t *testing.T) {
	_, h := demosFixture(t)
	cases := map[string]int{
		"127.0.0.1:47811": http.StatusOK,
		"localhost:47811": http.StatusOK,
		"LOCALHOST:47811": http.StatusOK,
		"evil.com:47811":  http.StatusForbidden,
		"evil.com":        http.StatusForbidden,
		"127.0.0.1:8080":  http.StatusForbidden,
		"127.0.0.1":       http.StatusForbidden,
		"localhost":       http.StatusForbidden,
	}
	for host, want := range cases {
		rec := request{path: "/v1/status", host: host, origin: siteOrigin}.do(h)
		if rec.Code != want {
			t.Errorf("Host %q: status %d, want %d", host, rec.Code, want)
		}
		if want == http.StatusForbidden && rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Errorf("Host %q: refused request still carries CORS headers", host)
		}
	}
}

func TestStatus(t *testing.T) {
	folder, h := demosFixture(t)
	rec := request{path: "/v1/status"}.do(h)

	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("got %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	want := map[string]any{
		"app":          "chest-log-companion",
		"version":      "1.2.3",
		"folder":       folder,
		"folderExists": true,
		"replays":      float64(2),
	}
	if got := decode(t, rec); !reflect.DeepEqual(got, want) {
		t.Errorf("status body\n got %v\nwant %v", got, want)
	}
}

func TestListingSharesOnlyReplayFilesInTheFolder(t *testing.T) {
	_, h := demosFixture(t)
	rec := request{path: "/v1/replays"}.do(h)

	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("got %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	want := map[string]any{"replays": []any{
		map[string]any{"name": "Saved-Match.REPLAY", "size": float64(11), "modified": "2026-11-21T22:39:11Z"},
		map[string]any{"name": "UnsavedReplay-2026.11.21-22.39.11.replay", "size": float64(10), "modified": "2026-11-21T22:39:11Z"},
	}}
	if got := decode(t, rec); !reflect.DeepEqual(got, want) {
		t.Errorf("listing\n got %v\nwant %v", got, want)
	}
}

func TestMissingFolder(t *testing.T) {
	t.Setenv("CHESTLOG_DEMOS", filepath.Join(t.TempDir(), "does-not-exist"))
	folder, err := demosFolder()
	if err != nil {
		t.Fatal(err)
	}
	h := newHandler(folder, "1.2.3")

	status := decode(t, request{path: "/v1/status"}.do(h))
	if status["folderExists"] != false || status["replays"] != float64(0) {
		t.Errorf("status for a missing folder: %v", status)
	}
	if body := strings.TrimSpace((request{path: "/v1/replays"}).do(h).Body.String()); body != `{"replays":[]}` {
		t.Errorf("listing for a missing folder = %s", body)
	}
	if rec := (request{path: "/v1/replays/anything.replay"}).do(h); rec.Code != http.StatusNotFound {
		t.Errorf("file in a missing folder: status %d", rec.Code)
	}
}

func TestFileBytes(t *testing.T) {
	_, h := demosFixture(t)

	rec := request{path: "/v1/replays/UnsavedReplay-2026.11.21-22.39.11.replay"}.do(h)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if body := rec.Body.String(); body != "replay one" {
		t.Errorf("body = %q", body)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/octet-stream" {
		t.Errorf("Content-Type = %q", got)
	}
	if got := rec.Header().Get("Content-Length"); got != strconv.Itoa(len("replay one")) {
		t.Errorf("Content-Length = %q", got)
	}

	head := request{method: http.MethodHead, path: "/v1/replays/Saved-Match.REPLAY"}.do(h)
	if head.Code != http.StatusOK || head.Header().Get("Content-Length") != "11" {
		t.Errorf("HEAD: status %d, Content-Length %q", head.Code, head.Header().Get("Content-Length"))
	}
}

func TestOnlyListedNamesAreServed(t *testing.T) {
	_, h := demosFixture(t)

	refused := []string{
		"../secret.replay",
		"..%2Fsecret.replay",
		"%2E%2E%2Fsecret.replay",
		"..%5Csecret.replay",
		`..\secret.replay`,
		"%2Fetc%2Fpasswd.replay",
		"sub/nested.replay",
		"sub%2Fnested.replay",
		"folder.replay/inside.replay",
		"folder.replay",
		"link.replay",
		"C:secret.replay",
		"C%3A%5Csecret.replay",
		"a..b.replay",
		"notes.txt",
		"saved-match.replay", // the listing says Saved-Match.REPLAY
		"UnsavedReplay-2026.11.21-22.39.11.replay%00",
		"UnsavedReplay-2026.11.21-22.39.11.replay/",
		"UnsavedReplay-2026.11.21-22.39.11.replay.txt",
		"missing.replay",
		"",
	}
	for _, name := range refused {
		rec := request{path: "/v1/replays/" + name}.do(h)
		body, _ := io.ReadAll(rec.Body)
		if rec.Code != http.StatusNotFound || strings.Contains(string(body), "SECRET") {
			t.Errorf("GET /v1/replays/%s: status %d, body %q", name, rec.Code, body)
		}
	}
}

func TestOtherPathsAndMethods(t *testing.T) {
	_, h := demosFixture(t)

	for _, path := range []string{"/", "/v1", "/v1/", "/v1/status/", "/v1/replays/../status", "/v2/status", "/status"} {
		if rec := (request{path: path}).do(h); rec.Code != http.StatusNotFound {
			t.Errorf("GET %s: status %d, want 404", path, rec.Code)
		}
	}
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		rec := request{method: method, path: "/v1/replays/Saved-Match.REPLAY"}.do(h)
		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s: status %d, want 405", method, rec.Code)
		}
	}
}

func TestCORS(t *testing.T) {
	_, h := demosFixture(t)

	t.Run("allowed origin is echoed on a GET", func(t *testing.T) {
		rec := request{path: "/v1/status", origin: siteOrigin}.do(h)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != siteOrigin {
			t.Errorf("Access-Control-Allow-Origin = %q", got)
		}
		if got := rec.Header().Get("Vary"); got != "Origin" {
			t.Errorf("Vary = %q", got)
		}
	})

	t.Run("allowed origin gets a full preflight answer", func(t *testing.T) {
		for _, origin := range []string{siteOrigin, "http://localhost:5173", "https://chestcounter-abc123-abe54s-projects.vercel.app"} {
			rec := request{method: http.MethodOptions, path: "/v1/replays", origin: origin}.do(h)
			want := map[string]string{
				"Access-Control-Allow-Origin":          origin,
				"Vary":                                 "Origin",
				"Access-Control-Allow-Methods":         "GET, HEAD, OPTIONS",
				"Access-Control-Allow-Headers":         "*",
				"Access-Control-Allow-Private-Network": "true",
			}
			if rec.Code != http.StatusNoContent {
				t.Errorf("%s: preflight status %d", origin, rec.Code)
			}
			for name, value := range want {
				if got := rec.Header().Get(name); got != value {
					t.Errorf("%s: %s = %q, want %q", origin, name, got, value)
				}
			}
		}
	})

	t.Run("other origins get no CORS headers", func(t *testing.T) {
		for _, origin := range []string{"https://evil.com", "http://fortnite-chestcounter.vercel.app", "https://chestcounter-x-abe54s-projects.vercel.app.evil.com", ""} {
			for _, method := range []string{http.MethodGet, http.MethodOptions} {
				rec := request{method: method, path: "/v1/status", origin: origin}.do(h)
				for name := range rec.Header() {
					if strings.HasPrefix(name, "Access-Control-") || name == "Vary" {
						t.Errorf("%s with Origin %q: unexpected header %s", method, origin, name)
					}
				}
			}
		}
	})
}

func TestDemosFolder(t *testing.T) {
	t.Run("CHESTLOG_DEMOS wins", func(t *testing.T) {
		dir := t.TempDir()
		t.Setenv("CHESTLOG_DEMOS", dir)
		t.Setenv("LOCALAPPDATA", "ignored")
		if got, err := demosFolder(); err != nil || got != dir {
			t.Errorf("got %q, %v", got, err)
		}
	})
	t.Run("Fortnite's folder under LOCALAPPDATA", func(t *testing.T) {
		local := t.TempDir()
		t.Setenv("CHESTLOG_DEMOS", "")
		t.Setenv("LOCALAPPDATA", local)
		want := filepath.Join(local, "FortniteGame", "Saved", "Demos")
		if got, err := demosFolder(); err != nil || got != want {
			t.Errorf("got %q, %v, want %q", got, err, want)
		}
	})
	t.Run("neither is set", func(t *testing.T) {
		t.Setenv("CHESTLOG_DEMOS", "")
		t.Setenv("LOCALAPPDATA", "")
		if _, err := demosFolder(); err == nil {
			t.Error("expected an error")
		}
	})
}
