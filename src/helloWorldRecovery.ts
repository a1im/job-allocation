import {
    JAWorker,
    JARedisRemoteQueue,
    JAJob,
} from './index';
import { delay } from './utils/delay';
import { recoveryUnfinishedJobs } from './helpers/recoveryUnfinishedJobs';
import { startJobActivity } from './helpers/startJobActivity';

const remoteQueue = new JARedisRemoteQueue<{ name: string }>({
    name: 'redis-key-queue',
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});
const remoteQueueActiveJobs = remoteQueue.factoryNestedRemoteQueue('temp');
const action = async (job: JAJob<{ name: string }>) => {
    const stopJobActivity = startJobActivity({
        queueJobs: remoteQueueActiveJobs,
        job,
        interval: 100,
    });

    await delay(6000);
    console.log(`Hello world, ${job.data.name}`);
    await stopJobActivity();
};
const worker = new JAWorker({
    getJob: () => remoteQueue.popMove(remoteQueueActiveJobs.key),
    action,
    concurrency: 2,
});
const startTask = async () => {
    /**
     * Adding jobs to work
     */
    await remoteQueue.clear();
    await remoteQueueActiveJobs.clear();
    console.log(
        'remoteQueue',
        await remoteQueue.count(),
        await remoteQueueActiveJobs.count(),
    );
    worker.start();
    await remoteQueue.add({ name: 'foo' });
    // await remoteQueue.add({ name: 'bar' });

    setInterval(() => {
        recoveryUnfinishedJobs({
            queueJobs: remoteQueue,
            queueRunningJobs: remoteQueueActiveJobs,
            retryTimeout: 1000,
        });
    }, 500);
};

/**
 * Run in the control node
 */
startTask();
