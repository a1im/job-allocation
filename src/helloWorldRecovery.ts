import {
    JAWorker,
    JARedisRemoteQueue,
    JAJob,
} from './index';
import { delay } from './utils/delay';
import { recoveryUnfinishedJobs } from './helpers/recoveryUnfinishedJobs';

const remoteQueue = new JARedisRemoteQueue<{ name: string }>({
    name: 'redis-key-queue',
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});
const remoteQueueTemp = remoteQueue.factoryNestedRemoteQueue('temp');
const action = async (job: JAJob<{ name: string }>) => {
    await delay(1000);
    console.log(`Hello world, ${job.data.name}`);
    // await remoteQueueTemp.removeJob(job);
};
const worker = new JAWorker({
    getJob: () => remoteQueue.popMove(remoteQueueTemp.key),
    action,
    concurrency: 2,
});
const startTask = async () => {
    /**
     * Adding jobs to work
     */
    await remoteQueue.clear();
    await remoteQueueTemp.clear();
    await remoteQueue.add({ name: 'foo' });
    await delay(1000);
    await remoteQueue.add({ name: 'bar' });

    setInterval(() => {
        recoveryUnfinishedJobs({
            queueJobs: remoteQueue,
            queueRunningJobs: remoteQueueTemp,
            retryTimeout: 4000,
        });
    }, 1000);
};

/**
 * Run in nodes that perform tasks
 */
worker.start();
/**
 * Run in the control node
 */
startTask();
