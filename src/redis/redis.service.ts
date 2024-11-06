import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;
  private readonly _redisClient: Redis;
  keyPrefix = 'nestjs:';

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      keyPrefix: this.keyPrefix,
    });
    this._redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
    });
  }

  onModuleInit() {
    this.logger.log(`Redis connected on port ${this.redisClient.options.port}`);
    this.redisClient.config('SET', 'notify-keyspace-events', 'Ex');
    this._redisClient.subscribe('__keyevent@0__:expired');
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }

  async onKeyExpiration(callback: (key: string) => void | Promise<void>) {
    this._redisClient.on('message', async (_channel, key) => {
      await callback(key);
    });
  }

  setKeyWithExpiry(key: string, expSec?: number) {
    if (expSec) {
      this.redisClient.set(key, '', 'EX', expSec);
    } else {
      this.redisClient.set(key, '');
    }
  }

  async checkKey(key: string): Promise<boolean> {
    return (await this.redisClient.exists(key)) === 1;
  }
}
