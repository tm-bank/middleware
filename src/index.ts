import express, { Request, Response } from "express";
import dotenv from "dotenv";
import axios from "axios";
import cookieParser from "cookie-parser";
import cors from "cors";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

app.use(
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
  })
);

app.get("/auth/discord/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify email",
    prompt: "consent",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("No code provided");
    return;
  }

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "identify email",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userRes.data;

    const jwtToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        global_name: user.global_name,
      },
      process.env.SESSION_SECRET!,
      { expiresIn: "7d" }
    );

    res.redirect(
      `${process.env.FRONTEND_URL!}/auth/callback?token=${jwtToken}`
    );
  } catch (err) {
    res.status(500).send("OAuth failed");
  }
});

app.post("/auth/logout", (req, res) => {
  res.clearCookie("user", { sameSite: "lax" });
  res.status(200).json({ message: "Logged out" });
});

app.get("/auth/me", (req, res) => {
  const user = req.cookies.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(JSON.parse(user));
});

app.post("/auth/set-cookie", (req, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).send("No token provided");
    return;
  }

  try {
    jwt.verify(token, process.env.SESSION_SECRET!);
    res.cookie("user", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    res.status(200).json({ message: "Cookie set" });
  } catch {
    res.status(401).send("Invalid token");
  }
});

app.get("/auth/me", (req, res) => {
  const token = req.cookies.user;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = jwt.verify(token, process.env.SESSION_SECRET!);
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
