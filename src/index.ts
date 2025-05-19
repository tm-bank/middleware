import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());

import auth from "./routes/auth";

app.use("/auth", auth);

app.use(
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
  })
);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
