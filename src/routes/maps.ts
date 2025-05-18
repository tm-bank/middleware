import express, { Router, Request, Response } from "express";
import { pgPool } from "../db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pgPool.query(
      `SELECT id, map, created_at, author, author_display
       FROM maps
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch maps" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await pgPool.query(
      `SELECT id, map, created_at, author, author_display
       FROM maps
       WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Map not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch map" });
  }
});

router.post("/", express.json(), async (req: Request, res: Response) => {
  const { id, map, author, author_display } = req.body;
  if (!id || !map || !author || !author_display) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const { rows } = await pgPool.query(
      `INSERT INTO maps (id, map, author, author_display, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, map, created_at, author, author_display`,
      [id, map, author, author_display]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to insert map" });
  }
});

router.put("/:id", express.json(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { map, author, author_display } = req.body;
  try {
    const { rows } = await pgPool.query(
      `UPDATE maps
       SET map = COALESCE($2, map),
           author = COALESCE($3, author),
           author_display = COALESCE($4, author_display)
       WHERE id = $1
       RETURNING id, map, created_at, author, author_display`,
      [id, map, author, author_display]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Map not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update map" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pgPool.query(`DELETE FROM maps WHERE id = $1`, [
      id,
    ]);
    if (rowCount === 0) {
      res.status(404).json({ error: "Map not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete map" });
  }
});

export default router;