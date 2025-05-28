import { Router } from "express";
import { prisma } from "../prisma";
import { convertBigInt, requireAuth } from "../middleware";
import multer from "multer";
import B2 from "backblaze-b2";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID!,
  applicationKey: process.env.B2_APP_KEY!,
});

const B2_BUCKET_ID = process.env.B2_BUCKET_ID!;
const B2_BUCKET_URL = process.env.B2_BUCKET_URL!;

async function uploadToB2(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
) {
  await b2.authorize();
  const {
    data: { uploadUrl, authorizationToken },
  } = await b2.getUploadUrl({ bucketId: B2_BUCKET_ID });

  await b2.uploadFile({
    uploadUrl,
    uploadAuthToken: authorizationToken,
    data: fileBuffer,
    fileName,
    mime: mimeType,
  });

  return `${B2_BUCKET_URL}/${fileName}`;
}

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

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, tags, image } = req.body;

    if (!title) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    let bucketFileName = "";

    if (req.file) {
      const fileName = `macroblocks/${Date.now()}_${req.file.originalname}`;
      await uploadToB2(req.file.buffer, fileName, req.file.mimetype);
      bucketFileName = fileName;
    } 

    const block = await prisma.blocks.create({
      data: {
        title,
        image,
        tags: tags ? (typeof tags === "string" ? JSON.parse(tags) : tags) : [],
        authorId: user.id,
        bucketFileName,
      },
    });

    res.status(201).json(convertBigInt(block));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create block" });
  }
});

// Update block with optional file upload
router.put(
  "/:blockId",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const { blockId } = req.params;
      const { title, tags } = req.body;

      const block = await prisma.blocks.findUnique({ where: { id: blockId } });

      if (!block) {
        res.status(404).json({ error: "Block not found" });
        return;
      }
      if (block.authorId !== user.id && !user.admin) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      let imageUrl = block.image;
      let bucketFileName = block.bucketFileName;

      if (req.file) {
        const fileName = `macroblocks/${Date.now()}_${req.file.originalname}`;
        imageUrl = await uploadToB2(
          req.file.buffer,
          fileName,
          req.file.mimetype
        );
        bucketFileName = fileName;
      } else if (req.body.image) {
        imageUrl = req.body.image;
      }

      const updated = await prisma.blocks.update({
        where: { id: blockId },
        data: {
          title,
          image: imageUrl,
          tags: tags
            ? typeof tags === "string"
              ? JSON.parse(tags)
              : tags
            : [],
          bucketFileName,
        },
      });

      res.json(convertBigInt(updated));
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Failed to update block" });
    }
  }
);

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

router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const fileName = `macroblocks/${Date.now()}_${req.file.originalname}`;
    const url = await uploadToB2(req.file.buffer, fileName, req.file.mimetype);
    res.status(200).json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.get("/download/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) {
      res.status(400).json({ error: "No file name provided" });
      return;
    }

    await b2.authorize();

    const b2FileName = `macroblocks/${fileName}`;
    const { data } = await b2.downloadFileByName({
      bucketName: process.env.B2_BUCKET_NAME!,
      fileName: b2FileName,
      responseType: "arraybuffer",
    });

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader(
      "Content-Type",
      data.contentType || "application/octet-stream"
    );
    res.setHeader("Content-Length", data.contentLength);

    res.send(Buffer.from(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

export default router;
