export enum JAEvent {
    JOB_RESULT = 'job-result',
    ERROR = 'ja-error',
}

export enum JAWorkerStatus {
    INIT,
    STARTED,
    DESTROYED,
}

export enum JAJobStatus {
    WAIT = 'wait',
    COMPLETED = 'completed',
    ERROR = 'error',
}

export interface JAJob<T> {
    id: string
    groupId?: string
    onCreated: number
    onFinished?: number
    status: JAJobStatus
    errorMessage?: string
    returnData?: any
    data: T
}

export interface JARemoteQueue<Data> {
    factoryNestedRemoteQueue: <T>(key: string) => JARemoteQueue<T>
    add: (...data: Data[]) => Promise<JAJob<Data>[]>
    pop: () => Promise<JAJob<Data> | undefined>
    clear: () => Promise<void>
    destroy: () => Promise<void>
}

export interface JAJobAction<Data> {
    (data: JAJob<Data>): Promise<any>
}

export interface JAWorkerOptions<Data> {
    action: JAJobAction<Data>
    remoteQueue: JARemoteQueue<Data>
    autostart?: boolean
    concurrency?: number
    limiter?: {
        max: number // кол-во
        duration: number // за какое время
    }
}

export interface JAEventData {
    job?: JAJob<any>
    error?: Error
}

export interface JAEventCb {
    (eventData: JAEventData): Promise<void>
}
