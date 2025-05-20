import { Router } from "express";
import { prisma } from "../prisma";
import { convertBigInt, requireAuth } from "../middleware";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { title, author, tags } = req.query;

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
        where.tags = { hasEvery: tagArr };
      }
    }

    const maps = await prisma.maps.findMany({
      where,
      include: { author: true },
      orderBy: { votes: "desc" },
    });

    res.json(convertBigInt(maps));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to search maps" });
  }
});

router.get("/:mapId", async (req, res) => {
  try {
    const id = req.params.mapId;

    if (id) {
      const map = await prisma.maps.findFirst({
        where: {
          id: { equals: String(id) },
        },
      });

      if (!map) {
        res.status(404).json({ error: "Map not found" });
        return;
      }

      res.json(convertBigInt(map));
    } else {
      const maps = await prisma.maps.findMany({
        include: { author: true },
        orderBy: { createdAt: "desc" },
      });

      res.json(convertBigInt(maps));
    }
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

    res.status(201).json(convertBigInt(map));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create map" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { mapId } = req.body;

    if (!mapId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await prisma.maps.delete({
      where: { id: mapId },
    });

    res.status(201);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create map" });
  }
});

router.post("/vote", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { mapId, up } = req.body;

    if (!mapId || typeof up !== "boolean") {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Check if user has already voted for this map
    const dbUser = await prisma.users.findUnique({ where: { id: user.id } });

    if (!dbUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (dbUser.votes.includes(mapId)) {
      res.status(400).json({ error: "Already voted for this map" });
      return;
    }

    const map = await prisma.maps.update({
      where: { id: mapId },
      data: {
        votes: {
          increment: up ? 1 : -1,
        },
      },
    });

    await prisma.users.update({
      where: { id: user.id },
      data: {
        votes: {
          push: mapId,
        },
      },
    });

    res.status(200).json(convertBigInt(map));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

export default router;
