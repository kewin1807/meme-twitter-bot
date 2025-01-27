import fs from 'fs/promises';
import path from 'path';

interface KOL {
  _id: string;
  handleName: string;
  lastPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class StorageService {
  private static instance: StorageService;
  private filePath: string;
  private data: { kols: KOL[] };

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'kols.json');
    this.data = { kols: [] };
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private async ensureDataFile() {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      try {
        await fs.access(this.filePath);
      } catch {
        await fs.writeFile(this.filePath, JSON.stringify({ kols: [] }));
      }
    } catch (error) {
      console.error('Error ensuring data file:', error);
      throw error;
    }
  }

  private async loadData() {
    await this.ensureDataFile();
    const content = await fs.readFile(this.filePath, 'utf-8');
    const parsed = JSON.parse(content);
    // Convert string dates back to Date objects
    parsed.kols = parsed.kols.map((kol: any) => ({
      ...kol,
      createdAt: new Date(kol.createdAt),
      updatedAt: new Date(kol.updatedAt)
    }));
    this.data = parsed;
  }

  private async saveData() {
    await this.ensureDataFile();
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async createKOL(handleName: string): Promise<KOL> {
    await this.loadData();

    const kol: KOL = {
      _id: Date.now().toString(),
      handleName,
      lastPostId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.data.kols.push(kol);
    await this.saveData();
    return kol;
  }

  async findAllKOLs(): Promise<KOL[]> {
    await this.loadData();
    return this.data.kols.sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async deleteKOL(id: string): Promise<boolean> {
    await this.loadData();
    const initialLength = this.data.kols.length;
    this.data.kols = this.data.kols.filter(kol => kol._id !== id);
    const deleted = initialLength > this.data.kols.length;
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  async updateLastPostId(id: string, lastPostId: string): Promise<boolean> {
    await this.loadData();
    const kol = this.data.kols.find(k => k._id === id);
    if (kol) {
      kol.lastPostId = lastPostId;
      kol.updatedAt = new Date();
      await this.saveData();
      return true;
    }
    return false;
  }
}

export default StorageService.getInstance(); 