import { Request, Response } from 'express';
import prisma from '../services/prisma.service';

export class AuthController { 

  async createKol(req: Request, res: Response) {
    try {
      const { handle_name, last_post_id } = req.body;

      const kol = await prisma.kol.create({
        data: {
          handleName: handle_name,
          lastPostId: last_post_id
        }
      });

      res.status(201).json({
        success: true,
        data: kol
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error creating KOL',
        error: error?.message
      });
    }
  }

  async getAllKols(req: Request, res: Response) {
    try {
      const kols = await prisma.kol.findMany();

      res.status(200).json({
        success: true,
        data: kols
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error fetching KOLs',
        error: error?.message
      });
    }
  }
}