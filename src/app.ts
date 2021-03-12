import { initialize } from "./browser";
import app from "./server";

const port = process.env.PORT || 3001;

initialize().then(() => {
  app.listen(port, () =>
    console.log(`Example app listening at http://localhost:${port}`)
  );
});
