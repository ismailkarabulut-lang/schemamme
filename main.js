// Şema Üretici — masaüstü kabuğu (Electron)
// Tek işi var: sema-uretici.html dosyasını tarayıcı çubuğu olmayan kendi penceresinde açmak.
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

function pencereAc() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0B0D12",
    title: "Şema Üretici",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on("did-fail-load", (e, code, desc, url) => console.log("FAIL", code, desc, url));
  win.webContents.on("did-finish-load", () => console.log("LOADED", win.webContents.getURL()));
  win.loadFile(path.join(__dirname, "sema-uretici.html"));
  // Sayfa içinden açılan dış bağlantılar sistem tarayıcısında açılsın
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  pencereAc();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) pencereAc();
  });
});

app.on("window-all-closed", () => app.quit());
