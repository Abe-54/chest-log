Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "web")
sh.Run "node server.mjs", 0, False
