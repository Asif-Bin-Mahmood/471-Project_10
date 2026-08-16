import express from "express";
import { getCurrentUser, login, register } from "../controllers/auth.controller.js";
import { requireAuth, requireSelfOrAdmin } from "../utils/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getCurrentUser);
router.get("/me/:id", requireAuth, requireSelfOrAdmin("id"), getCurrentUser);

export default router;
