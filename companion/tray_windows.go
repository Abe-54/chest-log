//go:build windows

package main

import (
	_ "embed"
	"fmt"
	"os"
	"time"

	"fyne.io/systray"
	"golang.org/x/sys/windows"
)

const (
	appName   = "Chest Log Companion"
	siteURL   = "https://fortnite-chestcounter.vercel.app/app/"
	sourceURL = "https://github.com/Abe-54/chest-log/tree/main/companion"
)

//go:embed icon.ico
var icon []byte

func runApp(folder string) {
	applyStartupDefault()
	systray.Run(func() { onReady(folder) }, nil)
}

func onReady(folder string) {
	setTrayIcon()
	systray.SetTooltip(appName)

	status := systray.AddMenuItem("", "")
	status.Disable()
	systray.AddSeparator()
	openSite := systray.AddMenuItem("Open Chest Log", "")
	openFolder := systray.AddMenuItem("Open replay folder", "")
	startup := systray.AddMenuItemCheckbox("Start with Windows", "", autostartEnabled())
	systray.AddSeparator()
	viewSource := systray.AddMenuItem("View source code", "")
	quit := systray.AddMenuItem("Quit", "")

	refresh := func() {
		replays, err := listReplays(folder)
		status.SetTitle(statusLine(len(replays), err == nil))
		if err == nil {
			openFolder.Enable()
		} else {
			openFolder.Disable()
		}
	}
	refresh()
	tick := time.NewTicker(5 * time.Second)

	for {
		select {
		case <-tick.C:
			refresh()
		case <-openSite.ClickedCh:
			shellOpen(siteURL)
		case <-openFolder.ClickedCh:
			shellOpen(folder)
		case <-viewSource.ClickedCh:
			shellOpen(sourceURL)
		case <-startup.ClickedCh:
			on := !startup.Checked()
			if err := setAutostart(on); err != nil {
				messageBox("Could not change the startup setting: "+err.Error(), windows.MB_ICONWARNING)
			} else if on {
				startup.Check()
			} else {
				startup.Uncheck()
			}
		case <-quit.ClickedCh:
			systray.Quit()
			return
		}
	}
}

func statusLine(replays int, folderExists bool) string {
	switch {
	case !folderExists:
		return "Fortnite replay folder not found"
	case replays == 1:
		return "Sharing 1 replay with Chest Log"
	default:
		return fmt.Sprintf("Sharing %d replays with Chest Log", replays)
	}
}

// The tray library loads icons only from a file, so the icon takes a short trip
// through the temp folder. Windows keeps the loaded icon, so the file is deleted at once.
func setTrayIcon() {
	f, err := os.CreateTemp("", "chestlog-*.ico")
	if err != nil {
		return
	}
	path := f.Name()
	_, err = f.Write(icon)
	f.Close()
	if err == nil {
		systray.SetIconFromFilePath(path)
	}
	os.Remove(path)
}

func shellOpen(target string) {
	verb, _ := windows.UTF16PtrFromString("open")
	file, err := windows.UTF16PtrFromString(target)
	if err != nil {
		return
	}
	windows.ShellExecute(0, verb, file, nil, nil, windows.SW_SHOWNORMAL)
}

func messageBox(text string, style uint32) {
	body, _ := windows.UTF16PtrFromString(text)
	title, _ := windows.UTF16PtrFromString(appName)
	windows.MessageBox(0, body, title, windows.MB_OK|style)
}

func fatal(message string) {
	messageBox(message, windows.MB_ICONERROR)
	os.Exit(1)
}
