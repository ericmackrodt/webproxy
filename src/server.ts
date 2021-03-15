import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import * as qs from "query-string";
import { v4 } from "uuid";
import { getPage, isTextfieldFocused } from "./browser";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "vash");
app.use(cookieParser());

app.use("/assets", express.static("assets"));

app.get("/", async (req, res) => {
  res.render("home", {});
});

app.post("/", async (req, res) => {
  const { url } = req.body;
  const { resolution } = req.cookies;
  const id = v4();

  const [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  const page = await getPage(id, width, height);
  await page.goto(url as string);
  const redirect = `/${id}${url ? "?url=" + url : ""}`;
  res.redirect(redirect);
});

app.post("/type/:id", async (req, res) => {
  const { id } = req.params;
  const { usertext } = req.body;

  const page = await getPage(id);

  await page.keyboard.type(usertext);

  const url = page.url();
  const query = qs.stringify({
    url,
  });

  const redirect = `/${id}?${query}`;
  res.redirect(redirect);
});

app.get("/click/:id", async (req, res) => {
  const { id } = req.params;

  const page = await getPage(id);

  const [x, y] = Object.keys(req.query)[0]
    .split(",")
    .map((o) => parseFloat(o));

  await page.mouse.click(x, y);

  const url = page.url();
  const query = qs.stringify({
    url,
  });

  const redirect = `/${id}?${query}`;
  res.redirect(redirect);
});

app.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { resolution } = req.cookies;

  let [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  width = Math.max(width, 1) - 4; // for netscape;
  height = Math.max(height, 1) - 4; // for nestcape;

  console.log("navigated");

  const page = await getPage(id, width, height);

  await page.waitForTimeout(500);

  const isTypeMode = await isTextfieldFocused(id);

  page.setViewport({ width, height });

  console.log("start chaning");
  // await waitChangingPage(id);
  console.log("finish chaning");
  res.render("browser", {
    url: page.url(),
    pageId: id,
    imgId: v4(),
    title: await page.title(),
    isTypeMode,
  });
});

app.get("/ss/:id/*", async (req, res) => {
  const { id } = req.params;
  const page = await getPage(id);

  const { resolution } = req.cookies;

  let [width, height] = (resolution as string)
    .split("x")
    .map((o) => parseFloat(o));

  width = Math.max(width, 1) - 4; // for netscape;
  height = Math.max(height, 1) - 4; // for nestcape;

  const ss = await page.screenshot({
    quality: 100,
    encoding: "binary",
    type: "jpeg",
    clip: { x: 0, y: 0, width, height },
  });

  res.type("jpg");
  res.send(ss);
});

app.get("/close/:id", async (req, res) => {
  const { id } = req.params;
  const page = await getPage(id);

  await page.close();
});

export default app;
