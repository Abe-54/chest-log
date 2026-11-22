//go:build windows

package main

import (
	"errors"
	"os"

	"golang.org/x/sys/windows/registry"
)

const (
	runKey    = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValue  = "ChestLogCompanion"
	ownKey    = `Software\ChestLogCompanion`
	askedFlag = "StartupAsked"
)

func autostartEnabled() bool {
	key, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()
	_, _, err = key.GetStringValue(runValue)
	return err == nil
}

func setAutostart(on bool) error {
	key, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	if !on {
		err := key.DeleteValue(runValue)
		if errors.Is(err, registry.ErrNotExist) {
			return nil
		}
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return key.SetStringValue(runValue, `"`+exe+`"`)
}

// applyStartupDefault turns Start with Windows on the first time the program
// runs. The flag in ownKey is what lets a later untick stay unticked. When the
// setting is on, it is written again so it follows the exe if it was moved.
func applyStartupDefault() {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, ownKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return
	}
	defer key.Close()
	_, _, err = key.GetIntegerValue(askedFlag)
	firstRun := err != nil
	if firstRun {
		key.SetDWordValue(askedFlag, 1)
	}
	if firstRun || autostartEnabled() {
		setAutostart(true)
	}
}
