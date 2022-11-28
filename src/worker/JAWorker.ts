import { EventEmitter } from 'events';
import { parseBaseError } from 'parse-base-error';
import {
    JAEvent, JAEventCb, JAEventData, JAJob, JAWorkerOptions, JAWorkerStatus,
} from './types';
import { createRequestLimiter } from '../utils/createRequestLimiter';
import { assert } from '../utils/assert';
import { parseJAJobCompleted } from '../helpers/parseJAJobCompleted';
import { parseJAJobError } from '../helpers/parseJAJobError';

export class JAWorker<Data> {
    protected readonly emitter;

    protected readonly action;

    protected readonly requestLimiter;

    protected readonly concurrency;

    protected status: JAWorkerStatus;

    readonly remoteQueue;

    constructor(options: JAWorkerOptions<Data>) {
        const {
            autostart = false,
        } = options;

        this.action = options.action;
        this.remoteQueue = options.remoteQueue;
        this.requestLimiter = options.limiter ? createRequestLimiter(options.limiter) : undefined;
        this.concurrency = options.concurrency ?? 50;
        this.status = JAWorkerStatus.INIT;
        this.emitter = new EventEmitter();

        if (autostart) {
            this.start();
        }
    }

    protected async executeJob(job: JAJob<Data>) {
        try {
            const returnData = await this.action(job);
            const jobCompleted = parseJAJobCompleted({
                job,
                returnData,
            });

            this.emit(JAEvent.JOB_RESULT, {
                job: jobCompleted,
            });
        } catch (e) {
            const error = parseBaseError(e, 'executeJob');
            const jobError = parseJAJobError({
                job,
                errorMessage: error.message,
            });

            this.emit(JAEvent.JOB_RESULT, {
                job: jobError,
            });
        }
    }

    protected async run(): Promise<void> {
        if (this.status !== JAWorkerStatus.STARTED) {
            return;
        }

        try {
            await this.requestLimiter?.wait();
            const job = await this.remoteQueue.pop();

            assert(job, 'job not found');

            await this.executeJob(job);
        } catch (e) {
            const error = parseBaseError(e, 'JAWorker run');

            this.emit(JAEvent.ERROR, {
                error,
            });
        } finally {
            this.run();
        }
    }

    start() {
        if (this.status !== JAWorkerStatus.INIT) {
            return;
        }
        this.status = JAWorkerStatus.STARTED;

        // запустим выполнение задач паралельно
        Array.from({ length: this.concurrency })
            .forEach(() => {
                this.run();
            });
    }

    protected emit(event: JAEvent, data: JAEventData) {
        try {
            this.emitter.emit(event, data);
        } catch (e) {
            parseBaseError(e, `JAWorker emit ${event}`).log();
        }
    }

    on(event: JAEvent, cb: JAEventCb) {
        this.emitter.on(event, cb);
    }

    off(event: JAEvent, cb: JAEventCb) {
        this.emitter.off(event, cb);
    }

    async destroy() {
        this.status = JAWorkerStatus.DESTROYED;
        this.emitter.removeAllListeners();
    }
}
