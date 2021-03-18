import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import { Response } from "express";
import qs = require("qs");
import { v4 } from "uuid";
import {
  click,
  getPage,
  goBack,
  isTextfieldFocused,
  navigate,
  newPage,
  resizeBrowser,
  screenshot,
  typeText,
} from "./browser";

const app = express();

let currentNumber = 0;

function redirect(res: Response, id: string, url?: string) {
  currentNumber++;
  const query = qs.stringify({
    url,
  });

  const redirect = `/${id}/${currentNumber}?${query}`;
  res.redirect(redirect);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "vash");
app.use(cookieParser());

app.use("/assets", express.static("assets"));

// app.use((_, res, next) => {

//   next();
// });

app.get("/", async (req, res) => {
  res.render("home", {});
});

app.post("/", async (req, res) => {
  const { url } = req.body;
  const { resolution } = req.cookies;

  console.log(req.body);

  console.log(req.cookies);

  const [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  const id = await newPage(width, height);
  await navigate(id, url);
  redirect(res, id, url);
});

// app.post("/type/:id", async (req, res) => {
//   const { id } = req.params;
//   const { usertext } = req.body;

//   console.log(usertext);
//   await setText(id, usertext);

//   redirect(res, id);
// });

app.get("/click/:id", async (req, res) => {
  const { id } = req.params;

  const page = await getPage(id);

  const [x, y] = Object.keys(req.query)[0]
    .split(",")
    .map((o) => parseFloat(o));

  await click(id, x, y);

  const url = page.targetInfo.url;
  redirect(res, id, url);
});

app.get("/:id/:num", async (req, res) => {
  res.setHeader("Expires", "Mon, 26 Jul 1997 05:00:00 GMT");
  // always modified right now
  // res.setHeader("Last-Modified",   . gmdate("D, d M Y H:i:s") . " GMT");
  // HTTP/1.1
  res.setHeader(
    "Cache-Control",
    "private, no-store, max-age=0, no-cache, must-revalidate, post-check=0, pre-check=0"
  );
  // HTTP/1.0
  res.setHeader("Pragma", "no-cache");

  const { id, num } = req.params;

  const n = parseInt(num);
  if (n < currentNumber) {
    await goBack(id);
    redirect(res, id);
    return;
  }

  const { resolution } = req.cookies;

  let [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  width = Math.max(width, 1) - 4; // for netscape;
  height = Math.max(height, 1) - 4; // for nestcape;

  await resizeBrowser(id, width, height);

  const page = await getPage(id);

  // await page.waitForTimeout(500);

  const isTypeMode = await isTextfieldFocused(id);

  // page.setViewport({ width, height });

  // console.log("start chaning");
  // await waitForPageLoaded(id);
  // console.log("page loaded!");
  // await waitChangingPage(id);
  // console.log("finish chaning");
  res.render("browser", {
    url: page.targetInfo.url,
    pageId: id,
    imgId: v4(),
    title: page.targetInfo.title,
    isTypeMode,
  });
});

app.get("/ss/:id/*", async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.cookies;
  const { keypresses } = req.query;

  if (keypresses) {
    typeText(id, keypresses as string);
  }

  let [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  width = Math.max(width, 1) - 4; // for netscape;
  height = Math.max(height, 1) - 4; // for nestcape;

  const ss = await screenshot(id);
  // const ss = await page.screenshot({
  //   quality: 100,
  //   encoding: "binary",
  //   type: "jpeg",
  //   clip: { x: 0, y: 0, width, height },
  // });

  res.type("jpg");
  res.send(ss);
});

// app.get("/close/:id", async (req, res) => {
//   const { id } = req.params;
//   const page = await getPage(id);

//   await page.close();
// });

export default app;
