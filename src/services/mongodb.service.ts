import { MongoClient, Collection, Db } from 'mongodb';

interface KOL {
  _id?: string;
  handleName: string;
  lastPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private static instance: MongoDBService;

  private constructor() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    this.client = new MongoClient(uri);
  }

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db('twitter_bot');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  getKolCollection(): Collection<KOL> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection<KOL>('kols');
  }

  async createKOL(handleName: string): Promise<KOL> {
    const collection = this.getKolCollection();
    const kol: KOL = {
      handleName,
      lastPostId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(kol);
    return { ...kol, _id: result.insertedId.toString() };
  }

  async findAllKOLs(): Promise<KOL[]> {
    const collection = this.getKolCollection();
    return collection.find().sort({ createdAt: -1 }).toArray();
  }

  async deleteKOL(id: string): Promise<boolean> {
    const collection = this.getKolCollection();
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async updateLastPostId(id: string, lastPostId: string): Promise<boolean> {
    const collection = this.getKolCollection();
    const result = await collection.updateOne(
      { _id: id },
      {
        $set: {
          lastPostId,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }
}