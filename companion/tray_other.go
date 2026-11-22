//go:build !windows

package main

import (
	"fmt"
	"os"
)

// Without a tray the program is just the server, so it can be run and tested on any system.
func runApp(folder string) {
	fmt.Printf("Chest Log Companion %s is sharing %s on http://%s\n", version, folder, listenAddr)
	select {}
}

func fatal(message string) {
	fmt.Println(message)
	os.Exit(1)
}
