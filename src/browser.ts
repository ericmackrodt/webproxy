import * as puppeteer from "puppeteer";
import { Browser, Page } from "puppeteer";

let browser: Browser;

const pages: Record<string, Page> = {};

export async function initialize() {
  browser = await puppeteer.launch({
    headless: false,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
}

export async function getPage(id: string) {
  let page = pages[id];

  if (!page) {
    page = pages[id] = await browser.newPage();
  }

  return page;
}

export async function getCurrentCoordinates(id: string) {
  const page = await getPage(id);

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
}

export async function close() {
  await browser.close();
}
