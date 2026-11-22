package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// Only pages served from these origins may read the replays through a browser.
// Any other origin gets no CORS headers, so the browser keeps the answer from the page.
var allowedOrigins = []*regexp.Regexp{
	// The Chest Log site.
	regexp.MustCompile(`^https://fortnite-chestcounter\.vercel\.app$`),
	// Vercel preview deployments of the site.
	regexp.MustCompile(`^https://chestcounter-[a-z0-9-]+-abe54s-projects\.vercel\.app$`),
	// A copy of the site running on this PC, for development.
	regexp.MustCompile(`^http://(?:127\.0\.0\.1|localhost):[0-9]{1,5}$`),
}

func originAllowed(origin string) bool {
	return slices.ContainsFunc(allowedOrigins, func(re *regexp.Regexp) bool {
		return re.MatchString(origin)
	})
}

// A page on another site can point its own hostname at 127.0.0.1 (DNS rebinding).
// Its requests then carry that hostname in Host, which we refuse.
func hostAllowed(host string) bool {
	host = strings.ToLower(host)
	return host == "127.0.0.1:"+port || host == "localhost:"+port
}

func safeReplayName(name string) bool {
	return strings.HasSuffix(strings.ToLower(name), ".replay") &&
		!strings.ContainsAny(name, `/\:`) &&
		!strings.Contains(name, "..")
}

type replayInfo struct {
	Name     string    `json:"name"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

// listReplays returns the regular files directly inside folder that safeReplayName
// accepts, sorted by name. The list is never nil, so it encodes as [] and not null.
func listReplays(folder string) ([]replayInfo, error) {
	replays := []replayInfo{}
	entries, err := os.ReadDir(folder)
	if err != nil {
		return replays, err
	}
	for _, entry := range entries {
		if !entry.Type().IsRegular() || !safeReplayName(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue // removed since the folder was read
		}
		replays = append(replays, replayInfo{
			Name:     entry.Name(),
			Size:     info.Size(),
			Modified: info.ModTime().UTC().Truncate(time.Second),
		})
	}
	return replays, nil
}

type server struct {
	folder  string
	version string
}

func newHandler(folder, version string) http.Handler {
	return server{folder: folder, version: version}
}

func (s server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !hostAllowed(r.Host) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	header := w.Header()
	header.Set("Cache-Control", "no-store")
	if origin := r.Header.Get("Origin"); originAllowed(origin) {
		header.Set("Access-Control-Allow-Origin", origin)
		header.Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			header.Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			header.Set("Access-Control-Allow-Headers", "*")
			header.Set("Access-Control-Allow-Private-Network", "true")
		}
	}

	switch r.Method {
	case http.MethodOptions:
		w.WriteHeader(http.StatusNoContent)
	case http.MethodGet, http.MethodHead:
		s.route(w, r)
	default:
		header.Set("Allow", "GET, HEAD, OPTIONS")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s server) route(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	switch {
	case path == "/v1/status":
		s.status(w)
	case path == "/v1/replays":
		s.list(w)
	case strings.HasPrefix(path, "/v1/replays/"):
		s.file(w, r, strings.TrimPrefix(path, "/v1/replays/"))
	default:
		http.NotFound(w, r)
	}
}

func (s server) status(w http.ResponseWriter) {
	replays, err := listReplays(s.folder)
	writeJSON(w, struct {
		App          string `json:"app"`
		Version      string `json:"version"`
		Folder       string `json:"folder"`
		FolderExists bool   `json:"folderExists"`
		Replays      int    `json:"replays"`
	}{"chest-log-companion", s.version, s.folder, err == nil, len(replays)})
}

func (s server) list(w http.ResponseWriter) {
	replays, _ := listReplays(s.folder)
	writeJSON(w, struct {
		Replays []replayInfo `json:"replays"`
	}{replays})
}

// file serves name only when the listing contains it. The request's text is
// compared with names read from the folder and never turned into a path itself.
func (s server) file(w http.ResponseWriter, r *http.Request, name string) {
	replays, _ := listReplays(s.folder)
	if !slices.ContainsFunc(replays, func(replay replayInfo) bool { return replay.Name == name }) {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(filepath.Join(s.folder, name))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, name, time.Time{}, f)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
