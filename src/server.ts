import * as bodyParser from "body-parser";
import * as express from "express";
import { v4 } from "uuid";
import { getCurrentCoordinates, getPage } from "./browser";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "vash");

app.use("/assets", express.static("assets"));

app.get("/", (req, res) => {
  const { url } = req.query;
  const redirect = "/" + v4() + (url ? "?url=" + url : "");
  res.redirect(redirect);
});

app.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { click, url } = req.query;

  const page = await getPage(id);

  if (url && url !== page.url()) {
    await page.goto(url as string);
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle0",
        timeout: 1000,
      });
    } catch (_) {}
  }

  if (click) {
    const [x, y] = (click as string).split(",").map((o) => parseFloat(o));

    console.log(x, y);

    await page.mouse.click(x, y);
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle0",
        timeout: 1000,
      });
    } catch (_) {}
  }

  const coordinates = await getCurrentCoordinates(id);
  res.render("home", {
    url: page.url(),
    pageId: id,
    imgId: v4(),
    coordinates,
    title: await page.title(),
  });
});

app.get("/ss/:id/*", async (req, res) => {
  const { id } = req.params;
  const page = await getPage(id);

  const ss = await page.screenshot({
    quality: 100,
    encoding: "binary",
    type: "jpeg",
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
