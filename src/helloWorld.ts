import {
    JAWorker,
    JARedisRemoteQueue,
    JAJob,
    createWaitJobsCompleted,
} from './index';

const action = async (job: JAJob<{ name: string }>) => `Hello world, ${job.data.name}`;
const remoteQueue = new JARedisRemoteQueue<{ name: string }>({
    name: 'redis-key-queue',
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});
const worker = new JAWorker({
    getJob: () => remoteQueue.pop(),
    action,
    concurrency: 2,
});
const { waitJobsCompleted } = createWaitJobsCompleted({
    worker,
    queue: remoteQueue,
});
const startTask = async () => {
    /**
     * Adding jobs to work
     */
    const jobs = await remoteQueue.add(
        { name: 'foo' },
        { name: 'bar' },
    );
    /**
     * Wait for the jobs to be completed
     * ! does not guarantee order
     */
    const jobsCompleted = await waitJobsCompleted(jobs);

    /**
     * Log the result:
     * Hello world, bar
     * Hello world, foo
     */
    jobsCompleted.forEach((job) => {
        console.log(job.returnData);
    });
};

/**
 * Run in nodes that perform tasks
 */
worker.start();
/**
 * Run in the control node
 */
startTask();
