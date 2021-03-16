// import * as puppeteer from "puppeteer";
// import { Browser, Page } from "puppeteer";
import * as pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";

import {
  spawnChrome,
  ChromeWithPipeConnection,
  RootConnection,
  SessionConnection,
} from "chrome-debugging-client";

let chrome: ChromeWithPipeConnection;
let browser: RootConnection;

const pages: Record<string, SessionConnection> = {};
const pageScreenshots: Record<string, PNGWithMetadata> = {};

export async function initialize() {
  chrome = spawnChrome({ headless: false });
  browser = chrome.connection;
}

export async function getPage(
  id?: string,
  width: number = 800,
  height: number = 600
) {
  let page = pages[id];

  if (!page) {
    width = Math.max(width, 1) - 4; // for netscape;
    height = Math.max(height, 1) - 4; // for nestcape;
    const { targetId } = await browser.send("Target.createTarget", {
      url: "about:blank",
    });
    page = pages[id] = await browser.attachToTarget(targetId);
    await page.send("Page.enable");
    id = targetId;
    await page.send("Page.setDeviceMetricsOverride", {
      height,
      width,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // page.setViewport({ height, width });
  }

  return { id, page };
}

export async function navigate(id: string, url: string) {
  const { page } = await getPage(id);
  return Promise.all([
    page.until("Page.loadEventFired"),
    page.send("Page.navigate", { url }),
  ]);
}

export async function screenshot(id: string, format: string = "jpeg") {
  const { page } = await getPage(id);
  const ss = await page.send("Page.captureScreenshot", {
    quality: format === "png" ? undefined : 100,
    format,
  });
  return Buffer.from(ss.data, "base64");
}

export async function click(id: string, x: number, y: number) {
  const { page } = await getPage(id);
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
  const { page } = await getPage(id);
  const history = await page.send("Page.getNavigationHistory");
  console.log(history.entries);
  await page.send("Page.navigateToHistoryEntry", {
    entryId: history.entries[history.currentIndex - 1].id,
  });
}

export async function isTextfieldFocused(id: string) {
  // const page = await getPage(id);
  // const focused = await page.$(":focus");
  return false;
}

// export async function getCurrentCoordinates(
//   id: string
// ): Promise<
//   | {
//       area: string;
//       click: string;
//     }[]
//   | undefined
// > {
//   const page = await getPage(id);
//   try {
//     const inputs = await page.$$("input");
//     const buttons = await page.$$("button");
//     const hyperlink = await page.$$("a");
//     const others = await page.$$("[role=button]");

//     const boundingBoxes = await Promise.all([
//       ...inputs.map((button) => button.boundingBox()),
//       ...buttons.map((button) => button.boundingBox()),
//       ...hyperlink.map((button) => button.boundingBox()),
//       ...others.map((button) => button.boundingBox()),
//     ]);

//     return boundingBoxes
//       .filter((o) => !!o)
//       .map((box) => ({
//         area: [
//           Math.floor(box.x),
//           Math.floor(box.y),
//           Math.ceil(box.x + box.width),
//           Math.ceil(box.y + box.height),
//         ].join(","),
//         click: [box.x + box.width / 2, box.y + box.height / 2].join(","),
//       }));
//   } catch (_) {
//     try {
//       await page.waitForNavigation({
//         waitUntil: "networkidle2",
//         timeout: 10000,
//       });
//     } catch (_) {}
//     return getCurrentCoordinates(id);
//   }
// }

export async function close() {
  await browser.send("Browser.close");
}

export async function waitChangingPage(id: string) {
  if (!pageScreenshots[id]) {
    const ss = (await screenshot(id, "png")) as Buffer;

    pageScreenshots[id] = PNG.sync.read(ss);
  }

  let sameTimeout = 0;
  let differentTimeout = 0;

  return new Promise((resolve) => {
    async function test() {
      const currentSS = (await screenshot(id, "png")) as Buffer;

      // const diff = {
      //   data: new Buffer([]),
      // };

      const previous = pageScreenshots[id];
      const current = PNG.sync.read(currentSS);

      const { width, height } = previous;

      const mismatched = pixelmatch(
        previous.data,
        current.data,
        null,
        width,
        height,
        {
          threshold: 0.1,
        }
      );

      console.log(mismatched);

      if (mismatched <= 1) {
        sameTimeout++;
        differentTimeout = 0;

        console.log("same timeout", sameTimeout);

        if (sameTimeout >= 3) {
          console.log("same timeout completed");
          resolve(null);

          return;
        }
      }

      if (mismatched >= 2) {
        sameTimeout = 0;
        differentTimeout++;

        pageScreenshots[id] = current;

        console.log("different timeout");
        if (differentTimeout >= 50) {
          console.log("different timeout completed");
          resolve(null);

          return;
        }
      }

      setTimeout(() => {
        test();
      }, 50);
    }
    test();
  });
}
