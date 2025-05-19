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

export function convertBigInt(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertBigInt);
  } else if (obj && typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      if (typeof obj[key] === "bigint") {
        newObj[key] = obj[key].toString();
      } else {
        newObj[key] = convertBigInt(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}