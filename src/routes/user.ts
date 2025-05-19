import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { queryId } = req.query;

    const where: any = {};

    where.id = { contains: String(queryId), mode: "sensitive" };

    const user = await prisma.users.findFirst({
      where,
    });

    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
