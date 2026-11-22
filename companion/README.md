# Chest Log Companion

Chest Log Companion is a small Windows program that lets the Chest Log website read your Fortnite replay files. It sits in the notification area next to the clock and does nothing else. This folder holds all of its source code.

## Why it exists

Fortnite saves replays in `%LOCALAPPDATA%\FortniteGame\Saved\Demos`. Chrome and Edge do not let a website keep access to anything under `%LOCALAPPDATA%`, so Chest Log cannot be given that folder once and keep reading it. The companion reads the folder itself and hands the files to the website when it asks. Chest Log still reads the replays in your browser, as before.

## What it reads and shares

- It lists the files directly inside the Demos folder whose names end in `.replay`, with each file's size and last-changed time.
- It sends the contents of a replay only when Chest Log asks for that file by name. Names that are not in the list, such as ones with `..` or a path in them, get a 404.
- It never writes, renames or deletes anything in that folder. It does not look at subfolders, other folders or other file types.
- It does not parse the replays. It makes no network connections of its own.

## Who it answers

The program listens on `127.0.0.1`, port `47811`. Only your PC can reach that address. It answers a web page only when the page comes from the Chest Log site, from one of the site's preview deployments, or from a copy of the site running on your own PC (`localhost`). Your browser enforces this, so a page on any other site cannot read the answers. A page on another site can try to point its own web address at your PC to reach the program. Those requests carry that site's name, and the program refuses them with a 403.

Other programs on your PC can still ask it for replays, as they can already read the same files directly. The list of allowed sites is at the top of [`server.go`](server.go).

## Install

1. Download `ChestLogCompanion.exe` from the [releases page](https://github.com/Abe-54/chest-log/releases). On a Windows on ARM PC, download `ChestLogCompanion-arm64.exe` instead.
2. Double-click the file. The file is new and not code-signed, so Windows may show a SmartScreen warning. [Check the download](#check-a-download) first if you want to, then choose **More info** and **Run anyway**.
3. Look for the icon, a gold diamond with a blue diamond in the middle, next to the clock. If you do not see it, click the arrow at the left of the notification area.

If a second copy is started, it shows a message that port `47811` is in use and exits.

## The menu

Right-click the icon.

- The first line says how many replays are being shared, or that the Fortnite replay folder was not found.
- **Open Chest Log** opens https://fortnite-chestcounter.vercel.app/app/ in your browser.
- **Open replay folder** opens the Demos folder in Explorer.
- **Start with Windows** starts the program when you sign in.
- **View source code** opens this folder on GitHub.
- **Quit** stops the program. Chest Log can no longer read new replays until you start it again.

## Start with Windows, and uninstall

The first time it runs, the program turns **Start with Windows** on. It does this by adding the value `ChestLogCompanion` to `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`, set to the quoted path of the exe. It does not need administrator rights.

To turn it off, right-click the icon and untick **Start with Windows**. The choice sticks, because the program keeps one flag, `StartupAsked`, in `HKEY_CURRENT_USER\Software\ChestLogCompanion` to remember that it has already asked. If you move the exe while the box is ticked, the entry is rewritten with the new path the next time the program starts.

That flag and the startup entry are all it stores. At start it also writes its icon to your temp folder for a moment and deletes it again, because the tray library can only load an icon from a file.

To uninstall:

1. Right-click the icon and untick **Start with Windows**. This removes the startup entry, so Windows has nothing left to look for at sign-in.
2. Right-click the icon again and choose **Quit**.
3. Delete `ChestLogCompanion.exe`.
4. Optional. Delete the key `HKEY_CURRENT_USER\Software\ChestLogCompanion` in Registry Editor.

## Check a download

Each release lists `SHA256SUMS.txt` next to the exe files. In PowerShell, run this in the folder with the download.

```powershell
Get-FileHash .\ChestLogCompanion.exe -Algorithm SHA256
```

The hash must match the line for that file in `SHA256SUMS.txt`. PowerShell prints capital letters and the file uses lowercase, so ignore case.

Each exe also has a build provenance attestation from GitHub Actions. With the [GitHub CLI](https://cli.github.com/), run this.

```
gh attestation verify ChestLogCompanion.exe --repo Abe-54/chest-log
```

It succeeds only if GitHub holds a signed record that a workflow in this repository built that exact file. The record comes from [`companion.yml`](../.github/workflows/companion.yml) and names the commit and tag, so you can read the source behind the file.

## Build it yourself

You need [Go](https://go.dev/dl/) at the version in `go.mod`.

```
cd companion
go test ./...
GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags "-H=windowsgui -s -w -X main.version=1.0.0" -o ChestLogCompanion.exe .
```

Use `GOARCH=arm64` for Windows on ARM. A build made this way has the same code as a release but no embedded icon or version info. The release workflow adds those with [go-winres](https://github.com/tc-hib/go-winres) from `winres/winres.json` before it builds.

On any other system, `go run .` runs only the server, without a tray icon. Set `CHESTLOG_DEMOS` to a folder of `.replay` files to try it.

```
CHESTLOG_DEMOS=/path/to/replays go run .
curl http://127.0.0.1:47811/v1/status
```

## What the program answers

| Request | Answer |
| --- | --- |
| `GET /v1/status` | Program name, version, the folder it reads, whether the folder exists, and how many replays it found. |
| `GET /v1/replays` | The replay list, sorted by name, with each file's name, size and last-changed time. |
| `GET /v1/replays/{name}` | The bytes of one replay from that list. |

Everything else gets a 404, or a 405 for methods other than `GET`, `HEAD` and `OPTIONS`.

## The source

| File | What it does |
| --- | --- |
| `server.go` | The three answers above, the list of allowed sites, the host check, and the replay list. It has no Windows code. |
| `server_test.go` | Tests for the above, including attempts to read files outside the folder. |
| `main.go` | Finds the folder, opens the port and starts the server. |
| `tray_windows.go` | The tray icon and menu. |
| `autostart_windows.go` | The **Start with Windows** registry entry. |
| `tray_other.go` | A stand-in for other systems that only runs the server. |
| `makeicon.go`, `icon.ico` | The script that draws the icon, and its output. |
| `winres/winres.json` | The icon and version info that go-winres puts in the Windows build. |

The program depends on three modules. `fyne.io/systray` draws the tray icon and menu. `golang.org/x/sys` calls the Windows registry and shell. `github.com/godbus/dbus` is pulled in by `fyne.io/systray` for Linux. It is compiled into the Windows build but never runs there.

Not affiliated with or endorsed by Epic Games.
