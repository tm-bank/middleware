import express, { Request, Response } from "express";
import session from "express-session";
import passport from "./passport";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";
import { pgPool } from "./db";

import maps from "./routes/maps";
import auth from "./routes/auth";

dotenv.config();

const PgSession = connectPgSimple(session);

const app = express();
const port = process.env.PORT || 3001;

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
    }),
    secret: process.env.AUTH_KEY || "changeme",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("tm-bank api");
});

app.use("/maps", maps);
app.use("/auth", auth);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
