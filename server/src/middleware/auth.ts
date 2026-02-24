import type { Request, Response, NextFunction } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

export type AuthUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const jwtSecret: Secret = (process.env.JWT_SECRET || "dev-jwt-secret") as Secret;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.pp_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, jwtSecret) as AuthUser;
    if (!uuidRegex.test(payload.id)) {
      res.clearCookie("pp_session", { path: "/" });
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  return next();
}

export function signJwt(user: AuthUser) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(user, jwtSecret, options);
}
