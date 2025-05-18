import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
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