import express, { Request, Response } from 'express';
import { authRouter } from "./routers";

const app = express();
const PORT = 3000;



// Middleware
app.use(express.json());

// Routes
// auth
app.use("/auth", authRouter)

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript with Express!');
});



// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
