import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.user;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const user = jwt.verify(token, process.env.SESSION_SECRET!);

    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
}
