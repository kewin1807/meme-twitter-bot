import { Router } from 'express';
import { AuthController } from "../controllers";

const authController = new AuthController()

const authRouter = Router();

authRouter.post('/kol', authController.createKol);
authRouter.get('/kols', authController.getAllKols);
export { authRouter }