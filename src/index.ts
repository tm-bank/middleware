import express, { Request, Response } from "express";
import session from "express-session";
import passport from "./passport";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";
import { pgPool } from "./db";

import maps from "./routes/maps";
import auth from "./routes/auth";
import me from "./routes/me";

dotenv.config();

const PgSession = connectPgSimple(session);

const app = express();
const port = process.env.PORT || 3001;

app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://tmbank.onrender.com",
    "https://tmbank.onrender.com",
  ];
  const origin = req.headers.origin;
  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-key"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, UPDATE");
  next();
});

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
      secure: false,
      sameSite: "none",
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
app.use("/me", me);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
