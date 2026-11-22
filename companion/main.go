// Chest Log Companion lets the Chest Log website read Fortnite replay files.
// Browsers will not let a website keep access to the AppData folder, so this
// program reads the replay folder and serves the files to the website over 127.0.0.1.
package main

import (
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const (
	port       = "47811"
	listenAddr = "127.0.0.1:" + port
)

// version is set at build time: go build -ldflags "-X main.version=1.2.3".
var version = "0.0.0-dev"

func main() {
	folder, err := demosFolder()
	if err != nil {
		fatal(err.Error())
	}
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		fatal("Chest Log Companion could not start because port " + port +
			" is in use. It is most likely already running; look for its icon near the clock.")
	}
	srv := &http.Server{Handler: newHandler(folder, version), ReadHeaderTimeout: 10 * time.Second}
	go func() { fatal("Chest Log Companion stopped: " + srv.Serve(listener).Error()) }()
	runApp(folder)
}

// demosFolder is where Fortnite saves replays. CHESTLOG_DEMOS overrides it so the
// program can be tried on a system without Fortnite.
func demosFolder() (string, error) {
	if dir := os.Getenv("CHESTLOG_DEMOS"); dir != "" {
		return filepath.Abs(dir)
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return "", errors.New("LOCALAPPDATA is not set. Set CHESTLOG_DEMOS to a folder of .replay files to run this program elsewhere.")
	}
	return filepath.Abs(filepath.Join(localAppData, "FortniteGame", "Saved", "Demos"))
}
