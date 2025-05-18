import express, { Router, Request, Response } from "express";
import passport from "../passport";

const router = Router();

router.get("/discord", passport.authenticate("discord"));

router.get(
  "/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/",
    successRedirect: process.env.FRONTEND_URL || "/",
  })
);

const requireAuthKey: express.RequestHandler = (req, res, next) => {
  const key = req.header("x-auth-key");
  if (key && key === process.env.AUTH_KEY) {
    return next();
  }
  res.status(401).json({ error: "Invalid or missing AUTH_KEY" });
};

router.use(requireAuthKey);

router.get("/me", (req: Request, res: Response): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated with Discord" });
    return;
  }

  const user = req.user as any;
  res.json({
    discordId: user.discord_id,
    username: user.username,
    avatar: user.avatar,
    email: user.email,
    displayName: user.display_name,
  });
});

export default router;