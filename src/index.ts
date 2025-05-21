import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
  })
);

import auth from "./routes/auth";
import maps from "./routes/maps";
import user from "./routes/user";
import blocks from "./routes/blocks";

app.use("/auth", auth);
app.use("/maps", maps);
app.use("/user", user);
app.use("/blocks", blocks)

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
