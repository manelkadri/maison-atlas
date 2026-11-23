import type { Request } from "express";
import type { z } from "zod";
import { validation } from "./errors";

function parse<T extends z.ZodType>(schema: T, data: unknown, where: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.length ? `${first.path.join(".")} : ` : "";
    throw validation(`${where} invalide — ${path}${first?.message ?? "valeur incorrecte"}`, result.error.issues);
  }
  return result.data;
}

/** Valide le corps JSON. (Express 5 : req.query est en lecture seule, d'où ces helpers plutôt qu'un middleware.) */
export const parseBody = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => parse(schema, req.body, "Corps de requête");
export const parseQuery = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => parse(schema, req.query, "Paramètres de requête");
export const parseParams = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => parse(schema, req.params, "Paramètres d'URL");
