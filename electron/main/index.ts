import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { release } from "node:os";
import { app, BrowserWindow, shell, ipcMain } from "electron";
import savetoJSON from "./data/saveToFile";
import { getSqlite3 } from "./data/better-sqlite3";
import {
  DATABASE_FOLDER,
  DATABASE_PATH,
  ADD_RESOURCES,
  USER_CONFIG_PATH,
  USER_DATA_FOLDER,
} from "../../constants";
import InitDb from "./data/initialize";
import PersonLogic from "./logic/person-logic";
import AddressLogic from "./logic/address-logic";
import { PersonInfo } from "../../models/Persons";
import DonationRecordLogic from "./logic/donation-record-logic";
import ReceiptRecordLogic from "./logic/receipt-record-logic";

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, "../");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.mjs");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "Main window",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (url) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Apply electron-updater
  //update(win)
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

// Waits for the renderer process to emit `saveToJSON` IPC event *
ipcMain.on("saveToJSON", (sender, data) => {
  console.log("ipc.on saveToJSON electron main ");
  //testSQL();
});

//****************Checking and setting first run flag */
const isFirstRun = () => {
  const flagFilePath = join(USER_DATA_FOLDER, "first_run.flag");
  // Check if the flag file exists
  return !fs.existsSync(flagFilePath);
};
const markFirstRun = () => {
  const flagFilePath = join(USER_DATA_FOLDER, "first_run.flag");
  const initDb = new InitDb();
  initDb.readyDatabase();
  //initDb.insertMockData();
  // Create the flag file
  fs.writeFileSync(flagFilePath, "");
};

if (isFirstRun()) {
  markFirstRun();
  const initDb = new InitDb();
  initDb.readyDatabase();
  initDb.insertMockData();
}

const db = getSqlite3(DATABASE_PATH);
const personLogic = new PersonLogic(db);
const addressLogic = new AddressLogic(db);
const donationLogic = new DonationRecordLogic(db);
const receiptLogic = new ReceiptRecordLogic(db);
ipcMain.handle("getAllPersons", (sender, data) => {
  const personData = personLogic.getAllPersons();
  return personData;
});
ipcMain.handle("getPersonDetails", (sender, id) => {
  console.log("Get Person By ID - electron main");
  let personInfo = new PersonInfo();
  personInfo.person = personLogic.getPersonById(id);
  personInfo.address = addressLogic.getAddressByPersonId(id);
  personInfo.donations = donationLogic.getDonationByPersonId(id);
  personInfo.receipts = receiptLogic.getReceiptRecordsById(id);

  const receiptsValid = receiptLogic.validateReceiptRecords(
    id,
    personInfo.receipts,
    personInfo.donations
  );

  if (!receiptsValid) {
    console.log("NEW RECEIPTS CREATED");
    personInfo.receipts = receiptLogic.getReceiptRecordsById(id);
  }

  return personInfo;
});

function testSQL() {
  const root =
    process.env.NODE_ENV === "development"
      ? "./donation-tracker.sqlite"
      : join(process.resourcesPath, "./donation-tracker.sqlite");
  //: join(app.getPath("userData"), "./donation-tracker.sqlite");

  db.pragma("journal_mode = WAL");

  let tableExist = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cats'"
    )
    .get();
  if (tableExist === undefined) {
    console.log("CATS DON'T EXISTS");
    console.log(tableExist);
    let createTable = db.prepare("CREATE TABLE cats (name text, age integer)");
    let info = createTable.run();
    console.log(info.changes);
    console.log(info.lastInsertRowid);
  }

  const insert = db.prepare(
    "INSERT INTO cats (name, age) VALUES (@name, @age)"
  );

  const insertMany = db.transaction((cats: object[]) => {
    for (const cat of cats) insert.run(cat);
  });

  try {
    insertMany([
      { name: "Joey", age: 2 },
      { name: "Sally", age: 4 },
      { name: "Junior", age: 1 },
    ]);
  } catch (err) {
    if (!db.inTransaction) throw err; // (transaction was forcefully rolled back)
  }
}
