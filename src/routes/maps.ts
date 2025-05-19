import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const maps = await prisma.maps.findMany({
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch maps" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, viewLink, images, tags } = req.body;

    if (!title || !viewLink) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const map = await prisma.maps.create({
      data: {
        title,
        viewLink,
        images: images || [],
        tags: tags || [],
        authorId: user.id,
      },
    });

    res.status(201).json(map);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create map" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { title, author, tags } = req.query;

    // Build Prisma where clause
    const where: any = {};

    if (title) {
      where.title = { contains: String(title), mode: "insensitive" };
    }

    if (author) {
      where.author = {
        username: { contains: String(author), mode: "insensitive" },
      };
    }

    if (tags) {
      const tagArr = String(tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagArr.length > 0) {
        where.tags = { hasSome: tagArr };
      }
    }

    const maps = await prisma.maps.findMany({
      where,
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: "Failed to search maps" });
  }
});

export default router;