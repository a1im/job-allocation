# job-allocation

[![NPM](https://img.shields.io/npm/v/job-allocation.svg?style=flat-square)](https://www.npmjs.com/package/job-allocation)
[![Downloads](https://img.shields.io/npm/dm/job-allocation?style=flat-square)](https://www.npmjs.com/package/job-allocation)

Library for distributing jobs between nodes

## Install
```
yarn add job-allocation
# or
npm i job-allocation
```

## Example

```ts
import {
    JAWorker,
    JARedisRemoteQueue,
    JAJob,
    createWaitJobsCompleted,
} from 'job-allocation';

const action = async (job: JAJob<{name: string}>) => `Hello world, ${job.data.name}`;
const remoteQueue = new JARedisRemoteQueue<{name: string}>({
    name: 'redis-key-queue',
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});
const worker = new JAWorker({
    remoteQueue,
    action,
    concurrency: 2,
});
const { waitJobsCompleted } = createWaitJobsCompleted(worker);
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
```

## License
MIT
