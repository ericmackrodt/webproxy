import { initialize } from "./browser";
import app from "./server";

const port = parseInt(process.env.PORT) || 3001;

initialize().then(() => {
  app.listen(port, "0.0.0.0", 0, () =>
    console.log(`Example app listening at http://localhost:${port}`)
  );
});
