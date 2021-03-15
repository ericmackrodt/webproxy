import * as puppeteer from "puppeteer";
import { Browser, Page } from "puppeteer";
import * as pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";

let browser: Browser;

const pages: Record<string, Page> = {};
const pageScreenshots: Record<string, PNGWithMetadata> = {};

export async function initialize() {
  browser = await puppeteer.launch({
    headless: false,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
}

export async function getPage(
  id: string,
  width: number = 800,
  height: number = 600
) {
  let page = pages[id];

  if (!page) {
    width = Math.max(width, 1) - 4; // for netscape;
    height = Math.max(height, 1) - 4; // for nestcape;
    page = pages[id] = await browser.newPage();
    page.setViewport({ height, width });
  }

  return page;
}

export async function isTextfieldFocused(id: string) {
  const page = await getPage(id);
  const focused = await page.$(":focus");
  return !!focused;
}

export async function getCurrentCoordinates(
  id: string
): Promise<
  | {
      area: string;
      click: string;
    }[]
  | undefined
> {
  const page = await getPage(id);
  try {
    const inputs = await page.$$("input");
    const buttons = await page.$$("button");
    const hyperlink = await page.$$("a");
    const others = await page.$$("[role=button]");

    const boundingBoxes = await Promise.all([
      ...inputs.map((button) => button.boundingBox()),
      ...buttons.map((button) => button.boundingBox()),
      ...hyperlink.map((button) => button.boundingBox()),
      ...others.map((button) => button.boundingBox()),
    ]);

    return boundingBoxes
      .filter((o) => !!o)
      .map((box) => ({
        area: [
          Math.floor(box.x),
          Math.floor(box.y),
          Math.ceil(box.x + box.width),
          Math.ceil(box.y + box.height),
        ].join(","),
        click: [box.x + box.width / 2, box.y + box.height / 2].join(","),
      }));
  } catch (_) {
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 10000,
      });
    } catch (_) {}
    return getCurrentCoordinates(id);
  }
}

export async function close() {
  await browser.close();
}

export async function waitChangingPage(id: string) {
  const page = await getPage(id);

  if (!pageScreenshots[id]) {
    const ss = (await page.screenshot({
      // quality: 100,
      encoding: "binary",
      type: "png",
    })) as Buffer;

    pageScreenshots[id] = PNG.sync.read(ss);
  }

  let sameTimeout = 0;
  let differentTimeout = 0;

  return new Promise((resolve) => {
    async function test() {
      const currentSS = (await page.screenshot({
        // quality: 100,
        encoding: "binary",
        type: "png",
      })) as Buffer;

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

        if (sameTimeout >= 2) {
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
      }, 100);
    }
    test();
  });
}
