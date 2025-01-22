export type LogLevel = 'INFO' | 'WARNING' | 'ERROR'

export type TLog = {
  timestamp: Date | string;
  level: LogLevel,
  message: any
}

class Logger {
  private logs: TLog[] = [];
  private maxLogs: number;

  // simple save log in memory, we can save the logs on file or loki database
  // set the limitation 
  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs
  }

  private addLog(level: LogLevel, message: string) {
    const log: TLog = {
      timestamp: new Date(),
      level,
      message
    }
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    // optional
    console.log(log);
  }

  info(message: string) {
    this.addLog('INFO', message);
  }
  warning(message: string) {
    this.addLog("WARNING", message);
  }
  error(message: string) {
    this.addLog("ERROR", message);
  }

  getLogs() {
    return this.logs
  }
}

const logger = new Logger();
export default logger