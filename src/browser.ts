import {
  spawnChrome,
  ChromeWithPipeConnection,
  RootConnection,
  SessionConnection,
} from "chrome-debugging-client";

let chrome: ChromeWithPipeConnection;
let browser: RootConnection;

type PageInfo = {
  width: number;
  height: number;
  page: SessionConnection;
};

const pages: Record<string, PageInfo | undefined> = {};

export async function initialize() {
  chrome = spawnChrome({ headless: false });
  browser = chrome.connection;
}

export async function newPage(width: number = 800, height: number = 600) {
  width = Math.max(width, 1) - 4; // for netscape;
  height = Math.max(height, 1) - 4; // for nestcape;

  console.log(width, height);
  const { targetId } = await browser.send("Target.createTarget", {
    url: "about:blank",
  });

  const page = await browser.attachToTarget(targetId);

  pages[targetId] = {
    page,
    width,
    height,
  };

  await page.send("Emulation.setDeviceMetricsOverride", {
    height,
    width,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send("Page.enable");

  return targetId;
}

export async function getPage(id?: string) {
  return pages[id] && pages[id].page;
}

export async function navigate(id: string, url: string) {
  const page = await getPage(id);
  return Promise.all([
    page.until("Page.loadEventFired"),
    page.send("Page.navigate", { url }),
  ]);
}

export async function screenshot(id: string, format: string = "jpeg") {
  const page = await getPage(id);
  const ss = await page.send("Page.captureScreenshot", {
    quality: format === "png" ? undefined : 50,
    format,
  });
  return Buffer.from(ss.data, "base64");
}

export async function click(id: string, x: number, y: number) {
  const page = await getPage(id);
  // await page.send("Runtime.evaluate", {
  //   awaitPromise: true,
  //   expression: `document.elementFromPoint(${x}, ${y}).click();`,
  // });

  await page.send("Input.dispatchMouseEvent", { x, y, type: "mouseMoved" });
  await page.send("Input.dispatchMouseEvent", {
    x,
    y,
    type: "mousePressed",
    button: "left",
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    x,
    y,
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
  });
}

export async function goBack(id: string) {
  const page = await getPage(id);
  const history = await page.send("Page.getNavigationHistory", {});
  console.log(history.entries);
  await page.send("Page.navigateToHistoryEntry", {
    entryId: history.entries[history.currentIndex - 1].id,
  });
}

export async function isTextfieldFocused(id: string) {
  const page = await getPage(id);

  const { result } = await page.send("Runtime.evaluate", {
    expression: "document.activeElement",
  });

  return (
    result.className === "HTMLInputElement" ||
    result.className === "HTMLTextAreaElement"
  );
}

let codes: string[] = [];
let isTyping = false;

export async function typeText(id: string, keys: string | string[]) {
  const page = await getPage(id);

  const newKeys = keys instanceof Array ? keys : keys.split(",");

  codes = [...codes, ...newKeys];

  console.log(codes);

  if (isTyping) {
    return;
  }

  isTyping = true;

  while (codes.length) {
    const code = parseInt(codes.shift());
    const key = String.fromCharCode(code);
    console.log(code);
    const event = {
      modifiers: 0,
      text: key,
      unmodifiedText: key,
      key: key,
      windowsVirtualKeyCode: code,
    };
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      ...event,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      ...event,
    });
  }

  isTyping = false;
}

export async function close() {
  await browser.send("Browser.close");
}

export async function waitForPageLoaded(id: string) {
  const page = await getPage(id);
  await page.until("Page.loadEventFired");
}

export async function resizeBrowser(id: string, width: number, height: number) {
  const page = await getPage(id);

  const viewport = pages[id];

  if (viewport.height !== height && viewport.width !== width) {
    console.log("resolution changed");
    await page.send("Emulation.setDeviceMetricsOverride", {
      height,
      width,
      deviceScaleFactor: 1,
      mobile: false,
    });

    viewport.height = height;
    viewport.width = width;
  }
}
