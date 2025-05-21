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

    const blocks = await prisma.blocks.findMany({
      where,
      include: { author: true },
      orderBy: { votes: "desc" },
    });

    res.json(convertBigInt(blocks));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to search maps" });
  }
});

router.get("/:blockId", async (req, res) => {
  try {
    const id = req.params.blockId;

    if (id) {
      const block = await prisma.blocks.findFirst({
        where: {
          id: { equals: String(id) },
        },
      });

      if (!block) {
        res.status(404).json({ error: "Block not found" });
        return;
      }

      res.json(convertBigInt(block));
    } else {
      const blocks = await prisma.blocks.findMany({
        include: { author: true },
        orderBy: { createdAt: "desc" },
      });

      res.json(convertBigInt(blocks));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, viewLink, image, tags, ixId } = req.body;

    if (!title || !viewLink) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const block = await prisma.blocks.create({
      data: {
        title,
        image: image || "",
        tags: tags || [],
        authorId: user.id,
        ixId,
      },
    });

    res.status(201).json(convertBigInt(block));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create block" });
  }
});

router.put("/:blockId", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { blockId } = req.params;
    const { title, image, tags, ixId } = req.body;

    const block = await prisma.blocks.findUnique({ where: { id: blockId } });

    if (!block) {
      res.status(404).json({ error: "Block not found" });
      return;
    }
    if (block.authorId !== user.id && !user.admin) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const updated = await prisma.blocks.update({
      where: { id: blockId },
      data: {
        title,
        image,
        tags,
        ixId,
      },
    });

    res.json(convertBigInt(updated));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update block" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { blockId } = req.body;

    if (!blockId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await prisma.blocks.delete({
      where: { id: blockId },
    });

    res.status(201).end();
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete block" });
  }
});

router.post("/vote", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { blockId, up } = req.body;

    if (!blockId || typeof up !== "boolean") {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Check if user has already voted for this block
    const dbUser = await prisma.users.findUnique({ where: { id: user.id } });

    if (!dbUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (dbUser.votes.includes(blockId)) {
      res.status(400).json({ error: "Already voted for this block" });
      return;
    }

    const block = await prisma.blocks.update({
      where: { id: blockId },
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
          push: blockId,
        },
      },
    });

    res.status(200).json(convertBigInt(block));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

export default router;
