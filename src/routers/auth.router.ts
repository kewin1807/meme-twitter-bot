import { Router } from 'express';
import { AuthController } from "../controllers";

const authController = new AuthController()

const authRouter = Router();

export { authRouter }