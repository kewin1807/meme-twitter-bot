import express, { Request, Response } from 'express';
import { authRouter } from "./routers";
import TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from "./utils"
import telegramCommands from './bot.handler';


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

console.log('Telegram bot initialized');

// Initialize bot commands()
telegramCommands.initializeCommands();
console.log('Bot commands registered');
