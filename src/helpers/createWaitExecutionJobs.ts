import { v4 as uuidv4 } from 'uuid';
import { JAWorker } from '../worker/JAWorker';
import {
    JAEvent,
    JAEventData,
    JAJob,
} from '../worker/types';
import { createJAJob } from './createJAJob';

/**
 * Создает метод который дожидается выполнения задач
 */
export const createWaitExecutionJobs = <
    Worker extends JAWorker<any>,
>(worker: Worker) => {
    type JobData = Worker extends JAWorker<infer P> ? P : unknown;
    const workerOnResult = async ({ job }: JAEventData) => {
        if (!job?.groupId) {
            return;
        }
        const remoteQueue = worker.remoteQueue.factoryNestedRemoteQueue(job.groupId);

        await remoteQueue.add(job);
        await remoteQueue.destroy();
    };

    worker.on(JAEvent.JOB_RESULT, workerOnResult);

    const waitExecutionJobs = async (jobs: JobData[], timeout?: number): Promise<JAJob<JobData>[]> => {
        if (!jobs.length) {
            return [];
        }
        const groupId = uuidv4();
        const remoteQueue = worker.remoteQueue.factoryNestedRemoteQueue(groupId);
        const jobDataList = jobs.map((job) => createJAJob(job, groupId));
        const resultJobs: JAJob<JobData>[] = [];
        let promiseResolve: (value?: unknown) => void;
        let promiseReject: (error: Error) => void;
        const promise = new Promise((resolve, reject) => {
            promiseResolve = resolve;
            promiseReject = reject;
        });
        const countJobs = jobDataList.length;
        const resultWorker = new JAWorker({
            remoteQueue,
            action: async (job) => {
                resultJobs.push(job);
                if (resultJobs.length >= countJobs) {
                    promiseResolve();
                }
            },
            concurrency: Math.min(50, countJobs),
            autostart: true,
        });
        let timeoutId;

        resultWorker.on(JAEvent.ERROR, async ({ error }) => {
            const errorMessage = error?.message ?? 'Unhandled error';

            promiseReject(new Error(`waitExecutionJobs: ${errorMessage}`));
        });

        try {
            if (timeout) {
                timeoutId = setTimeout(() => {
                    promiseReject(new Error(`waitExecutionJobs: timeout ${resultJobs.length}`));
                }, timeout);
            }

            await Promise.all([
                worker.remoteQueue.add(...jobDataList),
                promise,
            ]);

            return resultJobs;
        } finally {
            await remoteQueue.clear();
            await remoteQueue.destroy();
            await resultWorker.destroy();
            clearTimeout(timeoutId);
        }
    };
    const destroy = async () => {
        worker.off(JAEvent.JOB_RESULT, workerOnResult);
    };

    return {
        waitExecutionJobs,
        destroy,
    };
};
