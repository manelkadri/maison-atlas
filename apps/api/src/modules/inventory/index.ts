import { Router } from "express";
import { parseBody, parseQuery } from "../../utils/validate";
import { inventoryFiltersSchema, movementFiltersSchema, parseMovement } from "./schemas";
import { listInventory, listMovements, recordMovement } from "./service";

/** Module « inventory » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

adminRoutes.get("/", async (req, res) => {
  res.json(await listInventory(parseQuery(inventoryFiltersSchema, req)));
});

adminRoutes.get("/movements", async (req, res) => {
  res.json(await listMovements(parseQuery(movementFiltersSchema, req)));
});

adminRoutes.post("/movements", async (req, res) => {
  const movement = await recordMovement(parseMovement(req.body));
  res.status(201).json(movement);
});
