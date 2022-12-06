import Redis from 'ioredis';
import { JAJob, JARemoteQueue } from '../worker/types';
import { JARedisRemoteStorageQueue } from './types';
import { parseNumber } from '../utils/parsers/parseNumber';
import { generateStorageKey } from '../helpers/generateStorageKey';
import { isArray } from '../utils/predicate/isArray';
import { createJAJob } from '../helpers/createJAJob';
import { createIORedis } from '../helpers/createIORedis';

export class JARedisRemoteQueue<Data> implements JARemoteQueue<Data> {
    protected readonly options: JARedisRemoteStorageQueue;

    protected readonly name;

    protected readonly prefix;

    protected readonly blockingTimeout;

    protected readonly redisOptions;

    protected readonly redisClients: Redis[] = [];

    protected readonly redisClientStack: Redis[] = [];

    constructor(options: JARedisRemoteStorageQueue) {
        const {
            name,
            blockingTimeout = 0,
            prefix = 'ta-remote-storage',
            host = 'localhost',
            port = '6379',
        } = options ?? {};

        this.options = options;
        this.name = name;
        this.blockingTimeout = blockingTimeout;
        this.prefix = prefix;
        this.redisOptions = {
            host,
            port: parseNumber(port),
        };
    }

    get key() {
        return generateStorageKey(
            this.prefix,
            this.name,
        );
    }

    private async transactionRedisClient<T extends(redisClient: Redis) => Promise<any>>(cb: T): Promise<Awaited<ReturnType<T>>> {
        let redisClient = this.redisClientStack.pop();

        if (!redisClient) {
            redisClient = createIORedis(this.redisOptions);
            this.redisClients.push(redisClient);
        }

        try {
            const result = await cb(redisClient);

            return result;
        } finally {
            this.redisClientStack.push(redisClient);
        }
    }

    factoryNestedRemoteQueue(name: string) {
        const nestedRemoteQueue = new JARedisRemoteQueue<any>({
            ...this.options,
            prefix: this.key,
            name,
        });

        return nestedRemoteQueue;
    }

    async pop() {
        return this.transactionRedisClient(async (redisClient) => {
            const items = await redisClient.blpop(
                this.key,
                this.blockingTimeout,
            );
            const unparsedItem = isArray(items)
                ? items[1]
                : items ?? undefined;
            const job = unparsedItem
                ? JSON.parse(unparsedItem) as JAJob<Data>
                : undefined;

            return job;
        });
    }

    async addData(...job: JAJob<Data>[]) {
        if (job.length) {
            await this.transactionRedisClient(async (redisClient) => {
                await redisClient.rpush(
                    this.key,
                    ...job.map((it) => JSON.stringify(it)),
                );
            });
        }
    }

    async add(...data: Data[]) {
        const jobs = data.map((it) => createJAJob(it));

        if (jobs.length) {
            await this.addData(...jobs);
        }

        return jobs;
    }

    async count() {
        return this.transactionRedisClient(async (redisClient) => {
            const count = await redisClient.llen(this.key);

            return count;
        });
    }

    async clear() {
        await this.transactionRedisClient(async (redisClient) => {
            await redisClient.del(this.key);
        });
    }

    async destroy() {
        await Promise.all([
            ...this.redisClients.map((itRedisClient) => itRedisClient.disconnect()),
        ]);
    }
}
