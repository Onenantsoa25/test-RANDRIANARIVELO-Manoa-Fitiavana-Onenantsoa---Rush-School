// src/partie1/rateLimiter.ts

export class RateLimiter {
  private interval: number;
  private lastRequestTime: number;

  constructor(requestsPerSecond: number = 5) {
    this.interval = 1000 / requestsPerSecond; // ms entre chaque requete
    this.lastRequestTime = 0;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    
    if (timeSinceLast < this.interval) {
      const waitTime = this.interval - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}