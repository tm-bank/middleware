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

const requireAuthKey: express.RequestHandler = (req: Request, res: Response, next) => {
  const key = req.header("x-auth-key");
  if (key && key === process.env.AUTH_KEY) {
    return next();
  }
  res.status(401).json({ error: "Invalid or missing AUTH_KEY" });
};

router.use(requireAuthKey);

export default router;
